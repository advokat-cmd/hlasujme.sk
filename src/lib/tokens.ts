import { db } from "./db";
import crypto from "crypto";
import { PollStatus } from "@prisma/client";

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

export async function generateVoteTokens(pollId: string): Promise<GeneratedTokenInfo[]> {
  const poll = await db.poll.findUnique({
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

        await db.voteToken.create({
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

      await db.voteToken.create({
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

export async function validateVoteToken(plainToken: string) {
  if (!plainToken) return null;
  const tokenHash = hashToken(plainToken);

  const tokenRecord = await db.voteToken.findUnique({
    where: { tokenHash },
    include: {
      poll: {
        include: { questions: { orderBy: { no: "asc" } } }
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
  if (tokenRecord.expiresAt < now || poll.status !== PollStatus.active) {
    return null;
  }

  // Verify currently within poll time window
  if (poll.startAt > now || poll.endAt < now) {
    return null;
  }

  let owner = null;
  if (tokenRecord.ownerId) {
    owner = tokenRecord.unit.owners.find(o => o.id === tokenRecord.ownerId) || null;
  }

  return {
    tokenRecord,
    poll,
    unit: tokenRecord.unit,
    owner
  };
}
