import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient, type Prisma } from "@prisma/client";
import { assertSafeDestructiveDatabase } from "../../scripts/check-db-boundary";
import { lockBuilding } from "../../src/lib/pollLifecycle";

const baseUrl = process.env.INTEGRATION_BASE_URL;

test("publication and invitation rotation serialize concurrent requests", { skip: !baseUrl }, async (t) => {
  assertSafeDestructiveDatabase();
  assert.ok(baseUrl);
  const databaseUrl = new URL(process.env.DATABASE_URL!);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseUrl).hostname));
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(databaseUrl.hostname));
  assert.match(process.env.EMAIL_API_KEY ?? "", /^(re|pm)_mock_/);
  const schema = databaseUrl.searchParams.get("schema")!;
  assert.match(schema, /^hlasujme_test_[a-z0-9_]+$/);
  const db = new PrismaClient();
  const suffix = randomUUID();
  const releases: Array<() => Promise<void>> = [];
  let buildingId = "";
  let adminId = "";
  const hash = (token: string) => createHash("sha256").update(token).digest("hex");

  async function waitUntil(check: () => Promise<boolean>, message: string) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (await check()) return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.fail(message);
  }
  async function advisoryWaiters(key: string) {
    const lockKey = createHash("sha256").update(key).digest().readUInt32BE(0);
    const rows = await db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND classid::bigint = 121342447 AND objid::bigint = ${BigInt(lockKey)} AND objsubid = 2 AND NOT granted`;
    return Number(rows[0].count);
  }
  async function hold(lock: (tx: Prisma.TransactionClient) => Promise<unknown>) {
    let unlock!: () => void;
    let acquired!: () => void;
    let failed!: (error: unknown) => void;
    const ready = new Promise<void>((resolve, reject) => { acquired = resolve; failed = reject; });
    const released = new Promise<void>(resolve => { unlock = resolve; });
    const transaction = db.$transaction(async tx => { await lock(tx); acquired(); await released; }, { timeout: 30000, maxWait: 10000 });
    void transaction.catch(failed);
    await ready;
    const release = async () => { unlock(); await transaction; };
    releases.push(release);
    return release;
  }
  async function jsonRequest(route: string, cookie: string, body: unknown, method = "POST") {
    return fetch(`${baseUrl}${route}`, { method, headers: { cookie, "Content-Type": "application/json", "x-forwarded-for": "198.51.100.174" }, body: JSON.stringify(body) });
  }

  try {
    const building = await db.building.create({ data: { name: `Concurrency ${suffix}`, address: "Test", entrance: "1", manager: "Test", contact: "Test", contactEmail: "test@example.test" } });
    buildingId = building.id;
    const email = `concurrency-${suffix}@example.test`;
    const unit = await db.unit.create({ data: { buildingId, no: "1", type: "byt", floor: "1", coMode: "single", email, owners: { create: { first: "Test", last: "Owner", name: "Test Owner", share: 1, email } } }, include: { owners: true } });
    const admin = await db.admin.create({ data: { email: `admin-${suffix}@example.test`, name: "Concurrency admin", role: "superadmin", passwordHash: "unused" } });
    adminId = admin.id;
    const sessionToken = randomBytes(32).toString("base64url");
    await db.adminSession.create({ data: { adminId, tokenHash: hash(sessionToken), expiresAt: new Date(Date.now() + 3600000) } });
    const cookie = `hlasovanie_session=${sessionToken}`;
    const poll = await db.poll.create({ data: { buildingId, title: "Concurrency test", reason: "Test", declarer: "Test", announcedAt: new Date(), startAt: new Date(Date.now() - 60000), endAt: new Date(Date.now() + 3600000), status: "draft", questions: { create: { no: 1, kind: "Spoločné", title: "Test", text: "Schvaľujete test?", majorityType: "half_all" } } } });
    const owner = unit.owners[0];
    const payload = { no: "changed", type: "byt", floor: "1", coMode: "single", email, owners: [{ id: owner.id, first: owner.first, last: owner.last, email, role: "owner", share: 1 }] };

    await t.test("a register update queued behind activation sees the committed active status", async () => {
      const releaseBuilding = await hold(tx => lockBuilding(tx, buildingId));
      const activation = jsonRequest(`/api/admin/poll/${poll.id}/activate`, cookie, {});
      await waitUntil(async () => await advisoryWaiters(`building:${buildingId}`) === 1, "Activation did not wait for the building lock");
      const edit = jsonRequest(`/api/admin/unit/${unit.id}`, cookie, payload, "PUT");
      await waitUntil(async () => await advisoryWaiters(`building:${buildingId}`) === 2, "Unit update did not queue behind activation");
      await releaseBuilding();
      const activated = await activation;
      assert.equal(activated.status, 200, await activated.text());
      const edited = await edit;
      assert.equal(edited.status, 409, await edited.text());
      assert.equal((await db.unit.findUniqueOrThrow({ where: { id: unit.id } })).no, "1");
    });

    await t.test("invitation rotation waits for an old-link vote to commit before invalidation", async () => {
      const originalToken = randomBytes(32).toString("hex");
      const original = await db.voteToken.create({ data: { pollId: poll.id, unitId: unit.id, tokenHash: hash(originalToken), expiresAt: poll.endAt } });
      const initialTokens = await db.voteToken.count({ where: { pollId: poll.id } });
      // No network provider is used: this only pauses the local template query.
      const releaseEmail = await hold(tx => tx.$executeRawUnsafe(`LOCK TABLE "${schema}"."EmailTemplate" IN ACCESS EXCLUSIVE MODE`));
      const releaseVotes = await hold(tx => tx.$executeRawUnsafe(`LOCK TABLE "${schema}"."Vote" IN SHARE MODE`));
      const resend = jsonRequest(`/api/admin/poll/${poll.id}/resend`, cookie, { email, unitNo: "1" });
      await waitUntil(async () => await db.voteToken.count({ where: { pollId: poll.id } }) === initialTokens + 1, "Resend did not create its replacement token");
      const vote = jsonRequest(`/api/vote/${originalToken}`, "", { answers: { "1": "agree" }, finalize: true });
      await waitUntil(async () => {
        const rows = await db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM pg_locks WHERE relation = ${`${schema}."Vote"`}::regclass AND mode = 'RowExclusiveLock' AND NOT granted`;
        return Number(rows[0].count) > 0;
      }, "Old-link vote did not pause after acquiring its poll lock");
      await releaseEmail();
      await waitUntil(async () => await advisoryWaiters(poll.id) > 0, "Resend token invalidation must wait for the in-flight vote");
      assert.ok(await db.voteToken.findUnique({ where: { id: original.id } }), "An in-flight vote's token must remain valid until commit");
      await releaseVotes();
      const voted = await vote;
      assert.equal(voted.status, 200, await voted.text());
      const resent = await resend;
      assert.equal(resent.status, 200, await resent.text());
      assert.equal(await db.vote.count({ where: { pollId: poll.id, unitId: unit.id, answer: "agree" } }), 1);
      assert.equal(await db.voteToken.findUnique({ where: { id: original.id } }), null);
      assert.equal(await db.voteToken.count({ where: { pollId: poll.id } }), 1);
    });
  } finally {
    await Promise.allSettled(releases.map(release => release()));
    if (adminId) await db.admin.deleteMany({ where: { id: adminId } });
    if (buildingId) await db.building.deleteMany({ where: { id: buildingId } });
    await db.$disconnect();
  }
});
