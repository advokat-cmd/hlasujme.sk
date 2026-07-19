import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256Hex, verifySha256 } from "../src/lib/seal";

test("canonical JSON ignores object insertion order", () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
});

test("result and PDF hashes detect independent tampering", () => {
  const resultHash = sha256Hex(canonicalJson({ approved: true }));
  const pdfHash = sha256Hex(Buffer.from("pdf"));
  assert.equal(verifySha256(canonicalJson({ approved: false }), resultHash), false);
  assert.equal(verifySha256(Buffer.from("changed"), pdfHash), false);
  assert.equal(verifySha256(Buffer.from("pdf"), pdfHash), true);
});

test("canonical JSON rejects unsupported values", () => {
  assert.throws(() => canonicalJson({ invalid: undefined }), /kanon/i);
});
