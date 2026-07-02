import { db } from "./db";
import { VoteAnswer, MajorityType, PollStatus, Prisma } from "@prisma/client";

export interface EffectiveVote {
  answer: VoteAnswer | null;
  disputed: boolean;
  note: string | null;
}

export interface QuestionTally {
  total: number;
  agree: number;
  disagree: number;
  abstain: number;
  none: number;
  disputed: number;
  voted: number;
  need: number;
  status: "approved" | "rejected" | "short";
}

type UnitWithOwners = Prisma.UnitGetPayload<{ include: { owners: true } }>;
type PollWithRelations = Prisma.PollGetPayload<{
  include: { questions: true; building: true };
}>;

export interface PollResults {
  poll: PollWithRelations;
  units: UnitWithOwners[];
  /** QuestionTally keyed by question number */
  tallies: Map<number, QuestionTally>;
  /** EffectiveVote keyed by unitId, then by question number */
  effectiveVotes: Map<string, Map<number, EffectiveVote>>;
}

interface VoteRow {
  unitId: string;
  questionNo: number;
  answer: VoteAnswer;
  version: number;
}

interface SubvoteRow extends VoteRow {
  ownerId: string;
}

function computeEffectiveVote(
  unit: UnitWithOwners,
  questionNo: number,
  latestVotes: Map<string, VoteRow>,
  latestSubvotesByUnitQuestion: Map<string, SubvoteRow[]>
): EffectiveVote {
  if (unit.coMode === "internal") {
    const subvotes = latestSubvotesByUnitQuestion.get(`${unit.id}:${questionNo}`) || [];

    if (subvotes.length === 0) {
      return {
        answer: null,
        disputed: false,
        note: "Čaká na interné hlasovanie spoluvlastníkov"
      };
    }

    // Tally ownership shares — only the latest vote version of each co-owner counts
    const tally: Record<string, number> = {};
    for (const sub of subvotes) {
      const owner = unit.owners.find(o => o.id === sub.ownerId);
      if (owner) {
        tally[sub.answer] = (tally[sub.answer] || 0) + owner.share;
      }
    }

    let bestAnswer: VoteAnswer | null = null;
    let bestShare = 0;

    for (const [ans, share] of Object.entries(tally)) {
      if (share > bestShare) {
        bestAnswer = ans as VoteAnswer;
        bestShare = share;
      }
    }

    if (bestShare > 0.5 && bestAnswer) {
      return {
        answer: bestAnswer,
        disputed: false,
        note: `Zhoda podielov (${Math.round(bestShare * 100)} %)`
      };
    }

    return {
      answer: null,
      disputed: true,
      note: "Spoluvlastníci sa nezhodli — bez väčšiny podielov"
    };
  }

  const latestVote = latestVotes.get(`${unit.id}:${questionNo}`);

  if (!latestVote) {
    return { answer: null, disputed: false, note: null };
  }

  return { answer: latestVote.answer, disputed: false, note: null };
}

function computeTally(
  majorityType: MajorityType,
  questionNo: number,
  units: UnitWithOwners[],
  effectiveVotes: Map<string, Map<number, EffectiveVote>>,
  treatAsClosed: boolean
): QuestionTally {
  let total = 0;
  let agree = 0;
  let disagree = 0;
  let abstain = 0;
  let none = 0;
  let disputed = 0;

  for (const u of units) {
    const w = u.votes || 1;
    total += w;

    const eff = effectiveVotes.get(u.id)?.get(questionNo) || {
      answer: null,
      disputed: false,
      note: null
    };

    if (eff.disputed) {
      disputed += w;
    } else if (eff.answer === VoteAnswer.agree) {
      agree += w;
    } else if (eff.answer === VoteAnswer.disagree) {
      disagree += w;
    } else if (eff.answer === VoteAnswer.abstain) {
      abstain += w;
    } else {
      none += w;
    }
  }

  const voted = agree + disagree + abstain;

  // Calculate required majority threshold
  let need = 0;
  switch (majorityType) {
    case MajorityType.half_all:
      need = Math.floor(total / 2) + 1;
      break;
    case MajorityType.twothirds_all:
      need = Math.ceil(total * 2 / 3);
      break;
    case MajorityType.fourfifths_all:
      need = Math.ceil(total * 4 / 5);
      break;
    case MajorityType.all:
      need = total;
      break;
    case MajorityType.half_present:
      need = Math.floor(voted / 2) + 1;
      break;
  }

  // Status resolution
  let status: "approved" | "rejected" | "short";
  if (agree >= need) {
    status = "approved";
  } else {
    const couldReach = agree + none + disputed >= need;
    if (treatAsClosed) {
      status = "rejected";
    } else {
      status = couldReach ? "short" : "rejected";
    }
  }

  return { total, agree, disagree, abstain, none, disputed, voted, need, status };
}

/**
 * Computes effective votes and tallies for a whole poll with a constant number
 * of database queries (4), regardless of the number of units and questions.
 *
 * Use `treatAsClosed: true` when sealing results before the poll status is
 * flipped to closed, so undecided questions resolve as "rejected" instead of "short".
 */
