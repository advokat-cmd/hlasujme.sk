import assert from "node:assert/strict";
import test from "node:test";
import { resolveStoragePath } from "../src/lib/storage";
import { isAllowedDocument } from "../src/lib/security/documents";

test("storage rejects traversal outside configured root", () => {
  assert.throws(() => resolveStoragePath("../../.env"), /úložisk/i);
});

test("executable active content is rejected", () => {
  assert.equal(isAllowedDocument("text/html", "payload.html"), false);
  assert.equal(isAllowedDocument("image/svg+xml", "payload.svg"), false);
  assert.equal(isAllowedDocument("application/pdf", "material.pdf"), true);
});

test("MIME and extension must agree", () => {
  assert.equal(isAllowedDocument("application/pdf", "material.html"), false);
  assert.equal(isAllowedDocument("image/png", "image.png"), true);
});
