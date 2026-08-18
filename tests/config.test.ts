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

test("production build does not depend on downloading Google fonts", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  assert.doesNotMatch(layout, /next\/font\/google/);
});

test("deployment builds in an isolated release before switching the live symlink", () => {
  const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
  const build = workflow.indexOf("npm run build");
  const switchLive = workflow.indexOf('mv -Tf "$CURRENT_LINK.new" "$CURRENT_LINK"');
  assert.match(workflow, /git worktree add --detach/);
  assert.ok(build >= 0 && switchLive > build, "live release must switch only after a successful build");
});

test("production test-data purge is scoped, backed up, and explicitly confirmed", () => {
  const workflow = readFileSync(".github/workflows/purge-test-data.yml", "utf8");
  const script = readFileSync("scripts/purge-test-data.ts", "utf8");
  assert.match(workflow, /pg_dump[\s\S]*--schema=hlasujme/);
  assert.match(workflow, /DELETE_CLOSED_POLLS_AND_TWO_OWNERS/);
  assert.match(script, /pathname\.replace[\s\S]*"lemon"[\s\S]*"hlasujme"/);
  assert.match(script, /summary\.owners !== 2/);
  assert.match(script, /ownerId: \{ not: null \}, role: "vlastnik"/);
  assert.match(script, /Privileged accounts are preserved/);
  assert.match(script, /status: PollStatus\.closed/);
});

test("production unit purge preserves accounts and requires an empty owner registry", () => {
  const workflow = readFileSync(".github/workflows/purge-empty-units.yml", "utf8");
  const script = readFileSync("scripts/purge-empty-units.ts", "utf8");
  assert.match(workflow, /pg_dump[\s\S]*--schema=hlasujme/);
  assert.match(workflow, /DELETE_ALL_CURRENT_UNITS/);
  assert.match(script, /pathname\.replace[\s\S]*"lemon"[\s\S]*"hlasujme"/);
  assert.match(script, /summary\.owners !== 0/);
  assert.match(script, /admin\.count/);
  assert.match(script, /unit\.deleteMany/);
  assert.match(script, /adminCount !== before\.adminCount/);
});
