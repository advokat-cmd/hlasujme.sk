import assert from "node:assert/strict";
import test from "node:test";
import { hasSealedProtocol } from "../src/lib/protocolAvailability";

test("a local sealed PDF enables protocol delivery without a Drive id", () => {
  assert.equal(hasSealedProtocol({ pdfPath: "sealed/zapisnica.pdf" }), true);
  assert.equal(hasSealedProtocol({ pdfPath: "" }), false);
  assert.equal(hasSealedProtocol(null), false);
});
