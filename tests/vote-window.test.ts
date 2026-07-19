import assert from "node:assert/strict";
import test from "node:test";
import { isPollOpen } from "../src/lib/tokens";

const base = {
  status: "active",
  startAt: new Date("2026-07-20T10:00:00Z"),
  endAt: new Date("2026-07-20T11:00:00Z"),
};

test("poll is closed before start", () => {
  assert.equal(isPollOpen(base, new Date("2026-07-20T09:59:59Z")), false);
});

test("poll is open inside the inclusive window", () => {
  assert.equal(isPollOpen(base, new Date("2026-07-20T10:30:00Z")), true);
});

test("poll is closed after end or while closing", () => {
  assert.equal(isPollOpen(base, new Date("2026-07-20T11:00:01Z")), false);
  assert.equal(isPollOpen({ ...base, status: "closing" }, new Date("2026-07-20T10:30:00Z")), false);
});