export async function computePollResults(
  pollId: string,
  opts?: { treatAsClosed?: boolean }
): Promise<PollResults> {
  const poll = await db.poll.findUnique({
    where: { id: pollId },
    include: {
      questions: { orderBy: { no: "asc" } },
      building: true
    }
  });

  if (!poll) {
    throw new Error(`Poll ${pollId} not found`);
  }

  const [units, votes, subvotes] = await Promise.all([
    db.unit.findMany({
      where: { buildingId: poll.buildingId },
      orderBy: { no: "asc" },
      include: { owners: true }
    }),
    db.vote.findMany({
      where: { pollId },
      select: { unitId: true, questionNo: true, answer: true, version: true }
    }),
    db.coownerSubvote.findMany({
      where: { pollId },
      select: { unitId: true, ownerId: true, questionNo: true, answer: true, version: true }
    })
  ]);

  // Latest vote per (unit, question)
  const latestVotes = new Map<string, VoteRow>();
  for (const v of votes) {
    const key = `${v.unitId}:${v.questionNo}`;
    const cur = latestVotes.get(key);
    if (!cur || v.version > cur.version) {
      latestVotes.set(key, v);
    }
  }

  // Latest subvote per (unit, question, owner)
  const latestSubvotes = new Map<string, SubvoteRow>();
  for (const sv of subvotes) {
    const key = `${sv.unitId}:${sv.questionNo}:${sv.ownerId}`;
    const cur = latestSubvotes.get(key);
    if (!cur || sv.version > cur.version) {
      latestSubvotes.set(key, sv);
    }
  }

  const latestSubvotesByUnitQuestion = new Map<string, SubvoteRow[]>();
  for (const sv of latestSubvotes.values()) {
    const key = `${sv.unitId}:${sv.questionNo}`;
    const list = latestSubvotesByUnitQuestion.get(key);
    if (list) {
      list.push(sv);
    } else {
      latestSubvotesByUnitQuestion.set(key, [sv]);
    }
  }

  const effectiveVotes = new Map<string, Map<number, EffectiveVote>>();
  for (const u of units) {
    const perQuestion = new Map<number, EffectiveVote>();
    for (const q of poll.questions) {
      perQuestion.set(q.no, computeEffectiveVote(u, q.no, latestVotes, latestSubvotesByUnitQuestion));
    }
    effectiveVotes.set(u.id, perQuestion);
  }

  const treatAsClosed = opts?.treatAsClosed || poll.status === PollStatus.closed;
  const tallies = new Map<number, QuestionTally>();
  for (const q of poll.questions) {
    tallies.set(q.no, computeTally(q.majorityType, q.no, units, effectiveVotes, treatAsClosed));
  }

  return { poll, units, tallies, effectiveVotes };
}

/**
 * Effective vote of a single unit for a single question.
 * For batch scenarios (whole poll, all units), prefer computePollResults().
 */
export async function getEffectiveUnitVote(
  pollId: string,
  unitId: string,
  questionNo: number
): Promise<EffectiveVote> {
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    include: { owners: true }
  });

  if (!unit) {
    throw new Error(`Unit with ID ${unitId} not found`);
  }

  if (unit.coMode === "internal") {
    const subvotes = await db.coownerSubvote.findMany({
      where: { pollId, unitId, questionNo },
      select: { unitId: true, ownerId: true, questionNo: true, answer: true, version: true }
    });

    const latestSubvotes = new Map<string, SubvoteRow>();
    for (const sv of subvotes) {
      const cur = latestSubvotes.get(sv.ownerId);
      if (!cur || sv.version > cur.version) {
        latestSubvotes.set(sv.ownerId, sv);
      }
    }

    const byUnitQuestion = new Map<string, SubvoteRow[]>([
      [`${unitId}:${questionNo}`, [...latestSubvotes.values()]]
    ]);
    if (latestSubvotes.size === 0) {
      byUnitQuestion.delete(`${unitId}:${questionNo}`);
    }

    return computeEffectiveVote(unit, questionNo, new Map(), byUnitQuestion);
  }

  const latestVote = await db.vote.findFirst({
    where: { pollId, unitId, questionNo },
    orderBy: { version: "desc" }
  });

  const latestVotes = new Map<string, VoteRow>();
  if (latestVote) {
    latestVotes.set(`${unitId}:${questionNo}`, latestVote);
  }

  return computeEffectiveVote(unit, questionNo, latestVotes, new Map());
}

/**
 * Tally of a single question. Internally computes the whole poll in 5 queries;
 * when you need tallies for multiple questions, call computePollResults() once instead.
 */
export async function tallyQuestion(
  pollId: string,
  questionId: string
): Promise<QuestionTally> {
  const question = await db.question.findUnique({
    where: { id: questionId }
  });

  if (!question) {
    throw new Error(`Question ${questionId} not found`);
  }

  const { tallies } = await computePollResults(pollId);
  const tally = tallies.get(question.no);

  if (!tally) {
    throw new Error(`Question ${questionId} does not belong to poll ${pollId}`);
  }

  return tally;
}
