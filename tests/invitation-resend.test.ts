import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import test, { type TestContext } from "node:test";
import { db } from "../src/lib/db";
import { hashToken, validateVoteToken } from "../src/lib/tokens";
import { POST } from "../src/app/api/admin/poll/[id]/resend/route";

const nextHeaders = createRequire(import.meta.url)("next/headers") as typeof import("next/headers");

function stubMethod<T extends object, K extends keyof T>(t: TestContext, target: T, key: K, implementation: (...args: never[]) => unknown) {
  const original = target[key];
  const stub = t.mock.fn(implementation);
  target[key] = stub as T[K];
  t.after(() => { target[key] = original; });
  return stub;
}

type Token = { id: string; pollId: string; unitId: string; ownerId: string | null; tokenHash: string; expiresAt: Date; createdAt: Date; usedAt: Date | null };
type TokenWhere = { id?: string | { in: string[] }; tokenHash?: string; pollId?: string; unitId?: string; ownerId?: string | null };

function fixture(t: TestContext, accepted: boolean) {
  const env = process.env as Record<string, string | undefined>;
  const previous = { NODE_ENV: env.NODE_ENV, EMAIL_PROVIDER: env.EMAIL_PROVIDER, EMAIL_API_KEY: env.EMAIL_API_KEY, NEXT_PUBLIC_BASE_URL: env.NEXT_PUBLIC_BASE_URL };
  Object.assign(env, { NODE_ENV: "production", EMAIL_PROVIDER: "resend", EMAIL_API_KEY: "synthetic-key-never-used-on-network", NEXT_PUBLIC_BASE_URL: "https://test.invalid" });
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  });
  t.mock.method(console, "error", () => {});
  const poll = { id: "poll", buildingId: "building", status: "active", title: "Test", reason: "Test", startAt: new Date(Date.now() - 60000), endAt: new Date(Date.now() + 3600000), questions: [{ no: 1 }], building: { name: "Test building" } };
  const unit = { id: "unit", buildingId: "building", no: "1", coMode: "internal", status: "active", votes: 1, email: "shared@example.test", actingPerson: null, owners: [{ id: "owner-a", name: "Owner A", email: "shared@example.test" }, { id: "owner-b", name: "Owner B", email: "shared@example.test" }] };
  const tokens = new Map<string, Token>();
  for (const [id, ownerId, plain] of [["original-a", "owner-a", "older-a-link"], ["original-b", "owner-b", "older-b-link"]]) {
    tokens.set(id, { id, pollId: poll.id, unitId: unit.id, ownerId, tokenHash: hashToken(plain), expiresAt: poll.endAt, createdAt: new Date(), usedAt: null });
  }
  const matches = (token: Token, where: TokenWhere) => Object.entries(where).every(([key, value]) => {
    if (key === "id" && typeof value === "object" && value !== null) return value.in.includes(token.id);
    return token[key as keyof Token] === value;
  });
  const tokenMethods = {
    findMany: async ({ where }: { where: TokenWhere }) => [...tokens.values()].filter(token => matches(token, where)),
    findUnique: async ({ where }: { where: TokenWhere }) => {
      const token = [...tokens.values()].find(token => matches(token, where));
      return token ? { ...token, poll, unit } : null;
    },
    create: async ({ data }: { data: Omit<Token, "id" | "createdAt" | "usedAt"> }) => {
      const token = { ...data, id: randomUUID(), createdAt: new Date(), usedAt: null };
      tokens.set(token.id, token);
      return token;
    },
    deleteMany: async ({ where }: { where: TokenWhere }) => {
      let count = 0;
      for (const [id, token] of tokens) if (matches(token, where)) { tokens.delete(id); count++; }
      return { count };
    },
  };
  let locks = 0;
  const audits: unknown[] = [];
  const tx = {
    $executeRaw: async () => { locks++; },
    poll: { findUnique: async () => poll },
    voteToken: tokenMethods,
    auditLog: { findFirst: async () => null, create: async ({ data }: { data: unknown }) => { audits.push(data); return data; } },
  };
  stubMethod(t, nextHeaders, "cookies", async () => ({ get: () => ({ value: "synthetic-admin-session" }) }));
  stubMethod(t, db.adminSession, "findUnique", async () => ({ id: "session", revokedAt: null, expiresAt: new Date(Date.now() + 3600000), admin: { id: "admin", role: "admin", email: "admin@example.test", name: "Test admin", unitId: null } }));
  stubMethod(t, db.poll, "findUnique", async () => poll);
  stubMethod(t, db.unit, "findFirst", async () => unit);
  stubMethod(t, db.emailTemplate, "findUnique", async () => null);
  stubMethod(t, db.voteToken, "findMany", tokenMethods.findMany);
  stubMethod(t, db.voteToken, "findUnique", tokenMethods.findUnique);
  stubMethod(t, db.voteToken, "create", tokenMethods.create);
  stubMethod(t, db.voteToken, "deleteMany", tokenMethods.deleteMany);
  stubMethod(t, db, "$transaction", async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
  const captured: { to: string[]; html: string }[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    captured.push(JSON.parse(String(options.body)));
    if (!accepted) throw new TypeError("Simulated lost response after provider acceptance");
    return Response.json({ id: "synthetic-provider-message" });
  });
  const resend = (ownerId: string | undefined = "owner-a", email = unit.email) => POST(new Request("https://test.invalid/api/admin/poll/poll/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unitNo: unit.no, email, ownerId }) }), { params: Promise.resolve({ id: poll.id }) });
  const newPlainToken = () => {
    assert.equal(captured.length, 1);
    const match = captured[0].html.match(/https:\/\/test\.invalid\/hlasuj\/([a-f0-9]{64})/);
    assert.ok(match, "The actual invitation template must contain the new link");
    return match[1];
  };
  return { poll, unit, tokens, captured, audits, resend, newPlainToken, locks: () => locks, tx };
}

for (const accepted of [true, false]) {
  test(`resend preserves older and new owner-scoped links when ${accepted ? "accepted" : "provider acceptance is uncertain"}`, async t => {
    const f = fixture(t, accepted);
    const originals = [...f.tokens.values()].map(token => ({ ...token }));
    const response = await f.resend();
    assert.equal(response.status, accepted ? 200 : 500);
    if (!accepted) assert.match((await response.json()).error, /nepodarilo potvrdiť/);
    assert.equal(f.tokens.size, 3);
    for (const token of originals) assert.deepEqual(f.tokens.get(token.id), token);
    assert.ok(f.locks() >= 1, "Creation must revalidate under the poll lock");
    const older = await validateVoteToken("older-a-link");
    const fresh = await validateVoteToken(f.newPlainToken());
    const otherOwner = await validateVoteToken("older-b-link");
    assert.equal(older?.owner?.id, "owner-a");
    assert.equal(fresh?.owner?.id, "owner-a");
    assert.equal(otherOwner?.owner?.id, "owner-b");
    assert.deepEqual(f.captured[0].to, ["shared@example.test"]);
    assert.equal(f.audits.length, accepted ? 1 : 0, "Unconfirmed sends must not be logged as accepted");

    f.poll.status = "closed";
    assert.equal(await validateVoteToken("older-a-link"), null);
    assert.equal(await validateVoteToken(f.newPlainToken()), null);
    f.poll.status = "active";
    f.poll.endAt = new Date(Date.now() - 1000);
    assert.equal(await validateVoteToken("older-a-link"), null);
    assert.equal(await validateVoteToken(f.newPlainToken()), null);
    f.poll.endAt = new Date(Date.now() + 3600000);
    f.tokens.delete("original-a");
    assert.equal(await validateVoteToken("older-a-link"), null, "An explicitly revoked token remains invalid");
    assert.notEqual(await validateVoteToken(f.newPlainToken()), null);
  });
}

test("resend rejects a foreign owner, wrong email and ambiguous shared-address recipient", async t => {
  const f = fixture(t, true);
  assert.equal((await f.resend("foreign-owner")).status, 404);
  assert.equal((await f.resend("owner-a", "someone-else@example.test")).status, 404);
  assert.equal((await f.resend("")).status, 409);
  assert.equal(f.tokens.size, 2);
  assert.equal(f.captured.length, 0);
});

test("resend rechecks poll status under lock before creating another link", async t => {
  const f = fixture(t, true);
  f.tx.poll.findUnique = async () => ({ ...f.poll, status: "closed" });
  assert.equal((await f.resend()).status, 409);
  assert.equal(f.tokens.size, 2);
  assert.equal(f.captured.length, 0);
});
