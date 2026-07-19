import assert from "node:assert/strict";
import test from "node:test";
import { signSealedPdfAccess, verifySealedPdfAccess } from "../src/lib/protocolEmail";

test("sealed protocol signatures expire and bind the poll", () => {
  const now = Date.now();
  const expiresAt = now + 60_000;
  const signed = `${expiresAt}.${signSealedPdfAccess("poll-a", expiresAt)}`;
  assert.equal(verifySealedPdfAccess("poll-a", signed, now), true);
  assert.equal(verifySealedPdfAccess("poll-b", signed, now), false);
  assert.equal(verifySealedPdfAccess("poll-a", signed, expiresAt + 1), false);
});
