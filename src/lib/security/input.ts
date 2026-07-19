export const VOTE_ANSWERS = ["agree", "disagree", "abstain"] as const;
export type ValidVoteAnswer = (typeof VOTE_ANSWERS)[number];

const MAJORITIES = ["half-all", "twothirds-all", "fourfifths-all", "all", "half-present"] as const;
export type MajorityInput = (typeof MAJORITIES)[number];

const CO_MODES = ["single", "rep", "internal", "majority", "bsm", "legal"] as const;
export type CoModeInput = (typeof CO_MODES)[number];

export interface NormalizedOwner {
  id?: string;
  first: string;
  last: string;
  email: string;
  phone: string;
  birthDate: string;
  share: number;
  role: "owner" | "coowner" | "bsm" | "proxy" | "legal";
  admin: boolean;
  password: string;
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, message: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as UnknownRecord;
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} je povinné.`);
  return value.trim();
}

export function parseVoteAnswers(value: unknown, questionNos: Set<number>): Record<number, ValidVoteAnswer> {
  const input = record(value, "Chybné údaje odpovedí.");
  const normalized: Record<number, ValidVoteAnswer> = {};
  for (const [rawNo, rawAnswer] of Object.entries(input)) {
    if (!/^\d+$/.test(rawNo)) throw new Error("Neplatné číslo otázky.");
    const no = Number(rawNo);
    if (!questionNos.has(no)) throw new Error(`Neznáma otázka č. ${no}.`);
    if (typeof rawAnswer !== "string" || !VOTE_ANSWERS.includes(rawAnswer as ValidVoteAnswer)) {
      throw new Error(`Neplatná odpoveď pre otázku č. ${no}.`);
    }
    normalized[no] = rawAnswer as ValidVoteAnswer;
  }
  return normalized;
}

export function validateNewPassword(value: unknown): string {
  if (typeof value !== "string" || value.trim().length < 12) {
    throw new Error("Nové heslo musí mať aspoň 12 znakov.");
  }
  return value.trim();
}

export function validateOwners(value: unknown, coModeValue: unknown): NormalizedOwner[] {
  if (!CO_MODES.includes(coModeValue as CoModeInput)) throw new Error("Neplatný režim vlastníctva.");
  if (!Array.isArray(value) || value.length === 0) throw new Error("Jednotka musí mať aspoň jedného vlastníka.");

  const owners = value.map((raw, index): NormalizedOwner => {
    const owner = record(raw, `Neplatné údaje vlastníka ${index + 1}.`);
    const share = typeof owner.share === "number" ? owner.share : Number(owner.share);
    if (!Number.isFinite(share) || share <= 0 || share > 1) {
      throw new Error(`Podiel vlastníka ${index + 1} musí byť väčší ako 0 a najviac 100 %.`);
    }
    const roles = ["owner", "coowner", "bsm", "proxy", "legal"] as const;
    const role = typeof owner.role === "string" && roles.includes(owner.role as (typeof roles)[number])
      ? owner.role as (typeof roles)[number]
      : "owner";
    return {
      id: typeof owner.id === "string" && owner.id ? owner.id : undefined,
      first: requiredText(owner.first, `Meno vlastníka ${index + 1}`),
      last: requiredText(owner.last, `Priezvisko vlastníka ${index + 1}`),
      email: typeof owner.email === "string" ? owner.email.trim().toLowerCase() : "",
      phone: typeof owner.phone === "string" ? owner.phone.trim() : "",
      birthDate: typeof owner.birthDate === "string" ? owner.birthDate.trim() : "",
      share,
      role,
      admin: owner.admin === true,
      password: typeof owner.password === "string" ? owner.password : "",
    };
  });

  if (coModeValue === "internal") {
    const total = owners.reduce((sum, owner) => sum + owner.share, 0);
    if (Math.abs(total - 1) > 1e-6) throw new Error("Podiely interných spoluvlastníkov musia spolu tvoriť 100 %.");
  }
  return owners;
}

export interface NormalizedPollInput {
  basics: { title: string; reason: string; startAt: Date; endAt: Date };
  questions: Array<{ text: string; majority: MajorityInput; note: string | null }>;
}

export function validatePollInput(value: unknown): NormalizedPollInput {
  const input = record(value, "Neplatné údaje hlasovania.");
  const basics = record(input.basics, "Základné údaje hlasovania sú povinné.");
  if (!Array.isArray(input.questions) || input.questions.length === 0) {
    throw new Error("Hlasovanie musí obsahovať aspoň jednu otázku.");
  }
  const startAt = new Date(typeof basics.start === "string" ? basics.start : "");
  const endAt = new Date(typeof basics.end === "string" ? basics.end : "");
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime())) {
    throw new Error("Dátum začiatku alebo konca nie je platný.");
  }
  if (startAt >= endAt) throw new Error("Koniec hlasovania musí byť po jeho začiatku.");

  const questions = input.questions.map((raw, index) => {
    const question = record(raw, `Neplatná otázka č. ${index + 1}.`);
    if (!MAJORITIES.includes(question.majority as MajorityInput)) {
      throw new Error(`Neplatný typ väčšiny pri otázke č. ${index + 1}.`);
    }
    return {
      text: requiredText(question.text, `Text otázky ${index + 1}`),
      majority: question.majority as MajorityInput,
      note: typeof question.note === "string" && question.note.trim() ? question.note.trim() : null,
    };
  });
  return {
    basics: {
      title: requiredText(basics.title, "Názov hlasovania"),
      reason: requiredText(basics.reason, "Dôvod hlasovania"),
      startAt,
      endAt,
    },
    questions,
  };
}
