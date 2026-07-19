import assert from "node:assert/strict";
import test from "node:test";
import {
  parseVoteAnswers,
  validateNewPassword,
  validateOwners,
  validatePollInput,
} from "../src/lib/security/input";
import { generateTemporaryPassword } from "../src/lib/security/passwords";

test("vote answers reject unknown questions and enum values", () => {
  assert.throws(() => parseVoteAnswers({ "1": "yes" }, new Set([1])), /odpoveď/i);
  assert.throws(() => parseVoteAnswers({ "2": "agree" }, new Set([1])), /otázk/i);
});

test("vote answers accept only complete known enum answers", () => {
  assert.deepEqual(parseVoteAnswers({ "1": "agree", "2": "abstain" }, new Set([1, 2])), {
    1: "agree",
    2: "abstain",
  });
});

test("poll dates require a finite increasing interval", () => {
  assert.throws(() => validatePollInput({
    basics: { title: "x", reason: "x", start: "bad", end: "bad" },
    questions: [{ text: "x", majority: "half-all" }],
  }), /dátum/i);
  assert.throws(() => validatePollInput({
    basics: { title: "x", reason: "x", start: "2026-01-02", end: "2026-01-01" },
    questions: [{ text: "x", majority: "half-all" }],
  }), /koniec/i);
});

test("internal shares are positive and total one", () => {
  assert.throws(() => validateOwners([{ first: "A", last: "B", share: 0 }], "internal"), /podiel/i);
  assert.throws(() => validateOwners([{ first: "A", last: "B", share: 0.6 }], "internal"), /100/i);
});

test("password policy requires twelve characters", () => {
  assert.throws(() => validateNewPassword("short"), /12/);
  assert.equal(validateNewPassword("dlhe-bezpecne-heslo"), "dlhe-bezpecne-heslo");
});

test("temporary passwords are unique and have sufficient entropy", () => {
  const values = new Set(Array.from({ length: 50 }, () => generateTemporaryPassword()));
  assert.equal(values.size, 50);
  for (const value of values) assert.ok(value.length >= 20);
  assert.ok(!values.has("demo1234"));
});
