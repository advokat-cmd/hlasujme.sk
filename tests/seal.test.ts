import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, createSealedSnapshot, getSealedQuestionTallies, parseSealedSnapshot, sha256Hex, verifySha256 } from "../src/lib/seal";
import type { PollResults } from "../src/lib/engine";

test("canonical JSON ignores object insertion order", () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
});

test("result and PDF hashes detect independent tampering", () => {
  const resultHash = sha256Hex(canonicalJson({ approved: true }));
  const pdfHash = sha256Hex(Buffer.from("pdf"));
  assert.equal(verifySha256(canonicalJson({ approved: false }), resultHash), false);
  assert.equal(verifySha256(Buffer.from("changed"), pdfHash), false);
  assert.equal(verifySha256(Buffer.from("pdf"), pdfHash), true);
});

test("canonical JSON rejects unsupported values", () => {
  assert.throws(() => canonicalJson({ invalid: undefined }), /kanon/i);
});

function pollResults(): PollResults {
  const date = new Date("2026-09-13T09:00:00Z");
  return {
    poll: {
      id: "poll", buildingId: "building", title: "Original poll", reason: "Repair", declarer: "Administrator",
      announcedAt: date, startAt: date, endAt: date, status: "closing", driveFolderId: null, createdAt: date, updatedAt: date,
      building: { id: "building", name: "Building", short: null, address: "Address", entrance: "A", unitsCount: 1, manager: "Manager", contact: "Contact", contactEmail: "manager@example.invalid", createdAt: date, updatedAt: date },
      questions: [{ id: "q1", pollId: "poll", no: 1, kind: "General", title: "Question", text: "Original question", majorityType: "half_all", note: null, attachments: ["/api/document/doc"] }],
    },
    units: [{ id: "unit", buildingId: "building", no: "1", type: "byt", floor: "1", votes: 1, coMode: "single", email: "owner@example.invalid", actingPerson: null, label: null, status: "active",
      owners: [{ id: "owner", unitId: "unit", first: "Original", last: "Owner", name: "Original Owner", email: null, phone: null, birthDate: null, share: 1, role: "owner" }] }],
    tallies: new Map([[1, { total: 1, agree: 1, disagree: 0, abstain: 0, none: 0, disputed: 0, voted: 1, need: 1, status: "approved" }]]),
    effectiveVotes: new Map([["unit", new Map([[1, { answer: "agree", disputed: false, note: null }]])]]),
  };
}

test("sealed snapshot preserves questions, ownership and votes after live data changes", () => {
  const live = pollResults();
  const snapshot = createSealedSnapshot(live, new Date("2026-09-13T10:00:00Z"));
  live.poll.title = "Changed poll";
  live.poll.questions[0].text = "Changed question";
  live.poll.questions[0].attachments.push("new attachment");
  live.units[0].owners[0].name = "New owner";
  live.units[0].votes = 99;
  live.tallies.get(1)!.agree = 0;
  live.effectiveVotes.get("unit")!.get(1)!.answer = "disagree";
  const json = canonicalJson(snapshot);
  const restored = parseSealedSnapshot(json, sha256Hex(json))!;
  assert.equal(restored.poll.title, "Original poll");
  assert.equal(restored.questions[0].text, "Original question");
  assert.deepEqual(restored.questions[0].attachments, ["/api/document/doc"]);
  assert.equal(restored.units[0].owners[0].name, "Original Owner");
  assert.equal(restored.units[0].votes, 1);
  assert.equal(restored.units[0].effectiveVotes[0].answer, "agree");
  assert.equal(getSealedQuestionTallies(json, sha256Hex(json))[0].tally.agree, 1);
});

test("altered or malformed snapshots never fall back to live results", () => {
  const snapshot = createSealedSnapshot(pollResults());
  const json = canonicalJson(snapshot);
  assert.throws(() => parseSealedSnapshot(json.replace("Original poll", "Changed poll"), sha256Hex(json)), /Integrita/);
  assert.throws(() => getSealedQuestionTallies(json, "0".repeat(64)), /Integrita/);
  assert.throws(() => parseSealedSnapshot(JSON.stringify({ version: 1, poll: snapshot.poll, questions: [{ no: 1, tally: { agree: 1 } }], units: [] })), /formát/);
});

test("legacy per-question seals retain original tallies without inventing owner snapshots", () => {
  const json = JSON.stringify([{ questionNo: 1, title: "Old question", total: 36, agree: 20, disagree: 3, abstain: 1, none: 10, disputed: 2, need: 19, status: "approved" }]);
  assert.equal(parseSealedSnapshot(json), null);
  const results = getSealedQuestionTallies(json);
  assert.equal(results[0].no, 1);
  assert.equal(results[0].tally.voted, 24);
  assert.equal(results[0].tally.agree, 20);
  assert.deepEqual(getSealedQuestionTallies(JSON.stringify({ summary: "Legacy placeholder" })), []);
});
