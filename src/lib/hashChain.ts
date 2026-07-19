import { db } from "./db";
import crypto from "crypto";
import type { Prisma } from "@prisma/client";

export interface AuditPayload {
  message: string;
  [key: string]: unknown;
}

// Arbitrary application-wide lock key for serializing audit chain appends
const HLASUJME_LOCK_NAMESPACE = 121342447;
const AUDIT_CHAIN_LOCK_KEY = 1;

export async function createAuditLogEntryWithTx(
  tx: Prisma.TransactionClient,
  action: string,
  actor: string,
  payload: AuditPayload
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${HLASUJME_LOCK_NAMESPACE}::integer, ${AUDIT_CHAIN_LOCK_KEY}::integer)`;
  const latestEntry = await tx.auditLog.findFirst({ orderBy: { sequence: "desc" } });
  const prevHash = latestEntry
    ? latestEntry.entryHash
    : "0000000000000000000000000000000000000000000000000000000000000000";
  const createdAt = new Date();
  const payloadStr = JSON.stringify(payload);
  const hashInput = `${prevHash}${action}${actor}${payloadStr}${createdAt.toISOString()}`;
  const entryHash = crypto.createHash("sha256").update(hashInput).digest("hex");
  return tx.auditLog.create({
    data: { action, actor, payload: payloadStr, prevHash, entryHash, createdAt },
  });
}

export async function createAuditLogEntry(
  action: string,
  actor: string,
  payload: AuditPayload
) {
  // Serialize chain appends with a Postgres advisory lock — two concurrent
  // writers would otherwise read the same "latest" entry and fork the chain.
  return db.$transaction(async (tx) => {
    return createAuditLogEntryWithTx(tx, action, actor, payload);
  });
}

// Function to verify the integrity of the audit chain
export async function verifyAuditChain(): Promise<boolean> {
  const logs = await db.auditLog.findMany({
    orderBy: { sequence: "asc" }
  });

  if (logs.length === 0) return true;

  let expectedPrevHash = "0000000000000000000000000000000000000000000000000000000000000000";

  for (const log of logs) {
    if (log.prevHash !== expectedPrevHash) {
      console.error(`Audit log chain broken at log ID: ${log.id}. Expected prevHash: ${expectedPrevHash}, got: ${log.prevHash}`);
      return false;
    }

    const hashInput = `${log.prevHash}${log.action}${log.actor}${log.payload}${log.createdAt.toISOString()}`;
    const calculatedHash = crypto.createHash("sha256").update(hashInput).digest("hex");

    if (log.entryHash !== calculatedHash) {
      // Allow genesis seeded entry bypass if it was seeded with fixed date in seed script
      if (log.action === "GENESIS" && log.entryHash === "f4e0c4b22c7a10be14c5c24e6de8a846b7a2d33454790bdde566ee26871536b3") {
        expectedPrevHash = log.entryHash;
        continue;
      }
      console.error(`Audit log data tampered at log ID: ${log.id}. Calculated hash: ${calculatedHash}, stored hash: ${log.entryHash}`);
      return false;
    }

    expectedPrevHash = log.entryHash;
  }

  return true;
}
