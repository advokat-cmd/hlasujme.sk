import type { Prisma } from "@prisma/client";
import { acquirePollLock } from "./pollLock";

export class PollConflict extends Error {}

/** Serializes publication with changes to the building's electorate. */
export async function lockBuilding(tx: Prisma.TransactionClient, buildingId: string) {
  await acquirePollLock(tx, `building:${buildingId}`);
}

export async function assertNoRunningPoll(tx: Prisma.TransactionClient, buildingId: string) {
  const running = await tx.poll.findFirst({
    where: { buildingId, status: { in: ["active", "closing"] } },
    select: { id: true },
  });
  if (running) throw new PollConflict("Pre tento dom prebiehajú hlasovania. Najprv ich všetky uzavrite; dovtedy nemožno meniť zloženie vlastníkov ani hlasovacie podiely.");
}

type ElectorateOwner = { id?: string; first: string; last: string; share: number; role: string };
type ElectorateUnit = { no: string; type: string; coMode: string; owners: ElectorateOwner[] };

export function electorateChanged(current: ElectorateUnit, next: ElectorateUnit): boolean {
  if (current.no !== next.no || current.type !== next.type || current.coMode !== next.coMode) return true;
  if (current.owners.length !== next.owners.length) return true;
  return next.owners.some(owner => {
    const existing = current.owners.find(candidate => candidate.id === owner.id);
    return !owner.id || !existing || existing.first !== owner.first || existing.last !== owner.last || existing.share !== owner.share || existing.role !== owner.role;
  });
}
