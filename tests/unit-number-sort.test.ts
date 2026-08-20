import test from "node:test";
import assert from "node:assert/strict";
import { compareUnitNumbers } from "../src/lib/unitNumberSort";

test("sorts lexicographically ordered unit numbers in natural numeric order", () => {
  const currentRegisterOrder = ["1", "10", "11", "12", "12A", "2", "3", "4", "5", "6", "7", "8", "9"];

  const sorted = currentRegisterOrder.toSorted(compareUnitNumbers);

  assert.deepEqual(sorted, ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "12A"]);
});
