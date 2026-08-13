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
