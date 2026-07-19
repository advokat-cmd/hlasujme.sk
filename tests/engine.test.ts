import assert from "node:assert/strict";
import test from "node:test";
import { calculateNeed, filterEligibleUnits } from "../src/lib/engine";

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
