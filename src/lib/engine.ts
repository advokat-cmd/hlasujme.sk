import { db } from "./db";
import { VoteAnswer, MajorityType, PollStatus } from "@prisma/client";

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
    // Fetch all owners subvotes for this question in this poll
    const subvotes = await db.coownerSubvote.findMany({
      where: {
        pollId,
        unitId,
        questionNo
      }
    });

    if (subvotes.length === 0) {
      return {
        answer: null,
        disputed: false,
        note: "Čaká na interné hlasovanie spoluvlastníkov"
      };
    }

    // Tally shares
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

  // Other coModes: fetch the latest version vote for this unit
  const latestVote = await db.vote.findFirst({
    where: {
      pollId,
      unitId,
      questionNo
    },
    orderBy: {
      version: "desc"
    }
  });

  if (!latestVote) {
    return {
      answer: null,
      disputed: false,
      note: null
    };
  }

  return {
    answer: latestVote.answer,
    disputed: false,
    note: null
  };
}

export async function tallyQuestion(
  pollId: string,
  questionId: string
): Promise<QuestionTally> {
  const question = await db.question.findUnique({
    where: { id: questionId },
    include: { poll: true }
  });

  if (!question) {
    throw new Error(`Question ${questionId} not found`);
  }

  const poll = question.poll;

  // Fetch all units in the building associated with the poll
  const units = await db.unit.findMany({
    where: { buildingId: poll.buildingId }
  });

  let total = 0;
  let agree = 0;
  let disagree = 0;
  let abstain = 0;
  let none = 0;
  let disputed = 0;

  for (const u of units) {
    const w = u.votes || 1;
    total += w;

    const eff = await getEffectiveUnitVote(pollId, u.id, question.no);

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
  switch (question.majorityType) {
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
    if (poll.status === PollStatus.closed) {
      status = "rejected";
    } else {
      status = couldReach ? "short" : "rejected";
    }
  }

  return {
    total,
    agree,
    disagree,
    abstain,
    none,
    disputed,
    voted,
    need,
    status
  };
}
