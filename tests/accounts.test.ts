import assert from "node:assert/strict";
import test from "node:test";
import { assertAccountMutationAllowed, assertOwnerBelongsToUnit } from "../src/lib/security/accounts";

test("normal admin cannot mutate superadmin", () => {
  assert.throws(
    () => assertAccountMutationAllowed({ role: "admin", adminId: "a" }, { id: "s", role: "superadmin" }, "vlastnik"),
    /superadmin/i
  );
});

test("normal admin cannot mutate another administrator", () => {
  assert.throws(
    () => assertAccountMutationAllowed({ role: "admin", adminId: "a" }, { id: "b", role: "admin" }, "vlastnik"),
    /administrátor/i
  );
});

test("owner credentials require matching unit", () => {
  assert.throws(() => assertOwnerBelongsToUnit({ unitId: "u2" }, "u1"), /jednotk/i);
});

test("only superadmin can assign privileged roles", () => {
  assert.throws(() => assertAccountMutationAllowed({ role: "admin", adminId: "a" }, null, "admin"), /oprávnen/i);
});

test("superadmin can assign admin and user may update itself without role escalation", () => {
  assert.doesNotThrow(() => assertAccountMutationAllowed({ role: "superadmin", adminId: "s" }, null, "admin"));
  assert.doesNotThrow(() => assertAccountMutationAllowed({ role: "admin", adminId: "a" }, { id: "a", role: "admin" }, "admin"));
});
