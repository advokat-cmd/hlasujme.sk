import assert from "node:assert/strict";
import test from "node:test";
import {
  didLoginEmailChange,
  ownerEmailLabelForDisplay,
  ownerEmailForDisplay,
  ownerEmailForEditing,
  synchronizeSingleOwnerEmail,
} from "../src/lib/unitEmails";

test("single owner copies and normalizes the unit email to its only owner", () => {
  const result = synchronizeSingleOwnerEmail("single", " EVA@Example.COM ", [{ email: "", name: "Eva" }]);

  assert.equal(result.unitEmail, "eva@example.com");
  assert.deepEqual(result.owners, [{ email: "eva@example.com", name: "Eva" }]);
});

test("single owner copies and normalizes its only owner email to the unit", () => {
  const result = synchronizeSingleOwnerEmail("single", "", [{ email: " EVA@Example.COM ", name: "Eva" }]);

  assert.equal(result.unitEmail, "eva@example.com");
  assert.deepEqual(result.owners, [{ email: "eva@example.com", name: "Eva" }]);
});

test("single owner accepts matching normalized emails and clears both together", () => {
  const matching = synchronizeSingleOwnerEmail(
    "single",
    "eva@example.com",
    [{ email: " EVA@EXAMPLE.COM ", name: "Eva" }],
  );
  const cleared = synchronizeSingleOwnerEmail("single", " ", [{ email: "", name: "Eva" }]);

  assert.equal(matching.unitEmail, "eva@example.com");
  assert.equal(matching.owners[0].email, "eva@example.com");
  assert.equal(cleared.unitEmail, "");
  assert.equal(cleared.owners[0].email, "");
});

test("single owner rejects two different non-empty emails", () => {
  assert.throws(
    () => synchronizeSingleOwnerEmail("single", "unit@example.com", [{ email: "owner@example.com" }]),
    /nezhoduj/i,
  );
});

test("email synchronization leaves other modes and non-single-owner lists unchanged", () => {
  const owners = [{ email: " First@Example.com " }, { email: "second@example.com" }];

  const otherMode = synchronizeSingleOwnerEmail("internal", " Unit@Example.com ", owners);
  const multipleOwners = synchronizeSingleOwnerEmail("single", " Unit@Example.com ", owners);

  assert.equal(otherMode.unitEmail, " Unit@Example.com ");
  assert.strictEqual(otherMode.owners, owners);
  assert.equal(multipleOwners.unitEmail, " Unit@Example.com ");
  assert.strictEqual(multipleOwners.owners, owners);
});

test("single-owner detail falls back to the unit email for legacy rows", () => {
  assert.equal(ownerEmailForDisplay("single", "unit@example.com", null), "unit@example.com");
  assert.equal(ownerEmailForDisplay("internal", "unit@example.com", null), "");
  assert.equal(ownerEmailForDisplay("single", "unit@example.com", "owner@example.com"), "owner@example.com");
});

test("BSM detail displays the shared unit email for both spouses without personal emails", () => {
  assert.equal(ownerEmailForDisplay("bsm", "family@example.com", null), "family@example.com");
  assert.equal(ownerEmailForDisplay("bsm", "family@example.com", ""), "family@example.com");
});

test("BSM detail labels only a fallback unit email as shared", () => {
  assert.equal(ownerEmailLabelForDisplay("bsm", "family@example.com", null), "spoločný e-mail: family@example.com");
  assert.equal(ownerEmailLabelForDisplay("bsm", "family@example.com", "spouse@example.com"), "spouse@example.com");
  assert.equal(ownerEmailLabelForDisplay("bsm", "", null), "bez e-mailu");
  assert.equal(ownerEmailLabelForDisplay("single", "owner@example.com", null), "owner@example.com");
});

test("editing preserves the legacy unit-email fallback only for a single owner", () => {
  assert.equal(ownerEmailForEditing("single", "unit@example.com", null), "unit@example.com");
  assert.equal(ownerEmailForEditing("bsm", "family@example.com", null), "");
  assert.equal(ownerEmailForEditing("bsm", "family@example.com", " spouse@example.com "), "spouse@example.com");
});

test("login email changes are compared after normalization", () => {
  assert.equal(didLoginEmailChange("Old@Example.com", " old@example.com "), false);
  assert.equal(didLoginEmailChange("old@example.com", "new@example.com"), true);
  assert.equal(didLoginEmailChange("old@example.com", ""), true);
});
