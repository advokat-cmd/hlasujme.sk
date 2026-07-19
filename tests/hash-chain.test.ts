import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("audit chain uses deterministic sequence ordering", () => {
  const source = readFileSync("src/lib/hashChain.ts", "utf8");
  assert.match(source, /orderBy:\s*\{\s*sequence:\s*"desc"/);
  assert.match(source, /orderBy:\s*\{\s*sequence:\s*"asc"/);
});
