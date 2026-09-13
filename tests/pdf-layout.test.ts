import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { createAnnexQuestionGroups, generateSealedProtocol } from "../src/lib/pdf";

test("long ballots retain each question once with readable annex columns", () => {
  const questions = Array.from({ length: 20 }, (_, index) => ({ no: index + 1 }));
  const groups = createAnnexQuestionGroups(questions);
  assert.deepEqual(groups.flat(), questions);
  assert.equal(groups.length, 7);
  for (const group of groups) {
    assert.ok(group.length >= 1 && group.length <= 3);
    assert.ok(270 / group.length >= 90);
  }
  assert.deepEqual(groups.at(-1)!.map(question => question.no), [19, 20]);
});

test("short and empty ballots do not create extra question columns", () => {
  assert.deepEqual(createAnnexQuestionGroups([]), []);
  assert.deepEqual(createAnnexQuestionGroups([1]), [[1]]);
  assert.deepEqual(createAnnexQuestionGroups([1, 2, 3, 4]), [[1, 2, 3], [4]]);
});

test("a twenty-question protocol renders separate annex pages and retains every result", async () => {
  const date = new Date("2026-09-13T09:00:00Z");
  const questions = Array.from({ length: 20 }, (_, index) => ({ id: `q${index}`, no: index + 1, kind: "General", title: `Question ${index + 1}`, text: `Approve question ${index + 1}?`, majorityType: "half_all", note: null, attachments: [] }));
  const units = [{ id: "u", no: "1234567890123456789", type: "byt", status: "active", votes: 1, coMode: "single", actingPerson: null,
    owners: [{ id: "o", name: "An exceptionally long owner name that must fit into the name column", share: 1, role: "owner" }] }];
  const client = {
    poll: { findUnique: async () => ({ id: "poll", title: "Long poll", reason: "Test", declarer: "Test", announcedAt: date, startAt: date, endAt: date, status: "closing", buildingId: "b",
      building: { id: "b", name: "Building", short: null, address: "Test", entrance: "A", manager: "Test", contact: "Test", contactEmail: "test@example.invalid" }, questions }) },
    unit: { findMany: async () => units }, vote: { findMany: async () => [] }, coownerSubvote: { findMany: async () => [] },
  } as unknown as Prisma.TransactionClient;
  const protocol = await generateSealedProtocol("poll", client);
  assert.equal(protocol.buffer.subarray(0, 5).toString(), "%PDF-");
  assert.equal(protocol.snapshot.questions.length, 20);
  assert.deepEqual(protocol.results.map(question => question.questionNo), questions.map(question => question.no));
  const pageCount = protocol.buffer.toString("latin1").match(/\/Type \/Page\b/g)?.length ?? 0;
  assert.ok(pageCount >= 8, `Expected seven annex groups plus result pages, got ${pageCount}`);
});
