import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";

const HLASUJME_LOCK_NAMESPACE = 121342447;

function pollLockKey(pollId: string): number {
  return createHash("sha256").update(pollId).digest().readInt32BE(0);
}

export async function acquirePollLock(tx: Prisma.TransactionClient, pollId: string): Promise<void> {
  const key = pollLockKey(pollId);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${HLASUJME_LOCK_NAMESPACE}::integer, ${key}::integer)`;
}
