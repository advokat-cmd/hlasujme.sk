import test from "node:test";
import assert from "node:assert/strict";
import { matchesRegisterBuilding, validateRegisterImport, verifyStoredRegisterImport } from "../src/lib/maintenance/registerImport";

const validPayload = {
  buildingEntrance: "3",
  units: [
    {
      no: "1",
      type: "byt",
      floor: "prízemie",
      label: "100/10000",
      coMode: "internal",
      owners: [
        { first: "Peter", last: "Prvý", birthDate: "01.01.1980", share: 0.5, role: "coowner" },
        { first: "Pavol", last: "Druhý", birthDate: "02.02.1982", share: 0.5, role: "coowner" },
      ],
    },
    {
      no: "2",
      type: "byt",
      floor: "1",
      label: "117/10000",
      coMode: "single",
      owners: [{ first: "Anna", last: "Tretia", birthDate: "03.03.1983", share: 1, role: "owner" }],
    },
  ],
};

test("register import validates unique units, complete shares, and empty future email fields", () => {
  const result = validateRegisterImport(validPayload);
  assert.equal(result.unitCount, 2);
  assert.equal(result.ownerCount, 3);
  assert.equal(result.payload.units[0].owners[0].email, null);
  assert.match(result.fingerprint, /^[a-f0-9]{64}$/);
});

test("register import rejects duplicate units and incomplete co-owner shares", () => {
  assert.throws(
    () => validateRegisterImport({ ...validPayload, units: [validPayload.units[0], validPayload.units[0]] }),
    /duplicitné/i,
  );
  assert.throws(
    () => validateRegisterImport({
      ...validPayload,
      units: [{
        ...validPayload.units[0],
        owners: [{ ...validPayload.units[0].owners[0], share: 0.4 }, validPayload.units[0].owners[1]],
      }],
    }),
    /100 %/i,
  );
});

test("register import rejects supplied emails until the later email update", () => {
  assert.throws(
    () => validateRegisterImport({
      ...validPayload,
      units: [{
        ...validPayload.units[1],
        owners: [{ ...validPayload.units[1].owners[0], email: "owner@example.com" }],
      }],
    }),
    /e-mail/i,
  );
});

test("register import matches the source entrance against the building short name", () => {
  assert.equal(matchesRegisterBuilding("3", { entrance: "Vchod A", short: "Björnsonova 3", address: "Björnsonova 3, Bratislava" }), true);
  assert.equal(matchesRegisterBuilding("5", { entrance: "Vchod A", short: "Björnsonova 3", address: "Björnsonova 3, Bratislava" }), false);
});

test("stored register verification retains the source entrance in its fingerprint", () => {
  const expected = validateRegisterImport(validPayload);
  const verified = verifyStoredRegisterImport(
    expected,
    { entrance: "Vchod A", short: "Björnsonova 3", address: "Björnsonova 3, Bratislava" },
    expected.payload.units,
  );
  assert.equal(verified.fingerprint, expected.fingerprint);
});
