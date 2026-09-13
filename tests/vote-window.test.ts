import assert from "node:assert/strict";
import test from "node:test";
import { isEligibleVoteTokenTarget, isPollOpen } from "../src/lib/tokens";

const base = {
  status: "active",
  startAt: new Date("2026-07-20T10:00:00Z"),
  endAt: new Date("2026-07-20T11:00:00Z"),
};

test("poll is closed before start", () => {
  assert.equal(isPollOpen(base, new Date("2026-07-20T09:59:59Z")), false);
});

test("poll is open inside the inclusive window", () => {
  assert.equal(isPollOpen(base, new Date("2026-07-20T10:30:00Z")), true);
});

test("poll is closed after end or while closing", () => {
  assert.equal(isPollOpen(base, new Date("2026-07-20T11:00:01Z")), false);
  assert.equal(isPollOpen({ ...base, status: "closing" }, new Date("2026-07-20T10:30:00Z")), false);
});

test("inactive, foreign and invalid-weight units cannot submit votes", () => {
  const token = { ownerId: null, poll: { buildingId: "a" }, unit: { buildingId: "a", status: "active", votes: 1, coMode: "single", owners: [{ id: "owner" }] } };
  assert.equal(isEligibleVoteTokenTarget(token), true);
  assert.equal(isEligibleVoteTokenTarget({ ...token, unit: { ...token.unit, status: "inactive" } }), false);
  assert.equal(isEligibleVoteTokenTarget({ ...token, unit: { ...token.unit, buildingId: "b" } }), false);
  assert.equal(isEligibleVoteTokenTarget({ ...token, unit: { ...token.unit, votes: 0 } }), false);
});

test("co-owner tokens require internal mode and the original owner", () => {
  const token = { ownerId: "owner", poll: { buildingId: "a" }, unit: { buildingId: "a", status: "active", votes: 1, coMode: "internal", owners: [{ id: "owner" }] } };
  assert.equal(isEligibleVoteTokenTarget(token), true);
  assert.equal(isEligibleVoteTokenTarget({ ...token, ownerId: null }), false);
  assert.equal(isEligibleVoteTokenTarget({ ...token, ownerId: "deleted" }), false);
  assert.equal(isEligibleVoteTokenTarget({ ...token, unit: { ...token.unit, coMode: "bsm" } }), false);
});
