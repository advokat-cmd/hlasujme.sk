import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { db } from "../src/lib/db";
import { POST } from "../src/app/api/vote/[token]/route";
import { validateVoteToken } from "../src/lib/tokens";

const context = { params: Promise.resolve({ token: "test-token" }) };
const request = (body: unknown) => new Request("https://test.invalid/api/vote/test-token", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// Prisma delegates are proxy properties, so assign the tracked stub directly.
function stubMethod<T extends object, K extends keyof T>(t: TestContext, target: T, key: K, implementation: (...args: never[]) => unknown) {
  const original = target[key];
  const stub = t.mock.fn(implementation);
  target[key] = stub as T[K];
  t.after(() => { target[key] = original; });
  return stub;
}

function tokenFixture() {
  return {
    id: "token", pollId: "poll", unitId: "unit", ownerId: null, usedAt: null,
    expiresAt: new Date(Date.now() + 60000),
    poll: { id: "poll", buildingId: "building", status: "active", startAt: new Date(Date.now() - 60000), endAt: new Date(Date.now() + 60000), questions: [{ no: 1 }], building: { name: "Building" } },
    unit: { id: "unit", no: "1", buildingId: "building", coMode: "single", status: "active", votes: 1, owners: [{ id: "owner", name: "Owner" }], email: null },
  };
}

test("unconfirmed drafts and malformed JSON never reach vote lookup or writes", async t => {
  stubMethod(t, db, "$transaction", async () => ({ count: 1 }));
  const lookup = stubMethod(t, db.voteToken, "findUnique", async () => { throw new Error("Unexpected token lookup"); });
  for (const body of [{ answers: { 1: "agree" }, finalize: false }, { answers: { 1: "agree" } }, null]) {
    const response = await POST(request(body), context);
    assert.equal(response.status, 400);
  }
  const malformed = new Request("https://test.invalid/api/vote/test-token", { method: "POST", body: "{" });
  assert.equal((await POST(malformed, context)).status, 400);
  assert.equal(lookup.mock.callCount(), 0);
});

test("explicit submission records vote and audit together; mutable eligibility is checked under lock", async t => {
  const token = tokenFixture();
  const writes: string[] = [];
  const recordedAt = new Date("2026-09-13T09:00:00Z");
  stubMethod(t, db.voteToken, "findUnique", async () => token);
  const tx = {
    $executeRaw: async () => { writes.push("lock"); },
    voteToken: { findUnique: async () => token, update: async () => { writes.push("used"); return { usedAt: recordedAt }; } },
    vote: { findFirst: async () => null, create: async () => { writes.push("vote"); } },
    auditLog: { findFirst: async () => null, create: async () => { writes.push("audit"); } },
  };
  let transactions = 0;
  stubMethod(t, db, "$transaction", async (callback: (client: unknown) => Promise<unknown>) => {
    transactions++;
    if (transactions % 2 === 1) return { count: 1 };
    return callback(tx);
  });
  const submitted = await POST(request({ answers: { 1: "agree" }, finalize: true }), context);
  assert.equal(submitted.status, 200);
  assert.equal((await submitted.json()).submittedAt, recordedAt.toISOString());
  assert.deepEqual(writes, ["lock", "vote", "used", "lock", "audit"]);
  writes.length = 0;
  tx.voteToken.findUnique = async () => ({ ...token, unit: { ...token.unit, status: "inactive" } });
  assert.equal((await POST(request({ answers: { 1: "agree" }, finalize: true }), context)).status, 409);
  assert.deepEqual(writes, ["lock"]);
});

test("future-start links can show schedule but cannot authorize a vote", async t => {
  const token = tokenFixture();
  token.poll.startAt = new Date(Date.now() + 30000);
  stubMethod(t, db.voteToken, "findUnique", async () => token);
  assert.equal(await validateVoteToken("test-token"), null);
  assert.notEqual(await validateVoteToken("test-token", { allowBeforeStart: true }), null);
  token.poll.status = "closing";
  assert.equal(await validateVoteToken("test-token", { allowBeforeStart: true }), null);
});
