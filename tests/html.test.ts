import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeEmailPreview } from "../src/lib/security/html";

test("preview sanitizer removes active content", () => {
  const clean = sanitizeEmailPreview('<img src=x onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">x</a>');
  assert.doesNotMatch(clean, /onerror|script|javascript:/i);
});

test("preview sanitizer preserves basic formatting and safe links", () => {
  const clean = sanitizeEmailPreview('<p><strong>Ahoj</strong> <a href="https://example.com">link</a></p>');
  assert.match(clean, /<p><strong>Ahoj<\/strong>/);
  assert.match(clean, /href="https:\/\/example\.com"/);
});
