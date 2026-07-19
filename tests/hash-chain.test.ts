import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("audit chain uses deterministic sequence ordering", () => {
  const source = readFileSync("src/lib/hashChain.ts", "utf8");
  assert.match(source, /orderBy:\s*\{\s*sequence:\s*"desc"/);
  assert.match(source, /orderBy:\s*\{\s*sequence:\s*"asc"/);
});

test("two-key advisory locks cast Prisma parameters to PostgreSQL int4", () => {
  const auditSource = readFileSync("src/lib/hashChain.ts", "utf8");
  const pollSource = readFileSync("src/lib/pollLock.ts", "utf8");
  assert.match(auditSource, /pg_advisory_xact_lock\([\s\S]*::integer[\s\S]*::integer/);
  assert.match(pollSource, /pg_advisory_xact_lock\([\s\S]*::integer[\s\S]*::integer/);
});
