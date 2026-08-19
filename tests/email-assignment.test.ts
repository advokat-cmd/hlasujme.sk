import test from "node:test";
import assert from "node:assert/strict";
import { validateEmailAssignment } from "../src/lib/maintenance/emailAssignment";

const validPayload = {
  buildingEntrance: "3",
  assignments: [
    { unitNo: "1", email: "first@example.com", owner: { first: "Peter", last: "Prvý" } },
    { unitNo: "2", email: "second@example.com" },
  ],
};

test("email assignment normalizes addresses and produces a private fingerprint", () => {
  const result = validateEmailAssignment({
    ...validPayload,
    assignments: [
      { ...validPayload.assignments[0], email: " First@Example.COM " },
      validPayload.assignments[1],
    ],
  });
  assert.equal(result.assignmentCount, 2);
  assert.equal(result.payload.assignments[0].email, "first@example.com");
  assert.match(result.fingerprint, /^[a-f0-9]{64}$/);
});

test("email assignment rejects duplicate addresses and duplicate targets", () => {
  assert.throws(
    () => validateEmailAssignment({
      ...validPayload,
      assignments: [validPayload.assignments[0], { ...validPayload.assignments[1], email: "FIRST@example.com" }],
    }),
    /duplicitný e-mail/i,
  );
  assert.throws(
    () => validateEmailAssignment({
      ...validPayload,
      assignments: [validPayload.assignments[0], { ...validPayload.assignments[0], email: "other@example.com" }],
    }),
    /duplicitné priradenie/i,
  );
});

test("email assignment rejects malformed addresses and partial owner selectors", () => {
  assert.throws(
    () => validateEmailAssignment({
      ...validPayload,
      assignments: [{ unitNo: "1", email: "not-an-email" }],
    }),
    /neplatný e-mail/i,
  );
  assert.throws(
    () => validateEmailAssignment({
      ...validPayload,
      assignments: [{ unitNo: "1", email: "owner@example.com", owner: { first: "Peter" } }],
    }),
    /vlastníka/i,
  );
});
