import { db } from "./db";
import crypto from "crypto";
import { PollStatus, type Prisma } from "@prisma/client";

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface GeneratedTokenInfo {
  unitId: string;
  unitNo: string;
  ownerId: string | null;
  ownerName: string | null;
  email: string;
  token: string;
}

export function isPollOpen(
  poll: { status: string; startAt: Date; endAt: Date },
  now = new Date()
): boolean {
  return poll.status === PollStatus.active && poll.startAt <= now && poll.endAt >= now;
}

export async function generateVoteTokens(pollId: string, client: Prisma.TransactionClient = db): Promise<GeneratedTokenInfo[]> {
  const poll = await client.poll.findUnique({
    where: { id: pollId },
    include: { building: { include: { units: { include: { owners: true } } } } }
  });

  if (!poll) {
    throw new Error(`Poll ${pollId} not found`);
  }

  const tokenInfos: GeneratedTokenInfo[] = [];

  for (const unit of poll.building.units) {
    if (unit.status !== "active") continue;

    if (unit.coMode === "internal") {
      // Internal voting: generate token for each co-owner separately
      for (const owner of unit.owners) {
        const email = owner.email || unit.email;
        if (!email) continue; // Skip if no email is available anywhere

        const plainToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = hashToken(plainToken);

        await client.voteToken.create({
          data: {
            pollId,
            unitId: unit.id,
            ownerId: owner.id,
            tokenHash,
            expiresAt: poll.endAt
          }
        });

        tokenInfos.push({
          unitId: unit.id,
          unitNo: unit.no,
          ownerId: owner.id,
          ownerName: owner.name,
          email,
          token: plainToken
        });
      }
    } else {
      // Other coModes: single token per unit
      const email = unit.email;
      if (!email) continue; // Skip if no email is available (e.g. Unit 8)

      const plainToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(plainToken);

      await client.voteToken.create({
        data: {
          pollId,
          unitId: unit.id,
          ownerId: null,
          tokenHash,
          expiresAt: poll.endAt
        }
      });

      // Name of primary owner or representative
      let ownerName: string | null = null;
      if (unit.coMode === "rep" && unit.actingPerson) {
        ownerName = unit.actingPerson;
      } else if (unit.owners.length > 0) {
        ownerName = unit.owners[0].name;
      }

      tokenInfos.push({
        unitId: unit.id,
        unitNo: unit.no,
        ownerId: null,
        ownerName,
        email,
        token: plainToken
      });
    }
  }

  return tokenInfos;
}

/** A token must still address the same eligible unit and voting mode. */
export function isEligibleVoteTokenTarget(token: {
  ownerId: string | null;
  poll: { buildingId: string };
  unit: { buildingId: string; status: string; votes: number; coMode: string; owners: Array<{ id: string }> };
}): boolean {
  const { unit, poll, ownerId } = token;
  if (unit.buildingId !== poll.buildingId || unit.status !== "active" || !Number.isSafeInteger(unit.votes) || unit.votes <= 0) return false;
  return unit.coMode === "internal"
    ? Boolean(ownerId && unit.owners.some(owner => owner.id === ownerId))
    : ownerId === null;
}

export async function validateVoteToken(plainToken: string, options?: { allowBeforeStart?: boolean }) {
  if (!plainToken) return null;
  const tokenHash = hashToken(plainToken);

  const tokenRecord = await db.voteToken.findUnique({
    where: { tokenHash },
    include: {
      poll: {
        include: {
          building: true,
          questions: { orderBy: { no: "asc" } },
        }
      },
      unit: {
        include: { owners: true }
      }
    }
  });

  if (!tokenRecord) return null;

  const now = new Date();
  const poll = tokenRecord.poll;

  // Verify that the token has not expired and the poll is active
  const withinWindow = options?.allowBeforeStart
    ? poll.status === PollStatus.active && poll.endAt >= now
    : isPollOpen(poll, now);
  if (tokenRecord.expiresAt < now || !withinWindow) {
    return null;
  }
  if (!isEligibleVoteTokenTarget(tokenRecord)) {
    return null;
  }

  let owner = null;
  if (tokenRecord.ownerId) {
    owner = tokenRecord.unit.owners.find(o => o.id === tokenRecord.ownerId) || null;
    if (!owner) return null;
  }

  return {
    tokenRecord,
    poll,
    unit: tokenRecord.unit,
    owner
  };
}
