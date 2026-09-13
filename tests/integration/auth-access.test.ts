import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import * as argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { assertSafeDestructiveDatabase } from "../../scripts/check-db-boundary";
import { getStorageRoot } from "../../src/lib/storage";

// Opt in only against a local app using the same disposable database and storage.
const baseUrl = process.env.INTEGRATION_BASE_URL;

test("auth and document authorization use actual route handlers", { skip: !baseUrl }, async (t) => {
  assertSafeDestructiveDatabase();
  assert.ok(baseUrl);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseUrl).hostname));
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname));
  const db = new PrismaClient();
  const suffix = randomUUID();
  const buildingIds: string[] = [];
  const accountIds: string[] = [];
  const fixtureDirectory = path.join(getStorageRoot(), `auth-test-${suffix}`);
  mkdirSync(fixtureDirectory, { recursive: true });
  const password = "test-password-long-enough";
  const passwordHash = await argon2.hash(password);
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");

  async function createAccount(role: string, unitId: string | null = null) {
    const account = await db.admin.create({ data: { email: `${randomUUID()}@example.test`, name: "Test owner", passwordHash, role, unitId } });
    accountIds.push(account.id);
    const token = randomBytes(32).toString("base64url");
    await db.adminSession.create({ data: { adminId: account.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 3600000) } });
    return { account, cookie: `hlasovanie_session=${token}` };
  }

  async function request(route: string, cookie?: string, body?: unknown) {
    return fetch(`${baseUrl}${route}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
  }

  try {
    for (const name of ["A", "B"]) {
      const building = await db.building.create({ data: { name: `Test ${name} ${suffix}`, address: "Test", entrance: "1", manager: "Test", contact: "Test", contactEmail: "test@example.test" } });
      buildingIds.push(building.id);
    }
    const unit = await db.unit.create({ data: { no: "1", type: "byt", floor: "1", coMode: "single", buildingId: buildingIds[0] } });
    const owner = await createAccount("vlastnik", unit.id);
    const admin = await createAccount("admin");
    const unknownRole = await createAccount("viewer", unit.id);
    const makePoll = (buildingId: string) => db.poll.create({ data: { buildingId, title: "Test", reason: "Test", declarer: "Test", announcedAt: new Date(), startAt: new Date(Date.now() + 3600000), endAt: new Date(Date.now() + 7200000), status: "active" } });
    const ownPoll = await makePoll(buildingIds[0]);
    const foreignPoll = await makePoll(buildingIds[1]);
    writeFileSync(path.join(fixtureDirectory, "material.txt"), "test supporting material");
    const localPath = `auth-test-${suffix}/material.txt`;
    const makeDocument = (pollId: string) => db.pollDocument.create({ data: { pollId, name: "material.txt", mimeType: "text/plain", localPath } });
    const ownDocument = await makeDocument(ownPoll.id);
    const foreignDocument = await makeDocument(foreignPoll.id);

    await t.test("documents require an allowed role and matching owner building", async () => {
      assert.equal((await request(`/api/document/${ownDocument.id}`)).status, 403);
      const allowed = await request(`/api/document/${ownDocument.id}`, owner.cookie);
      assert.equal(allowed.status, 200);
      assert.equal(await allowed.text(), "test supporting material");
      assert.equal((await request(`/api/document/${foreignDocument.id}`, owner.cookie)).status, 403);
      assert.equal((await request(`/api/document/${foreignDocument.id}`, admin.cookie)).status, 200);
      assert.equal((await request(`/api/document/${ownDocument.id}`, unknownRole.cookie)).status, 403);
    });

    await t.test("an invited voter can read pre-start materials only for the token's poll", async () => {
      const token = randomBytes(32).toString("hex");
      await db.voteToken.create({ data: { pollId: ownPoll.id, unitId: unit.id, tokenHash: hash(token), expiresAt: ownPoll.endAt } });
      assert.equal((await request(`/api/document/${ownDocument.id}?token=${token}`)).status, 200);
      assert.equal((await request(`/api/document/${foreignDocument.id}?token=${token}`)).status, 403);
    });

    await t.test("malformed password changes fail without revoking a valid session", async () => {
      for (const body of [null, { oldPassword: {}, newPassword: "long-new-password" }, { oldPassword: password, newPassword: "x".repeat(4097) }]) {
        assert.equal((await request("/api/auth/change-password", owner.cookie, body)).status, 400);
      }
      assert.equal((await request(`/api/document/${ownDocument.id}`, owner.cookie)).status, 200);
    });

    await t.test("changing a password revokes all sessions and stores a usable new password", async () => {
      const newPassword = "long-new-test-password";
      assert.equal((await request("/api/auth/change-password", owner.cookie, { oldPassword: password, newPassword })).status, 200);
      assert.equal((await request(`/api/document/${ownDocument.id}`, owner.cookie)).status, 403);
      assert.equal(await db.adminSession.count({ where: { adminId: owner.account.id, revokedAt: null } }), 0);
      const changed = await db.admin.findUniqueOrThrow({ where: { id: owner.account.id } });
      assert.equal(await argon2.verify(changed.passwordHash, newPassword), true);
    });

    await t.test("refreshing an administrator's credentials preserves its role", async () => {
      // This path sends mail: permit it only with an explicitly mocked local provider.
      assert.match(process.env.EMAIL_API_KEY ?? "", /^(re|pm)_mock_/);
      const superadmin = await createAccount("superadmin", unit.id);
      const ownerRecord = await db.owner.create({ data: { first: "Test", last: "Administrator", name: "Test Administrator", email: superadmin.account.email, unitId: unit.id } });
      await db.admin.update({ where: { id: superadmin.account.id }, data: { ownerId: ownerRecord.id } });
      const result = await request(`/api/admin/unit/${unit.id}/owner/${ownerRecord.id}/send-credentials`, superadmin.cookie, {});
      assert.equal(result.status, 200, await result.text());
      const account = await db.admin.findUniqueOrThrow({ where: { id: superadmin.account.id } });
      assert.equal(account.role, "superadmin");
      assert.notEqual(account.passwordHash, passwordHash);
    });
  } finally {
    await db.admin.deleteMany({ where: { id: { in: accountIds } } });
    await db.building.deleteMany({ where: { id: { in: buildingIds } } });
    await db.$disconnect();
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});
