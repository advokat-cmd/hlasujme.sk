import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createHash } from "node:crypto";
import { verifyAuditEntries } from "../src/lib/hashChain";

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

test("legacy genesis compatibility never accepts changed actors or payloads", () => {
  const legacy = { id: "seed", action: "GENESIS", actor: "system", payload: JSON.stringify({ message: "Database initialized and seeded." }),
    prevHash: "0".repeat(64), entryHash: "f4e0c4b22c7a10be14c5c24e6de8a846b7a2d33454790bdde566ee26871536b3", createdAt: new Date("2026-07-19T00:00:00Z") };
  assert.equal(verifyAuditEntries([legacy]), true);
  assert.equal(verifyAuditEntries([{ ...legacy, actor: "attacker" }]), false);
  assert.equal(verifyAuditEntries([{ ...legacy, payload: JSON.stringify({ message: "Changed votes" }) }]), false);
});

test("normally hashed audit entries reject tampering", () => {
  const entry = { id: "entry", action: "GENESIS", actor: "system", payload: "{}", prevHash: "0".repeat(64), entryHash: "", createdAt: new Date("2026-07-19T00:00:00Z") };
  entry.entryHash = createHash("sha256").update(`${entry.prevHash}${entry.action}${entry.actor}${entry.payload}${entry.createdAt.toISOString()}`).digest("hex");
  assert.equal(verifyAuditEntries([entry]), true);
  assert.equal(verifyAuditEntries([{ ...entry, payload: "{\"approved\":true}" }]), false);
});
