import { createHash, timingSafeEqual } from "node:crypto";
import type { EffectiveVote, PollResults, QuestionTally } from "./engine";

export interface SealedPollSnapshot {
  version: 1;
  sealedAt: string;
  poll: {
    id: string;
    title: string;
    reason: string;
    declarer: string;
    announcedAt: string;
    startAt: string;
    endAt: string;
    building: Pick<PollResults["poll"]["building"], "id" | "name" | "short" | "address" | "entrance" | "manager" | "contact" | "contactEmail">;
  };
  questions: Array<{
    id: string;
    no: number;
    kind: string;
    title: string;
    text: string;
    majorityType: string;
    note: string | null;
    attachments: string[];
    tally: QuestionTally;
  }>;
  units: Array<{
    id: string;
    no: string;
    type: string;
    votes: number;
    coMode: string;
    actingPerson: string | null;
    owners: Array<{ id: string; name: string; share: number; role: string }>;
    effectiveVotes: Array<EffectiveVote & { questionNo: number }>;
  }>;
}

export function createSealedSnapshot(results: PollResults, now = new Date()): SealedPollSnapshot {
  const { poll, units, tallies, effectiveVotes } = results;
  const { id, name, short, address, entrance, manager, contact, contactEmail } = poll.building;
  return {
    version: 1,
    sealedAt: now.toISOString(),
    poll: {
      id: poll.id, title: poll.title, reason: poll.reason, declarer: poll.declarer,
      announcedAt: poll.announcedAt.toISOString(), startAt: poll.startAt.toISOString(), endAt: poll.endAt.toISOString(),
      building: { id, name, short, address, entrance, manager, contact, contactEmail },
    },
    questions: poll.questions.map(question => {
      const tally = tallies.get(question.no);
      if (!tally) throw new Error("Chýbajú výsledky otázky pri zapečatení.");
      return {
        id: question.id, no: question.no, kind: question.kind, title: question.title, text: question.text,
        majorityType: question.majorityType, note: question.note, attachments: [...question.attachments], tally: { ...tally },
      };
    }),
    units: units.map(unit => ({
      id: unit.id, no: unit.no, type: unit.type, votes: unit.votes, coMode: unit.coMode, actingPerson: unit.actingPerson,
      owners: unit.owners.map(owner => ({ id: owner.id, name: owner.name, share: owner.share, role: owner.role })),
      effectiveVotes: poll.questions.map(question => ({
        questionNo: question.no,
        ...(effectiveVotes.get(unit.id)?.get(question.no) ?? { answer: null, disputed: false, note: null }),
      })),
    })),
  };
}

function parseSealedJson(resultJson: string, resultSha256?: string | null): unknown {
  if (resultSha256 && !verifySha256(resultJson, resultSha256)) throw new Error("Integrita zapečatených výsledkov bola porušená.");
  return JSON.parse(resultJson);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTally(value: unknown): value is QuestionTally {
  if (!isRecord(value)) return false;
  const fields = ["total", "agree", "disagree", "abstain", "none", "disputed", "voted", "need"];
  if (!fields.every(key => Number.isSafeInteger(value[key]) && (value[key] as number) >= 0)) return false;
  return ["approved", "rejected", "short"].includes(String(value.status));
}

export function parseSealedSnapshot(resultJson: string, resultSha256?: string | null): SealedPollSnapshot | null {
  const value = parseSealedJson(resultJson, resultSha256);
  if (Array.isArray(value) || (isRecord(value) && value.version === undefined)) return null;
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.poll) || !isRecord(value.poll.building)
    || typeof value.poll.id !== "string" || typeof value.poll.title !== "string"
    || !Array.isArray(value.questions) || !Array.isArray(value.units)
    || !value.questions.every(question => isRecord(question) && Number.isSafeInteger(question.no) && isTally(question.tally))
    || !value.units.every(unit => isRecord(unit) && typeof unit.id === "string" && typeof unit.no === "string"
      && Number.isSafeInteger(unit.votes) && Array.isArray(unit.owners) && Array.isArray(unit.effectiveVotes))) {
    throw new Error("Neplatný formát zapečatených výsledkov.");
  }
  return value as unknown as SealedPollSnapshot;
}

export interface SealedQuestionTally {
  no: number;
  title: string;
  text?: string;
  kind?: string;
  majorityType?: string;
  tally: QuestionTally;
}

/** Legacy seals stored only weighted question totals, not a historical voter register. */
export function getSealedQuestionTallies(resultJson: string, resultSha256?: string | null): SealedQuestionTally[] {
  const snapshot = parseSealedSnapshot(resultJson, resultSha256);
  if (snapshot) return snapshot.questions;
  const value = parseSealedJson(resultJson, resultSha256);
  if (!Array.isArray(value)) return [];
  return value.map(question => {
    if (!isRecord(question) || !Number.isSafeInteger(question.questionNo)) throw new Error("Neplatné zapečatené výsledky otázky.");
    const tally = {
      total: question.total, agree: question.agree, disagree: question.disagree, abstain: question.abstain,
      none: question.none, disputed: question.disputed, need: question.need, status: question.status,
      voted: Number(question.agree) + Number(question.disagree) + Number(question.abstain),
    };
    if (!isTally(tally)) throw new Error("Neplatné zapečatené výsledky otázky.");
    return { no: question.questionNo as number, title: typeof question.title === "string" ? question.title : "", tally };
  });
}

function normalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item === undefined) throw new Error("Hodnotu nemožno kanonicky serializovať.");
      output[key] = normalize(item);
    }
    return output;
  }
  throw new Error("Hodnotu nemožno kanonicky serializovať.");
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export function verifySha256(data: string | Uint8Array, expected: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expected)) return false;
  const actualBuffer = Buffer.from(sha256Hex(data), "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return timingSafeEqual(actualBuffer, expectedBuffer);
}
