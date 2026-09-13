import assert from "node:assert/strict";
import test from "node:test";
import { calculateNeed, computeEffectiveVote, computeTally, filterEligibleUnits, type EffectiveVote } from "../src/lib/engine";

test("inactive units do not remain eligible", () => {
  const units = filterEligibleUnits([
    { id: "active", status: "active", votes: 1 },
    { id: "inactive", status: "inactive", votes: 100 },
  ]);
  assert.deepEqual(units.map(unit => unit.id), ["active"]);
});

test("statutory thresholds are exact", () => {
  assert.equal(calculateNeed("half_all", 36, 20), 19);
  assert.equal(calculateNeed("twothirds_all", 36, 20), 24);
  assert.equal(calculateNeed("fourfifths_all", 36, 20), 29);
  assert.equal(calculateNeed("all", 36, 20), 36);
  assert.equal(calculateNeed("half_present", 36, 19), 10);
});

test("invalid vote weights are rejected", () => {
  assert.throws(() => filterEligibleUnits([{ id: "x", status: "active", votes: 0 }]), /hlasov/i);
  assert.throws(() => filterEligibleUnits([{ id: "x", status: "active", votes: 1.5 }]), /hlasov/i);
});

test("exactly half of co-owner shares is disputed despite floating point rounding", () => {
  const shares = [0.17, 0.28, 0.05, 0.5];
  const unit = { id: "unit", coMode: "internal" as const, owners: shares.map((share, index) => ({ id: String(index), share })) };
  const subvotes = shares.slice(0, 3).map((_, index) => ({ unitId: unit.id, ownerId: String(index), questionNo: 1, answer: "agree" as const, version: 1 }));
  const result = computeEffectiveVote(unit, 1, new Map(), new Map([["unit:1", subvotes]]));
  assert.equal(result.answer, null);
  assert.equal(result.disputed, true);
  subvotes.push({ unitId: unit.id, ownerId: "3", questionNo: 1, answer: "agree", version: 1 });
  assert.equal(computeEffectiveVote(unit, 1, new Map(), new Map([["unit:1", subvotes]])).answer, "agree");
});

test("weighted abstentions participate in half-present majority while disputed votes do not", () => {
  const units = [{ id: "yes", votes: 3 }, { id: "abstain", votes: 3 }, { id: "disputed", votes: 2 }];
  const effectiveVotes = new Map<string, Map<number, EffectiveVote>>([
    ["yes", new Map([[1, { answer: "agree" as const, disputed: false, note: null }]])],
    ["abstain", new Map([[1, { answer: "abstain" as const, disputed: false, note: null }]])],
    ["disputed", new Map([[1, { answer: null, disputed: true, note: null }]])],
  ]);
  const result = computeTally("half_present", 1, units, effectiveVotes, true);
  assert.equal(result.total, 8);
  assert.equal(result.voted, 6);
  assert.equal(result.need, 4);
  assert.equal(result.status, "rejected");
});

test("an empty electorate cannot approve a question under any majority", () => {
  for (const majority of ["half_all", "twothirds_all", "fourfifths_all", "all", "half_present"] as const) {
    assert.equal(computeTally(majority, 1, [], new Map(), true).status, "rejected");
  }
});

test("active polls never finally reject a question while existing votes can change", () => {
  const units = [{ id: "unit", votes: 1 }];
  const effectiveVotes = new Map<string, Map<number, EffectiveVote>>([
    ["unit", new Map([[1, { answer: "disagree", disputed: false, note: null }]])],
  ]);
  assert.equal(computeTally("half_all", 1, units, effectiveVotes, false).status, "short");
  assert.equal(computeTally("half_all", 1, units, effectiveVotes, true).status, "rejected");
  effectiveVotes.get("unit")!.get(1)!.answer = "agree";
  assert.equal(computeTally("half_all", 1, units, effectiveVotes, false).status, "approved");
});
