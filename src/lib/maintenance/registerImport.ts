import { createHash } from "node:crypto";

const UNIT_TYPES = ["byt", "nebyt"] as const;
const CO_MODES = ["single", "rep", "internal", "majority", "bsm", "legal"] as const;
const OWNER_ROLES = ["owner", "coowner", "bsm", "proxy", "legal"] as const;

type UnitTypeInput = (typeof UNIT_TYPES)[number];
type CoModeInput = (typeof CO_MODES)[number];
type OwnerRoleInput = (typeof OWNER_ROLES)[number];
type UnknownRecord = Record<string, unknown>;

export interface RegisterImportOwner {
  first: string;
  last: string;
  birthDate: string | null;
  share: number;
  role: OwnerRoleInput;
  email: null;
}

export interface RegisterImportUnit {
  no: string;
  type: UnitTypeInput;
  floor: string;
  label: string;
  coMode: CoModeInput;
  email: null;
  owners: RegisterImportOwner[];
}

export interface RegisterImportPayload {
  buildingEntrance: string;
  units: RegisterImportUnit[];
}

function record(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} má neplatný formát.`);
  return value as UnknownRecord;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} je povinné.`);
  return value.trim();
}

export function matchesRegisterBuilding(
  sourceEntrance: string,
  building: { entrance: string; short: string | null; address: string },
): boolean {
  const source = sourceEntrance.trim();
  if (!source) return false;
  const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const token = new RegExp(`(?:^|\\D)${escaped}(?:\\D|$)`, "u");
  return [building.entrance, building.short, building.address]
    .filter((value): value is string => typeof value === "string")
    .some(value => value.trim() === source || token.test(value));
}

export function validateRegisterImport(value: unknown): {
  payload: RegisterImportPayload;
  unitCount: number;
  ownerCount: number;
  fingerprint: string;
} {
  const input = record(value, "Import");
  const buildingEntrance = text(input.buildingEntrance, "Vchod");
  if (!Array.isArray(input.units) || input.units.length === 0) throw new Error("Import neobsahuje žiadne byty.");

  const seen = new Set<string>();
  const units = input.units.map((rawUnit, unitIndex): RegisterImportUnit => {
    const unit = record(rawUnit, `Byt ${unitIndex + 1}`);
    const no = text(unit.no, `Číslo bytu ${unitIndex + 1}`);
    if (seen.has(no)) throw new Error(`Import obsahuje duplicitné číslo bytu ${no}.`);
    seen.add(no);
    const type = UNIT_TYPES.includes(unit.type as UnitTypeInput) ? unit.type as UnitTypeInput : null;
    const coMode = CO_MODES.includes(unit.coMode as CoModeInput) ? unit.coMode as CoModeInput : null;
    if (!type || !coMode) throw new Error(`Byt ${no} má neplatný typ alebo režim vlastníctva.`);
    if (typeof unit.email === "string" && unit.email.trim()) throw new Error(`E-mail bytu ${no} sa pridá až neskôr.`);
    if (!Array.isArray(unit.owners) || unit.owners.length === 0) throw new Error(`Byt ${no} nemá vlastníka.`);

    const owners = unit.owners.map((rawOwner, ownerIndex): RegisterImportOwner => {
      const owner = record(rawOwner, `Vlastník ${ownerIndex + 1} bytu ${no}`);
      if (typeof owner.email === "string" && owner.email.trim()) throw new Error(`E-mail vlastníka bytu ${no} sa pridá až neskôr.`);
      const share = typeof owner.share === "number" ? owner.share : Number(owner.share);
      if (!Number.isFinite(share) || share <= 0 || share > 1) throw new Error(`Vlastník bytu ${no} má neplatný podiel.`);
      const role = OWNER_ROLES.includes(owner.role as OwnerRoleInput) ? owner.role as OwnerRoleInput : null;
      if (!role) throw new Error(`Vlastník bytu ${no} má neplatnú rolu.`);
      const birthDate = owner.birthDate == null || owner.birthDate === "" ? null : text(owner.birthDate, "Dátum narodenia");
      if (birthDate && !/^\d{2}\.\d{2}\.\d{4}$/.test(birthDate)) throw new Error(`Vlastník bytu ${no} má neplatný dátum narodenia.`);
      return {
        first: text(owner.first, `Meno vlastníka bytu ${no}`),
        last: text(owner.last, `Priezvisko alebo názov vlastníka bytu ${no}`),
        birthDate,
        share,
        role,
        email: null,
      };
    });
    owners.sort((a, b) => `${a.last}\u0000${a.first}`.localeCompare(`${b.last}\u0000${b.first}`, "sk"));

    const total = owners.reduce((sum, owner) => sum + owner.share, 0);
    if (Math.abs(total - 1) > 1e-6) throw new Error(`Podiely vlastníkov bytu ${no} musia spolu tvoriť 100 %.`);
    if (coMode === "single" && owners.length !== 1) throw new Error(`Byt ${no} v režime jediného vlastníka musí mať jednu osobu.`);
    if (coMode === "internal" && owners.length < 2) throw new Error(`Byt ${no} v internom režime musí mať aspoň dvoch spoluvlastníkov.`);
    if (coMode === "bsm" && (owners.length !== 2 || owners.some(owner => owner.role !== "bsm"))) {
      throw new Error(`Byt ${no} v režime BSM musí mať dvoch manželov.`);
    }
    if (coMode === "legal" && (owners.length !== 1 || owners[0].role !== "legal")) {
      throw new Error(`Byt ${no} právnickej osoby má neplatného vlastníka.`);
    }

    return {
      no,
      type,
      floor: text(unit.floor, `Poschodie bytu ${no}`),
      label: text(unit.label, `Podiel spoločných častí bytu ${no}`),
      coMode,
      email: null,
      owners,
    };
  });

  units.sort((a, b) => a.no.localeCompare(b.no, "sk", { numeric: true }));
  const payload = { buildingEntrance, units };
  return {
    payload,
    unitCount: units.length,
    ownerCount: units.reduce((sum, unit) => sum + unit.owners.length, 0),
    fingerprint: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
  };
}
