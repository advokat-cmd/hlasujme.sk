import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { assertSafeDestructiveDatabase } from "../../scripts/check-db-boundary";
import { parseSealedSnapshot, sha256Hex } from "../../src/lib/seal";
import { getStorageRoot, resolveStoragePath } from "../../src/lib/storage";

const baseUrl = process.env.INTEGRATION_BASE_URL;

test("draft publication, register locking and immutable closure through HTTP", { skip: !baseUrl }, async (t) => {
  assertSafeDestructiveDatabase();
  assert.ok(baseUrl);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseUrl).hostname));
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname));
  assert.match(process.env.EMAIL_API_KEY ?? "", /^(re|pm)_mock_/);
  const db = new PrismaClient();
  const suffix = randomUUID();
  const polls: string[] = [];
  const accounts: string[] = [];
  const units: string[] = [];
  const ownedBuildings: string[] = [];
  const sealedFiles: string[] = [];
  let activePollId = "";
  const docIds: string[] = [];

  async function accountCookie(role: string, unitId?: string) {
    const account = await db.admin.create({ data: { email: `${randomUUID()}@example.test`, name: "Test Administrator", role, passwordHash: "unused-fixture-password", unitId } });
    accounts.push(account.id);
    const token = randomBytes(32).toString("base64url");
    await db.adminSession.create({ data: { adminId: account.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3600000) } });
    return `hlasovanie_session=${token}`;
  }
  async function jsonRequest(route: string, cookie: string, body: unknown = {}, method = "POST") {
    return fetch(`${baseUrl}${route}`, { method, headers: { cookie, "Content-Type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(body), redirect: "manual" });
  }
  async function upload(pollId: string, cookie: string) {
    const form = new FormData();
    form.set("file", new File(["%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF"], "test.pdf", { type: "application/pdf" }));
    form.set("questionNo", "1");
    return fetch(`${baseUrl}/api/admin/poll/${pollId}/upload`, { method: "POST", headers: { cookie }, body: form });
  }
  const fileCount = (pollId: string) => {
    const dir = path.join(getStorageRoot(), "uploads", pollId);
    return existsSync(dir) ? readdirSync(dir).length : 0;
  };

  try {
    let building = await db.building.findFirst();
    if (!building) {
      building = await db.building.create({ data: { name: `Lifecycle ${suffix}`, address: "Test", entrance: "1", manager: "Test", contact: "Test", contactEmail: "test@example.test" } });
      ownedBuildings.push(building.id);
    }
    assert.equal(await db.poll.count({ where: { buildingId: building.id, status: { in: ["active", "closing"] } } }), 0, "The first building must have no unrelated running poll");
    const unit = await db.unit.create({ data: { buildingId: building.id, no: `test-${suffix}`, type: "byt", floor: "1", email: `owner-${suffix}@example.test`, coMode: "single", owners: { create: { first: "Original", last: "Owner", name: "Original Owner", share: 1, email: `owner-${suffix}@example.test` } } }, include: { owners: true } });
    units.push(unit.id);
    const adminCookie = await accountCookie("superadmin");
    const ownerCookie = await accountCookie("vlastnik", unit.id);
    const foreignBuilding = await db.building.create({ data: { name: `Foreign ${suffix}`, address: "Test", entrance: "2", manager: "Test", contact: "Test", contactEmail: "test@example.test" } });
    ownedBuildings.push(foreignBuilding.id);
    const foreignUnit = await db.unit.create({ data: { buildingId: foreignBuilding.id, no: "1", type: "byt", floor: "1", coMode: "single" } });
    units.push(foreignUnit.id);
    const foreignCookie = await accountCookie("vlastnik", foreignUnit.id);
    const body = {
      basics: { title: `Lifecycle ${suffix}`, reason: "Integration test", start: new Date(Date.now() - 60000).toISOString(), end: new Date(Date.now() + 3600000).toISOString() },
      questions: [{ text: "Schvaľujete testovací návrh?", majority: "half-all" }],
    };
    const owner = unit.owners[0];
    let unitPayload = { no: unit.no, type: unit.type, floor: unit.floor, email: unit.email, coMode: unit.coMode, owners: [{ id: owner.id, first: owner.first, last: owner.last, share: owner.share, role: owner.role, email: owner.email }] };

    await t.test("creation makes drafts without voting tokens or premature publication", async () => {
      const responses = await Promise.all([jsonRequest("/api/admin/poll", adminCookie, body), jsonRequest("/api/admin/poll", adminCookie, body)]);
      for (const response of responses) {
        const result = await response.json();
        assert.equal(response.status, 200, JSON.stringify(result));
        polls.push(result.pollId);
        assert.equal(result.status, "draft");
        assert.equal(await db.voteToken.count({ where: { pollId: result.pollId } }), 0);
      }
    });
    await t.test("draft upload is saved and attached to the selected question", async () => {
      const result = await upload(polls[0], adminCookie);
      const body = await result.json();
      assert.equal(result.status, 200, JSON.stringify(body));
      docIds.push(body.document.id);
      const question = await db.question.findUniqueOrThrow({ where: { pollId_no: { pollId: polls[0], no: 1 } } });
      assert.deepEqual(question.attachments, [`/api/document/${body.document.id}`]);
      assert.equal((await jsonRequest(`/api/admin/poll/${polls[0]}/files`, ownerCookie, undefined, "GET")).status, 200);
      assert.equal((await jsonRequest(`/api/admin/poll/${polls[0]}/files`, foreignCookie, undefined, "GET")).status, 403);
    });
    await t.test("concurrent publication permits only one running poll per building", async () => {
      const responses = await Promise.all(polls.map(pollId => jsonRequest(`/api/admin/poll/${pollId}/activate`, adminCookie)));
      assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
      activePollId = polls[responses.findIndex(response => response.status === 200)];
      const state = await db.poll.findUniqueOrThrow({ where: { id: activePollId } });
      assert.equal(state.status, "active");
      assert.ok(await db.voteToken.count({ where: { pollId: activePollId, unitId: unit.id } }) > 0);
      assert.equal(await db.poll.count({ where: { buildingId: building.id, status: "active" } }), 1);
    });
    await t.test("active poll freezes electorate fields but permits email corrections", async () => {
      const structural = await jsonRequest(`/api/admin/unit/${unit.id}`, adminCookie, { ...unitPayload, no: unit.no + "-changed" }, "PUT");
      assert.equal(structural.status, 409, await structural.text());
      const email = `corrected-${suffix}@example.test`;
      unitPayload = { ...unitPayload, email, owners: [{ ...unitPayload.owners[0], email }] };
      const allowed = await jsonRequest(`/api/admin/unit/${unit.id}`, adminCookie, unitPayload, "PUT");
      assert.equal(allowed.status, 200, await allowed.text());
      assert.equal((await db.unit.findUniqueOrThrow({ where: { id: unit.id } })).email, email);
      const before = fileCount(activePollId);
      assert.equal((await upload(activePollId, adminCookie)).status, 409);
      assert.equal(fileCount(activePollId), before, "Rejected uploads must not leave orphan files");
    });
    await t.test("concurrent close seals once and produces matching PDF and snapshot hashes", async () => {
      await db.vote.create({ data: { pollId: activePollId, unitId: unit.id, questionNo: 1, answer: "agree" } });
      const responses = await Promise.all([jsonRequest(`/api/admin/poll/${activePollId}/close`, adminCookie), jsonRequest(`/api/admin/poll/${activePollId}/close`, adminCookie)]);
      const payloads = await Promise.all(responses.map(response => response.json()));
      assert.deepEqual(responses.map(response => response.status), [200, 200], JSON.stringify(payloads));
      assert.equal(payloads[0].sha256, payloads[1].sha256);
      assert.equal(payloads[0].resultSha256, payloads[1].resultSha256);
      assert.equal(await db.sealedResult.count({ where: { pollId: activePollId } }), 1);
      const seal = await db.sealedResult.findUniqueOrThrow({ where: { pollId: activePollId } });
      sealedFiles.push(resolveStoragePath(seal.pdfPath));
      assert.equal(sha256Hex(readFileSync(sealedFiles[0])), seal.sha256);
      assert.equal(sha256Hex(seal.resultJson), seal.resultSha256);
      assert.equal((await db.poll.findUniqueOrThrow({ where: { id: activePollId } })).status, "closed");
    });
    await t.test("closed results and documents stay fixed after the register changes", async () => {
      const before = await db.sealedResult.findUniqueOrThrow({ where: { pollId: activePollId } });
      const change = await jsonRequest(`/api/admin/unit/${unit.id}`, adminCookie, { ...unitPayload, owners: [{ ...unitPayload.owners[0], first: "Changed" }] }, "PUT");
      assert.equal(change.status, 200, await change.text());
      const after = await db.sealedResult.findUniqueOrThrow({ where: { pollId: activePollId } });
      assert.equal(after.resultJson, before.resultJson);
      assert.equal(after.sha256, before.sha256);
      const snapshot = parseSealedSnapshot(after.resultJson, after.resultSha256);
      assert.equal(snapshot?.units.find(candidate => candidate.id === unit.id)?.owners[0].name, "Original Owner");
      const beforeFiles = fileCount(activePollId);
      assert.equal((await upload(activePollId, adminCookie)).status, 409);
      assert.equal(fileCount(activePollId), beforeFiles);
    });
  } finally {
    await db.admin.deleteMany({ where: { id: { in: accounts } } });
    await db.poll.deleteMany({ where: { id: { in: polls } } });
    await db.unit.deleteMany({ where: { id: { in: units } } });
    await db.building.deleteMany({ where: { id: { in: ownedBuildings } } });
    await db.$disconnect();
    for (const pollId of polls) {
      const directory = path.resolve(getStorageRoot(), "uploads", pollId);
      assert.equal(path.dirname(directory), path.resolve(getStorageRoot(), "uploads"));
      rmSync(directory, { recursive: true, force: true });
    }
    for (const file of sealedFiles) rmSync(file, { force: true });
  }
});
