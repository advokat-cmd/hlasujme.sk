import { createHash } from "node:crypto";

type UnknownRecord = Record<string, unknown>;

export interface EmailAssignmentOwner {
  first: string;
  last: string;
}

export interface EmailAssignmentItem {
  unitNo: string;
  email: string;
  owner: EmailAssignmentOwner | null;
}

export interface EmailAssignmentPayload {
  buildingEntrance: string;
  assignments: EmailAssignmentItem[];
}

function record(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} má neplatný formát.`);
  return value as UnknownRecord;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} je povinné.`);
  return value.trim();
}

function email(value: unknown, label: string): string {
  const normalized = text(value, label).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) throw new Error(`${label} je neplatný e-mail.`);
  return normalized;
}

export function validateEmailAssignment(value: unknown): {
  payload: EmailAssignmentPayload;
  assignmentCount: number;
  fingerprint: string;
} {
  const input = record(value, "Import e-mailov");
  const buildingEntrance = text(input.buildingEntrance, "Vchod");
  if (!Array.isArray(input.assignments) || input.assignments.length === 0) {
    throw new Error("Import neobsahuje žiadne priradenia.");
  }

  const emails = new Set<string>();
  const targets = new Set<string>();
  const assignments = input.assignments.map((rawAssignment, index): EmailAssignmentItem => {
    const assignment = record(rawAssignment, `Priradenie ${index + 1}`);
    const unitNo = text(assignment.unitNo, `Číslo bytu priradenia ${index + 1}`);
    const normalizedEmail = email(assignment.email, `Priradenie ${index + 1}`);
    if (emails.has(normalizedEmail)) throw new Error("Import obsahuje duplicitný e-mail.");
    emails.add(normalizedEmail);

    let owner: EmailAssignmentOwner | null = null;
    if (assignment.owner != null) {
      const rawOwner = record(assignment.owner, `Vlastník priradenia ${index + 1}`);
      owner = {
        first: text(rawOwner.first, `Meno vlastníka priradenia ${index + 1}`),
        last: text(rawOwner.last, `Priezvisko vlastníka priradenia ${index + 1}`),
      };
    }

    const target = owner ? `${unitNo}\u0000${owner.last}\u0000${owner.first}` : `${unitNo}\u0000UNIT`;
    if (targets.has(target)) throw new Error(`Import obsahuje duplicitné priradenie pre byt ${unitNo}.`);
    targets.add(target);
    return { unitNo, email: normalizedEmail, owner };
  });

  assignments.sort((a, b) => {
    const unitOrder = a.unitNo.localeCompare(b.unitNo, "sk", { numeric: true });
    if (unitOrder !== 0) return unitOrder;
    return `${a.owner?.last ?? ""}\u0000${a.owner?.first ?? ""}`.localeCompare(
      `${b.owner?.last ?? ""}\u0000${b.owner?.first ?? ""}`,
      "sk",
    );
  });
  const payload = { buildingEntrance, assignments };
  return {
    payload,
    assignmentCount: assignments.length,
    fingerprint: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
  };
}
