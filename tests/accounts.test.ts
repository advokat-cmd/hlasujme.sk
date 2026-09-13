import assert from "node:assert/strict";
import test from "node:test";
import {
  accountUsesAdminControls,
  assertAccountMutationAllowed,
  assertLinkedAccountDeletionAllowed,
  assertOwnerBelongsToUnit,
  requestedLinkedAccountRole,
  hasBuildingAccess,
  isAccountRole,
} from "../src/lib/security/accounts";

test("unknown roles do not become administrators or building readers", () => {
  for (const role of ["", "owner", "viewer", null, undefined]) {
    assert.equal(isAccountRole(role), false);
    assert.equal(hasBuildingAccess(role, "building-a", "building-a"), false);
  }
});

test("owners can read only their linked building while administrators can read all", () => {
  assert.equal(hasBuildingAccess("vlastnik", "building-a", "building-a"), true);
  assert.equal(hasBuildingAccess("vlastnik", "building-b", "building-a"), false);
  assert.equal(hasBuildingAccess("vlastnik", "building-a"), false);
  assert.equal(hasBuildingAccess("admin", "building-b"), true);
  assert.equal(hasBuildingAccess("superadmin", "building-b"), true);
});

test("owner and unknown actors cannot change linked accounts", () => {
  for (const role of ["vlastnik", "viewer", ""]) {
    assert.throws(() => assertAccountMutationAllowed({ role, adminId: "actor" }, { role: "vlastnik", id: "other" }, "vlastnik"), /administrátor/i);
  }
});

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
