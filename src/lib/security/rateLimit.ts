import { createHash } from "node:crypto";
import { db } from "../db";

export interface RateLimitRequest {
  action: string;
  key: string;
  limit: number;
  windowMs: number;
}

export function privateRateLimitKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function consumeRateLimit(input: RateLimitRequest): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  if (!input.action || !input.key || !Number.isInteger(input.limit) || input.limit < 1 || input.windowMs < 1000) {
    throw new Error("Neplatná konfigurácia rate limitu.");
  }
  const nowMs = Date.now();
  const windowStart = new Date(Math.floor(nowMs / input.windowMs) * input.windowMs);
  const expiresAt = new Date(windowStart.getTime() + input.windowMs);

  const bucket = await db.$transaction(async (tx) => {
    await tx.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date(nowMs - input.windowMs) } } });
    return tx.rateLimitBucket.upsert({
      where: { action_key_windowStart: { action: input.action, key: input.key, windowStart } },
      create: { action: input.action, key: input.key, windowStart, expiresAt, count: 1 },
      update: { count: { increment: 1 }, expiresAt },
    });
  });
  return {
    allowed: bucket.count <= input.limit,
    retryAfterSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - nowMs) / 1000)),
  };
}
