import assert from "node:assert/strict";
import test from "node:test";
import { allowedPollTab, canManagePoll, canSeePollResults, pollStatusLabel } from "../src/lib/pollPresentation";
import { archiveSummary } from "../src/lib/archivePresentation";
import { sha256Hex } from "../src/lib/seal";

test("owner and unknown roles cannot open management tabs through a crafted URL", () => {
  for (const role of ["vlastnik", "unknown", undefined]) {
    assert.equal(canManagePoll(role), false);
    assert.equal(allowedPollTab(role, "emails"), "results");
    assert.equal(allowedPollTab(role, "units"), "results");
    assert.equal(allowedPollTab(role, "documents"), "documents");
  }
  assert.equal(allowedPollTab("admin", "emails"), "emails");
  assert.equal(allowedPollTab("superadmin", "units"), "units");
});

test("owner cannot see aggregate results before sealing, including expired active polls", () => {
  for (const status of ["draft", "active", "closing"]) assert.equal(canSeePollResults("vlastnik", status), false);
  assert.equal(canSeePollResults("vlastnik", "closed"), true);
  assert.equal(canSeePollResults("admin", "active"), true);
  assert.equal(canSeePollResults("unknown", "closed"), false);
});

test("display distinguishes scheduled, expired, closing, and sealed polls", () => {
  const start = "2026-09-10T10:00:00Z", end = "2026-09-11T10:00:00Z";
  assert.equal(pollStatusLabel("active", start, end, Date.parse(start) - 1), "naplánované");
  assert.equal(pollStatusLabel("active", start, end, Date.parse(start)), "prebieha");
  assert.equal(pollStatusLabel("active", start, end, Date.parse(end) + 1), "po termíne – čaká na uzavretie");
  assert.equal(pollStatusLabel("closing", start, end), "uzatvára sa");
  assert.equal(pollStatusLabel("draft", start, end), "návrh");
});

test("legacy archive displays actual question outcomes without inventing a poll rejection or turnout", () => {
  const resultJson = JSON.stringify([{ questionNo: 1, title: "Otázka", total: 10, agree: 7, disagree: 1, abstain: 0, none: 2, disputed: 0, need: 6, status: "approved" }]);
  assert.deepEqual(archiveSummary({ resultJson, resultSha256: sha256Hex(resultJson) }), { label: "schválené otázky: 1 / 1", tone: "success", turnoutText: "pozri zápisnicu" });
  assert.equal(archiveSummary({ resultJson, resultSha256: "0".repeat(64) }).label, "výsledky nemožno overiť");
  assert.equal(archiveSummary({ resultJson: "not-json" }).label, "výsledky nemožno overiť");
});
