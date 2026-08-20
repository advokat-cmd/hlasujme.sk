import assert from "node:assert/strict";
import test from "node:test";
import {
  accountUsesAdminControls,
  assertAccountMutationAllowed,
  assertLinkedAccountDeletionAllowed,
  assertOwnerBelongsToUnit,
  requestedLinkedAccountRole,
} from "../src/lib/security/accounts";

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

test("omitting an owner cannot delete a linked protected account", () => {
  assert.throws(
    () => assertLinkedAccountDeletionAllowed(
      { role: "admin", adminId: "actor" },
      [{ id: "protected", role: "superadmin" }],
    ),
    /superadmin/i,
  );
  assert.throws(
    () => assertLinkedAccountDeletionAllowed(
      { role: "superadmin", adminId: "self" },
      [{ id: "self", role: "superadmin" }],
    ),
    /vlastný/i,
  );
  assert.throws(
    () => assertLinkedAccountDeletionAllowed(
      { role: "admin", adminId: "own-admin" },
      [{ id: "own-admin", role: "admin" }],
    ),
    /vlastný/i,
  );
  assert.doesNotThrow(() => assertLinkedAccountDeletionAllowed(
    { role: "admin", adminId: "actor" },
    [{ id: "owner-account", role: "vlastnik" }],
  ));
});

test("owner account roles are displayed and preserved without privilege changes", () => {
  assert.equal(accountUsesAdminControls([{ role: "vlastnik" }]), false);
  assert.equal(accountUsesAdminControls([{ role: "admin" }]), true);
  assert.equal(accountUsesAdminControls([{ role: "superadmin" }]), true);
  assert.equal(requestedLinkedAccountRole({ role: "vlastnik" }, false), "vlastnik");
  assert.equal(requestedLinkedAccountRole({ role: "superadmin" }, true), "superadmin");
  assert.equal(requestedLinkedAccountRole(null, true), "admin");
});
