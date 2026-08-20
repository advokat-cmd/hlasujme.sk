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
  const cleanInactive = workflow.indexOf('find "$RELEASES_DIR"');
  const fetch = workflow.indexOf('fetch origin main');
  const build = workflow.indexOf("npm run build");
  const switchLive = workflow.indexOf('mv -Tf "$CURRENT_LINK.new" "$CURRENT_LINK"');
  assert.match(workflow, /git[^\n]*worktree add --detach/);
  assert.match(workflow, /CURRENT_TARGET[\s\S]*resolved[\s\S]*"\$resolved" != "\$CURRENT_TARGET"/);
  assert.match(workflow, /CURRENT_TARGET="\$\(readlink -f "\$CURRENT_LINK"\)"[\s\S]*test -n "\$CURRENT_TARGET"[\s\S]*test -d "\$CURRENT_TARGET"/);
  assert.match(workflow, /live_target[\s\S]*-n "\$live_target"[\s\S]*git -c safe\.directory/);
  assert.doesNotMatch(workflow, /git config --global/);
  assert.match(workflow, /case "\$resolved"[\s\S]*"\$RELEASES_DIR"\/\*/);
  assert.match(workflow, /cleanup_failed_release[\s\S]*SWITCHED[\s\S]*CURRENT_LINK\.rollback[\s\S]*git[^\n]*worktree remove --force/);
  assert.ok(cleanInactive >= 0 && cleanInactive < fetch, "inactive releases must be removed before fetch can need free disk space");
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

test("production email assignment is scoped, backed up, and preserves the complete expected state", () => {
  const workflow = readFileSync(".github/workflows/assign-register-emails.yml", "utf8");
  const script = readFileSync("scripts/assign-register-emails.ts", "utf8");
  assert.match(workflow, /pg_dump[\s\S]*--schema=hlasujme/);
  assert.match(workflow, /ASSIGN_VERIFIED_EMAILS/);
  assert.match(script, /pathname\.replace[\s\S]*"lemon"[\s\S]*"hlasujme"/);
  assert.match(script, /ensureExistingEmailsAreCovered/);
  assert.match(script, /current\.pollCount !== 0/);
  assert.match(script, /adminCount !== expectedAdminCount/);
});

test("single-owner email repair is scoped, backed up, and explicitly confirmed", () => {
  const workflow = readFileSync(".github/workflows/sync-single-owner-emails.yml", "utf8");
  const script = readFileSync("scripts/sync-single-owner-emails.ts", "utf8");
  assert.match(workflow, /pg_dump[\s\S]*--schema=hlasujme/);
  assert.match(workflow, /SYNC_SINGLE_OWNER_EMAILS/);
  assert.doesNotMatch(workflow, /test "\$\{\{ inputs\.confirm \}\}"/);
  assert.match(workflow, /git fetch origin main/);
  assert.match(script, /pathname\.replace[\s\S]*"lemon"[\s\S]*"hlasujme"/);
  assert.match(script, /coMode: "single"/);
  assert.match(script, /admins\.length > 1/);
  assert.match(script, /emailAdmin[\s\S]*ownerId !== owner\.id/);
  assert.match(script, /const current = await inspect\(tx\)/);
  assert.match(script, /after\.adminCount !== before\.adminCount/);
});
