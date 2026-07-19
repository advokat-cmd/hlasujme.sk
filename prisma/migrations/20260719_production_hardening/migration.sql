SET search_path TO hlasujme;

DO $$ BEGIN
  IF current_schema() <> 'hlasujme' THEN
    RAISE EXCEPTION 'Refusing migration outside schema hlasujme';
  END IF;
END $$;

ALTER TYPE "hlasujme"."PollStatus" ADD VALUE IF NOT EXISTS 'closing';

ALTER TABLE "hlasujme"."AuditLog"
  ADD COLUMN IF NOT EXISTS "sequence" BIGSERIAL;
CREATE UNIQUE INDEX IF NOT EXISTS "AuditLog_sequence_key"
  ON "hlasujme"."AuditLog"("sequence");

ALTER TABLE "hlasujme"."SealedResult"
  ADD COLUMN IF NOT EXISTS "resultSha256" TEXT;

CREATE TABLE IF NOT EXISTS "hlasujme"."AdminSession" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId")
    REFERENCES "hlasujme"."Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdminSession_tokenHash_key"
  ON "hlasujme"."AdminSession"("tokenHash");
CREATE INDEX IF NOT EXISTS "AdminSession_adminId_expiresAt_idx"
  ON "hlasujme"."AdminSession"("adminId", "expiresAt");

CREATE TABLE IF NOT EXISTS "hlasujme"."RateLimitBucket" (
  "action" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("action", "key", "windowStart")
);
CREATE INDEX IF NOT EXISTS "RateLimitBucket_expiresAt_idx"
  ON "hlasujme"."RateLimitBucket"("expiresAt");

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "hlasujme"."Poll"
    WHERE "status"::text IN ('active', 'closing')
    GROUP BY "buildingId" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Multiple active polls exist; resolve them before hardening migration';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Poll_one_open_per_building_key"
  ON "hlasujme"."Poll"("buildingId")
  WHERE "status"::text IN ('active', 'closing');
