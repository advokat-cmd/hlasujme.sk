import assert from "node:assert/strict";
import test from "node:test";
import { getClientIp } from "../src/lib/security/clientIp";

test("untrusted mode ignores spoofed forwarded addresses", () => {
  const headers = new Headers({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8" });
  assert.equal(getClientIp(headers, false), "unknown");
});

test("trusted proxy mode takes one normalized rightmost address", () => {
  const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.2" });
  assert.equal(getClientIp(headers, true), "10.0.0.2");
});

test("malformed addresses are rejected", () => {
  const headers = new Headers({ "x-forwarded-for": "not-an-ip" });
  assert.equal(getClientIp(headers, true), "unknown");
});
