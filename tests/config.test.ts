import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("AI instructions pin Hetzner and isolate the hlasujme schema", () => {
  const contents = readFileSync("AGENTS.md", "utf8");
  assert.match(contents, /Hetzner/);
  assert.match(contents, /database `lemon`/);
  assert.match(contents, /schema `hlasujme`/);
  assert.match(contents, /must not[\s\S]*Lemon-owned/i);
});

test("eslint excludes the non-production prototype", () => {
  const contents = readFileSync("eslint.config.mjs", "utf8");
  assert.match(contents, /Working prototype development\/\*\*/);
});
