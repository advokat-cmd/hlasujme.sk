import test from "node:test";
import assert from "node:assert/strict";
import { electorateChanged } from "../src/lib/pollLifecycle";

const unit = { no: "1", type: "byt", coMode: "internal", owners: [
  { id: "a", first: "Anna", last: "Test", share: 0.6, role: "coowner", email: "old@example.test" },
  { id: "b", first: "Boris", last: "Test", share: 0.4, role: "coowner", email: "b@example.test" },
] };
test("electorate guard allows contact corrections and owner reordering", () => {
  assert.equal(electorateChanged(unit, { ...unit, owners: [...unit.owners].reverse().map(o => ({ ...o, email: "new@example.test" })) }), false);
});
test("electorate guard detects ownership, shares, unit identity and voting mode changes", () => {
  assert.equal(electorateChanged(unit, { ...unit, coMode: "single" }), true);
  assert.equal(electorateChanged(unit, { ...unit, no: "2" }), true);
  assert.equal(electorateChanged(unit, { ...unit, owners: unit.owners.slice(0, 1) }), true);
  assert.equal(electorateChanged(unit, { ...unit, owners: unit.owners.map(o => ({ ...o, share: 0.5 })) }), true);
  assert.equal(electorateChanged(unit, { ...unit, owners: unit.owners.map(o => ({ ...o, id: undefined })) }), true);
});
