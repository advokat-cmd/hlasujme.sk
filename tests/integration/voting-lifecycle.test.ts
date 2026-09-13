import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { assertSafeDestructiveDatabase } from "../../scripts/check-db-boundary";
import { db } from "../../src/lib/db";
import { computePollResults } from "../../src/lib/engine";
import { hashToken } from "../../src/lib/tokens";
import { acquirePollLock } from "../../src/lib/pollLock";
import { generateSealedProtocol } from "../../src/lib/pdf";
import { canonicalJson, parseSealedSnapshot, sha256Hex } from "../../src/lib/seal";

const baseUrl = process.env.INTEGRATION_BASE_URL;

test("real voting preserves explicit submission, co-owner weighting and sealed history", { skip: !baseUrl }, async t => {
  assertSafeDestructiveDatabase();
  assert.ok(baseUrl);
  for (const url of [baseUrl, process.env.DATABASE_URL!]) {
    assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname));
  }
  const building = await db.building.create({ data: {
    name: `Voting test ${randomUUID()}`, address: "Test", entrance: "A", manager: "Test", contact: "Test", contactEmail: "test@example.invalid",
  } });
  try {
    const bsm = await db.unit.create({ data: { buildingId: building.id, no: "1", type: "byt", floor: "1", coMode: "bsm", votes: 1,
      owners: { create: [{ first: "Test", last: "Spouse A", name: "Test Spouse A", share: 0.5, role: "bsm" }, { first: "Test", last: "Spouse B", name: "Test Spouse B", share: 0.5, role: "bsm" }] } } });
    const internal = await db.unit.create({ data: { buildingId: building.id, no: "2", type: "nebyt", floor: "1", coMode: "internal", votes: 2,
      owners: { create: [{ first: "Test", last: "Majority", name: "Test Majority", share: 0.6, role: "coowner" }, { first: "Test", last: "Minority", name: "Test Minority", share: 0.4, role: "coowner" }] } }, include: { owners: { orderBy: { share: "desc" } } } });
    const inactive = await db.unit.create({ data: { buildingId: building.id, no: "3", type: "byt", floor: "1", coMode: "single", votes: 20, status: "inactive" } });
    const poll = await db.poll.create({ data: { buildingId: building.id, title: "Test ballot", reason: "Test", declarer: "Test", announcedAt: new Date(),
      startAt: new Date(Date.now() - 60000), endAt: new Date(Date.now() + 3600000), status: "active", questions: { create: [
        { no: 1, kind: "General", title: "Question one", text: "Approve one?", majorityType: "half_all" },
        { no: 2, kind: "General", title: "Question two", text: "Approve two?", majorityType: "twothirds_all" },
      ] } } });
    async function makeToken(unitId: string, ownerId: string | null = null) {
      const token = randomBytes(32).toString("hex");
      await db.voteToken.create({ data: { unitId, ownerId, pollId: poll.id, tokenHash: hashToken(token), expiresAt: poll.endAt } });
      return token;
    }
    const [bsmToken, majorityToken, minorityToken, inactiveToken] = await Promise.all([
      makeToken(bsm.id), makeToken(internal.id, internal.owners[0].id), makeToken(internal.id, internal.owners[1].id), makeToken(inactive.id),
    ]);
    async function submit(token: string, answers: Record<number, string>, finalize = true) {
      return fetch(`${baseUrl}/api/vote/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, finalize }) });
    }
    async function assertResponse(response: Response, expected: number) {
      assert.equal(response.status, expected, await response.text());
    }

    await t.test("drafts, incomplete ballots and inactive owners create no vote", async () => {
      await assertResponse(await submit(bsmToken, { 1: "agree" }, false), 400);
      await assertResponse(await submit(bsmToken, { 1: "agree" }), 400);
      await assertResponse(await submit(inactiveToken, { 1: "agree", 2: "agree" }), 401);
      assert.equal(await db.vote.count({ where: { pollId: poll.id } }), 0);
    });

    await t.test("BSM has one unit vote and majority shares resolve internal votes", async () => {
      await assertResponse(await submit(bsmToken, { 1: "agree", 2: "abstain" }), 200);
      await assertResponse(await submit(majorityToken, { 1: "agree", 2: "agree" }), 200);
      await assertResponse(await submit(minorityToken, { 1: "disagree", 2: "disagree" }), 200);
      const results = await computePollResults(poll.id);
      assert.equal(results.tallies.get(1)!.total, 3);
      assert.equal(results.tallies.get(1)!.agree, 3);
      assert.equal(results.tallies.get(1)!.need, 2);
      assert.equal(results.tallies.get(2)!.agree, 2);
      assert.equal(results.tallies.get(2)!.abstain, 1);
      assert.equal(results.tallies.get(2)!.status, "approved");
      assert.equal(await db.vote.count({ where: { pollId: poll.id, unitId: bsm.id } }), 2);
    });

    await t.test("resubmissions preserve versions and latest explicitly submitted answers win", async () => {
      await assertResponse(await submit(majorityToken, { 1: "disagree", 2: "abstain" }), 200);
      await assertResponse(await submit(majorityToken, { 1: "disagree", 2: "abstain" }), 200);
      const versions = await db.coownerSubvote.findMany({ where: { pollId: poll.id, ownerId: internal.owners[0].id, questionNo: 1 }, orderBy: { version: "asc" } });
      assert.deepEqual(versions.map(vote => [vote.version, vote.answer]), [[1, "agree"], [2, "disagree"]]);
      const results = await computePollResults(poll.id);
      assert.equal(results.tallies.get(1)!.agree, 1);
      assert.equal(results.tallies.get(1)!.disagree, 2);
      assert.equal(results.tallies.get(2)!.abstain, 3);
      assert.notEqual((await db.voteToken.findUniqueOrThrow({ where: { tokenHash: hashToken(majorityToken) } })).usedAt, null);
      const receipt = await fetch(`${baseUrl}/api/vote/${majorityToken}/pdf`);
      assert.equal(receipt.status, 200);
      assert.match(receipt.headers.get("Content-Type") ?? "", /application\/pdf/);
      assert.equal(Buffer.from(await receipt.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
    });

    await t.test("transactional sealing freezes results and prevents later voting", async () => {
      const protocol = await db.$transaction(async tx => {
        await acquirePollLock(tx, poll.id);
        await tx.poll.update({ where: { id: poll.id }, data: { status: "closing" } });
        const sealed = await generateSealedProtocol(poll.id, tx);
        const resultJson = canonicalJson(sealed.snapshot);
        await tx.sealedResult.create({ data: { pollId: poll.id, resultJson, resultSha256: sha256Hex(resultJson), sha256: sha256Hex(sealed.buffer), pdfPath: "test/not-persisted.pdf" } });
        await tx.poll.update({ where: { id: poll.id }, data: { status: "closed" } });
        return sealed;
      }, { timeout: 30000 });
      assert.equal(protocol.buffer.subarray(0, 5).toString(), "%PDF-");
      assert.equal(protocol.snapshot.questions[0].tally.status, "rejected");
      await assertResponse(await submit(bsmToken, { 1: "disagree", 2: "disagree" }), 401);
      await db.unit.update({ where: { id: bsm.id }, data: { votes: 9 } });
      await db.owner.update({ where: { id: internal.owners[0].id }, data: { name: "Changed after poll" } });
      const record = await db.sealedResult.findUniqueOrThrow({ where: { pollId: poll.id } });
      const snapshot = parseSealedSnapshot(record.resultJson, record.resultSha256)!;
      assert.equal(snapshot.questions[0].tally.total, 3);
      assert.equal(snapshot.units.find(unit => unit.id === bsm.id)!.votes, 1);
      assert.equal(snapshot.units.find(unit => unit.id === internal.id)!.owners.find(owner => owner.id === internal.owners[0].id)!.name, "Test Majority");
    });
  } finally {
    await db.building.delete({ where: { id: building.id } });
    await db.$disconnect();
  }
});
