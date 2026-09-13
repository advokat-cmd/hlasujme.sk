import assert from "node:assert/strict";
import test from "node:test";
import {
  parseVoteAnswers,
  validateOptionalEmail,
  validateLoginInput,
  validateNewPassword,
  validatePasswordChangeInput,
  validateOwners,
  validatePollInput,
} from "../src/lib/security/input";
import { generateTemporaryPassword } from "../src/lib/security/passwords";

test("login input is normalized and malformed input is rejected", () => {
  assert.deepEqual(validateLoginInput({ email: " USER@Example.COM ", password: "secret" }), {
    email: "user@example.com",
    password: "secret",
  });
  assert.throws(() => validateLoginInput(null), /prihlas/i);
  assert.throws(() => validateLoginInput({ email: "", password: "" }), /povinn/i);
});

test("optional email accepts empty values and normalizes a valid address", () => {
  assert.equal(validateOptionalEmail(undefined), "");
  assert.equal(validateOptionalEmail("  "), "");
  assert.equal(validateOptionalEmail(" USER@Example.COM "), "user@example.com");
});

test("optional email rejects malformed and oversized addresses", () => {
  assert.throws(() => validateOptionalEmail("missing-domain@"), /platn/i);
  assert.throws(() => validateOptionalEmail(`${"a".repeat(310)}@example.com`), /320/);
  assert.throws(
    () => validateOwners([{ first: "A", last: "B", share: 1, email: "not-an-email" }], "single"),
    /platn/i,
  );
});

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

test("the same existing owner cannot be submitted twice to overwrite shares or account data", () => {
  const owner = { id: "owner-1", first: "A", last: "B", share: 0.5 };
  assert.throws(() => validateOwners([owner, { ...owner, first: "Different" }], "internal"), /iba raz/i);
  assert.equal(validateOwners([owner, { ...owner, id: "owner-2" }], "internal").length, 2);
});

test("a newly accepted password can also pass login validation", () => {
  const boundary = "a".repeat(4096);
  assert.equal(validateNewPassword(boundary), boundary);
  assert.equal(validateLoginInput({ email: "owner@example.com", password: boundary }).password, boundary);
  assert.throws(() => validateNewPassword("a".repeat(4097)), /4096/);
});

test("password changes reject malformed values before password verification", () => {
  for (const input of [null, [], {}, { oldPassword: {}, newPassword: "long-new-password" }, { oldPassword: "a".repeat(4097), newPassword: "long-new-password" }]) {
    assert.throws(() => validatePasswordChangeInput(input));
  }
  assert.deepEqual(validatePasswordChangeInput({ oldPassword: " old-password ", newPassword: " new-long-password " }), {
    oldPassword: "old-password",
    newPassword: "new-long-password",
  });
});

test("temporary passwords are unique and have sufficient entropy", () => {
  const values = new Set(Array.from({ length: 50 }, () => generateTemporaryPassword()));
  assert.equal(values.size, 50);
  for (const value of values) assert.ok(value.length >= 20);
  assert.ok(!values.has("demo1234"));
});
