import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readStoredFile, resolveStoragePath } from "../src/lib/storage";
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

test("stored files are read only from STORAGE_ROOT", () => {
  const previous = process.env.STORAGE_ROOT;
  const root = mkdtempSync(path.join(tmpdir(), "hlasujme-storage-"));
  process.env.STORAGE_ROOT = root;
  try {
    writeFileSync(path.join(root, "document.pdf"), "local-authority");
    assert.equal(readStoredFile("document.pdf")?.toString(), "local-authority");
    assert.equal(readStoredFile("missing.pdf"), null);
    assert.throws(() => readStoredFile("../../outside.pdf"), /úložisk/i);
  } finally {
    if (previous === undefined) delete process.env.STORAGE_ROOT;
    else process.env.STORAGE_ROOT = previous;
    rmSync(root, { recursive: true, force: true });
  }
});
