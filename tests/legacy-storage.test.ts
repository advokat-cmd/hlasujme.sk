import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { planLegacyRelocation, relocateLegacyFile } from "../src/lib/legacyStorage";

test("legacy relocation copies and verifies a /storage path", () => {
  const sandbox = mkdtempSync(path.join(tmpdir(), "hlasujme-legacy-"));
  const legacyRoot = path.join(sandbox, "legacy-storage");
  const storageRoot = path.join(sandbox, "persistent-storage");
  const source = path.join(legacyRoot, "sealed", "protocol.pdf");
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(source, "sealed-bytes");
  try {
    const plan = planLegacyRelocation("/storage/sealed/protocol.pdf", legacyRoot, storageRoot);
    assert.ok(plan);
    const result = relocateLegacyFile(plan, false);
    assert.equal(result.copied, true);
    assert.equal(readFileSync(plan.destinationPath, "utf8"), "sealed-bytes");
    assert.equal(result.sourceSha256, result.destinationSha256);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("legacy relocation dry run writes nothing and rejects traversal", () => {
  const sandbox = mkdtempSync(path.join(tmpdir(), "hlasujme-legacy-"));
  const legacyRoot = path.join(sandbox, "legacy-storage");
  const storageRoot = path.join(sandbox, "persistent-storage");
  try {
    assert.throws(() => planLegacyRelocation("/storage/../../.env", legacyRoot, storageRoot), /mimo/i);
    const plan = planLegacyRelocation("/storage/uploads/poll/file.pdf", legacyRoot, storageRoot);
    assert.ok(plan);
    mkdirSync(path.dirname(plan.sourcePath), { recursive: true });
    writeFileSync(plan.sourcePath, "legacy-bytes");
    relocateLegacyFile(plan, true);
    assert.equal(existsSync(plan.destinationPath), false);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});
