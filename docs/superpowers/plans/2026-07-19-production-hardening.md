# Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct every finding from the 19 July 2026 audit and make Hlasujme safe for legally significant voting on Hetzner without touching Lemon-owned data in the shared PostgreSQL database.

**Architecture:** PostgreSQL schema `hlasujme` is the sole authority for voting locks, sessions, rate limits, audit order, and sealed results. Security-sensitive route handlers delegate validation and deterministic calculations to small tested helpers, then recheck mutable state inside database transactions. Persistent local storage is confined to a configured directory and Google Drive remains backup-only.

**Tech Stack:** Next.js 16.2.9 App Router, React 19, TypeScript 5, Prisma 6/PostgreSQL, Node `crypto`, Node test runner through `tsx`, PDFKit.

## Global Constraints

- Production runs on Hetzner, not Vercel/serverless.
- Database `lemon` is shared; this project may access and mutate only schema `hlasujme`.
- Never run `prisma migrate reset`, `prisma db push --force-reset`, `scripts/clear-db.ts`, seed, truncate, or destructive SQL against the production `hlasujme` schema or any Lemon-owned schema.
- All behavior changes use red-green-refactor TDD.
- Installed Next.js 16 documentation under `node_modules/next/dist/docs/` is authoritative.
- Vote rows and audit rows remain append-only.
- Email and Google Drive failures must not roll back authoritative voting data.

---

## File map

- `src/lib/security/input.ts`: pure parsing and validation of dates, answers, shares, roles, MIME types, and passwords.
- `src/lib/security/passwords.ts`: cryptographic temporary-password generation.
- `src/lib/security/clientIp.ts`: normalized trusted-proxy client address extraction.
- `src/lib/security/rateLimit.ts`: PostgreSQL-backed atomic limiter.
- `src/lib/security/html.ts`: email-preview HTML sanitizer.
- `src/lib/pollLock.ts`: Hlasujme-namespaced PostgreSQL advisory lock.
- `src/lib/seal.ts`: canonical JSON and SHA-256 helpers.
- `src/lib/storage.ts`: configured storage root and path confinement.
- `src/lib/session.ts`: database-backed session lifecycle and current-role verification.
- `tests/*.test.ts`: pure regression suites; `tests/integration/*.test.ts` uses only an explicitly disposable database/schema.
- `prisma/migrations/20260719_production_hardening/migration.sql`: additive, schema-confined migration.
- `prisma.config.ts`: Prisma seed/config replacement for deprecated package metadata.

---

### Task 1: Test harness and production invariants

**Files:**
- Modify: `package.json`
- Modify: `eslint.config.mjs`
- Modify: `AGENTS.md`
- Create: `tests/config.test.ts`
- Create: `prisma.config.ts`

**Interfaces:**
- Produces: `npm test`, `npm run test:integration`, and documented Hetzner/database constraints used by every later task.

- [ ] **Step 1: Write the failing configuration test**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("AI instructions pin Hetzner and isolate the hlasujme schema", () => {
  const text = readFileSync("AGENTS.md", "utf8");
  assert.match(text, /Hetzner/);
  assert.match(text, /database `lemon`/);
  assert.match(text, /schema `hlasujme`/);
  assert.match(text, /must not.*Lemon-owned/is);
});

test("eslint excludes the non-production prototype", () => {
  const text = readFileSync("eslint.config.mjs", "utf8");
  assert.match(text, /Working prototype development\/\*\*/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx tsx --test tests/config.test.ts`

Expected: FAIL because `AGENTS.md` lacks the deployment/database constraints and ESLint does not ignore the prototype.

- [ ] **Step 3: Add scripts and guarded instructions**

Add to `package.json` scripts:

```json
"test": "tsx --test tests/**/*.test.ts",
"test:integration": "tsx --test tests/integration/**/*.test.ts",
"check": "npm run test && npm run lint && tsc --noEmit --pretty false && next build"
```

Add `Working prototype development/**` to `globalIgnores`, remove `package.json#prisma`, create `prisma.config.ts` with `defineConfig({ schema: "prisma/schema.prisma", migrations: { seed: "tsx prisma/seed.ts" } })`, and append this exact operational block to `AGENTS.md`:

```md
## Production environment and database boundary

- Production runs on a persistent Hetzner server, not Vercel/serverless.
- Hlasujme shares PostgreSQL database `lemon` but owns only schema `hlasujme`.
- Commands and migrations in this repository must not read, alter, reset, truncate, seed, or delete Lemon-owned schemas or tables.
- Before any destructive database or migration-test command, verify an explicitly disposable database/schema; never use the production `hlasujme` schema.
- Supporting files and sealed PDFs use persistent server storage; Google Drive is backup-only.
```

- [ ] **Step 4: Run GREEN and configuration validation**

Run: `npx tsx --test tests/config.test.ts && npx prisma validate`

Expected: PASS with no deprecated `package.json#prisma` warning.

- [ ] **Step 5: Commit**

```powershell
git add AGENTS.md package.json eslint.config.mjs prisma.config.ts tests/config.test.ts
git commit -m "chore: document Hetzner database boundaries"
```

---

### Task 2: Pure security validators and cryptographic passwords

**Files:**
- Create: `src/lib/security/input.ts`
- Create: `src/lib/security/passwords.ts`
- Create: `tests/security-input.test.ts`
- Modify: `src/app/api/admin/poll/route.ts`
- Modify: `src/app/api/auth/change-password/route.ts`

**Interfaces:**
- Produces: `parseVoteAnswers(value, questionNos)`, `validatePollInput(value)`, `validateOwners(value, coMode)`, `validateNewPassword(value)`, `generateTemporaryPassword(bytes?)`.

- [ ] **Step 1: Write failing validator tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  parseVoteAnswers,
  validateNewPassword,
  validateOwners,
  validatePollInput,
} from "../src/lib/security/input";
import { generateTemporaryPassword } from "../src/lib/security/passwords";

test("vote answers reject unknown questions and enum values", () => {
  assert.throws(() => parseVoteAnswers({ "1": "yes" }, new Set([1])), /odpoveď/i);
  assert.throws(() => parseVoteAnswers({ "2": "agree" }, new Set([1])), /otázk/i);
});

test("poll dates require a finite increasing interval", () => {
  assert.throws(() => validatePollInput({ basics: { title: "x", reason: "x", start: "bad", end: "bad" }, questions: [{ text: "x", majority: "half-all" }] }), /dátum/i);
});

test("internal shares are positive and total one", () => {
  assert.throws(() => validateOwners([{ first: "A", last: "B", share: 0 }], "internal"), /podiel/i);
  assert.throws(() => validateOwners([{ first: "A", last: "B", share: 0.6 }], "internal"), /100/i);
});

test("password policy requires twelve characters", () => {
  assert.throws(() => validateNewPassword("short"), /12/);
});

test("temporary passwords have cryptographic-sized entropy and no fixed default", () => {
  const values = new Set(Array.from({ length: 50 }, () => generateTemporaryPassword()));
  assert.equal(values.size, 50);
  for (const value of values) assert.ok(value.length >= 20);
  assert.ok(!values.has("demo1234"));
});
```

- [ ] **Step 2: Run the suite and verify RED**

Run: `npx tsx --test tests/security-input.test.ts`

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement minimal pure helpers**

Implement allowlists for `agree|disagree|abstain`, Prisma majority values, and roles; reject non-finite numbers and unknown object keys. Use a share tolerance of `1e-6`. Implement passwords as `randomBytes(bytes).toString("base64url")` with a default of 18 bytes. Return typed normalized data rather than unchecked casts.

- [ ] **Step 4: Wire poll creation and password change to helpers**

`POST /api/admin/poll` must use `validatePollInput`, query for an existing active/closing poll in the same building, and return `409` on conflict. Password change must call `validateNewPassword` before Argon2 hashing.

- [ ] **Step 5: Run GREEN**

Run: `npm test`

Expected: all pure suites PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/security src/app/api/admin/poll/route.ts src/app/api/auth/change-password/route.ts tests/security-input.test.ts
git commit -m "fix: validate security-sensitive input"
```

---

### Task 3: Schema-confined migration, sessions, and account protection

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260719_production_hardening/migration.sql`
- Modify: `src/lib/session.ts`
- Create: `src/lib/security/accounts.ts`
- Create: `tests/accounts.test.ts`
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/api/auth/logout/route.ts`
- Modify: `src/app/api/auth/change-password/route.ts`
- Modify: `src/app/api/admin/unit/route.ts`
- Modify: `src/app/api/admin/unit/[id]/route.ts`
- Modify: `src/app/api/admin/unit/[id]/owner/[ownerId]/send-credentials/route.ts`

**Interfaces:**
- Produces: `createAdminSession(admin)`, `getAdminSession()`, `revokeAdminSessions(adminId)`, `assertAccountMutationAllowed(actor, target, requestedRole)`, `assertOwnerBelongsToUnit(owner, unitId)`.

- [ ] **Step 1: Write failing account-policy tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { assertAccountMutationAllowed, assertOwnerBelongsToUnit } from "../src/lib/security/accounts";

test("normal admin cannot mutate superadmin", () => {
  assert.throws(() => assertAccountMutationAllowed({ role: "admin", adminId: "a" }, { id: "s", role: "superadmin" }, "vlastnik"), /superadmin/i);
});

test("owner credentials require matching unit", () => {
  assert.throws(() => assertOwnerBelongsToUnit({ unitId: "u2" }, "u1"), /jednotk/i);
});

test("only superadmin can assign privileged roles", () => {
  assert.throws(() => assertAccountMutationAllowed({ role: "admin", adminId: "a" }, null, "admin"), /oprávnen/i);
});
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test tests/accounts.test.ts`

Expected: FAIL because `accounts.ts` is missing.

- [ ] **Step 3: Add additive schema changes and migration**

Add `AdminSession` with `id`, unique `tokenHash`, `adminId`, `expiresAt`, `revokedAt`, `createdAt`, `lastSeenAt`, and cascade relation to `Admin`. Extend `PollStatus` with `closing`, `SealedResult` with nullable `resultSha256`, and `AuditLog` with a unique autoincrementing `sequence BigInt`. The SQL migration must begin with:

```sql
SET search_path TO hlasujme;
DO $$ BEGIN
  IF current_schema() <> 'hlasujme' THEN
    RAISE EXCEPTION 'Refusing migration outside schema hlasujme';
  END IF;
END $$;
```

Use only schema-qualified `"hlasujme"."Table"` references. Add a partial unique index preventing more than one `active` or `closing` poll per building.

- [ ] **Step 4: Implement database-backed sessions**

Generate 32 random bytes, store only SHA-256 in `AdminSession`, and put the plaintext random value in the HTTP-only cookie. `getAdminSession` hashes the cookie, joins the current `Admin`, rejects/revokes expired rows, and returns the current database role. Delete the self-contained JSON session implementation. Revoke sessions after password, role, or account changes.

- [ ] **Step 5: Protect account mutations**

Before every admin upsert, query email conflicts explicitly. Return `409` when an email belongs to another owner/admin. Verify `owner.unitId === unitId`; never pair independently fetched records. Remove `demo1234`, use `generateTemporaryPassword`, and prevent a non-superadmin from assigning `admin`/`superadmin` or mutating a superadmin.

- [ ] **Step 6: Run GREEN and schema checks**

Run: `npm test && npx prisma validate && npx prisma generate`

Expected: all tests PASS and Prisma client generation succeeds.

- [ ] **Step 7: Commit**

```powershell
git add prisma src/lib/session.ts src/lib/security/accounts.ts src/app/api/auth src/app/api/admin/unit tests/accounts.test.ts
git commit -m "fix: enforce revocable sessions and account boundaries"
```

---

### Task 4: PostgreSQL rate limiting and trusted client addresses

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/migrations/20260719_production_hardening/migration.sql`
- Create: `src/lib/security/clientIp.ts`
- Create: `src/lib/security/rateLimit.ts`
- Delete: `src/lib/rateLimit.ts`
- Create: `tests/client-ip.test.ts`
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/api/vote/[token]/route.ts`

**Interfaces:**
- Produces: `getClientIp(headers, trustProxy): string`, `consumeRateLimit({ action, key, limit, windowMs }): Promise<{ allowed: boolean; retryAfterSeconds: number }>`.

- [ ] **Step 1: Write failing proxy parsing tests**

```ts
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
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test tests/client-ip.test.ts`

Expected: FAIL because `clientIp.ts` is missing.

- [ ] **Step 3: Add `RateLimitBucket` and atomic consume logic**

Model key: `(action, key, windowStart)`, with integer `count` and `expiresAt`. Execute this parameterized statement through Prisma `$queryRaw`:

```sql
INSERT INTO "hlasujme"."RateLimitBucket"
  ("action", "key", "windowStart", "count", "expiresAt")
VALUES
  ($1, $2, $3, 1, $4)
ON CONFLICT ("action", "key", "windowStart")
DO UPDATE SET "count" = "hlasujme"."RateLimitBucket"."count" + 1
RETURNING "count", "expiresAt";
```

Delete expired rows opportunistically at most once per minute through a database advisory lock, not a process timer.

- [ ] **Step 4: Replace route integrations**

Use separate action keys `login` and `vote`, SHA-256 the normalized address before storage, return `Retry-After`, and configure proxy trust through `TRUST_PROXY=1` on Hetzner only when the reverse proxy overwrites forwarding headers.

- [ ] **Step 5: Run GREEN**

Run: `npm test && npx prisma validate`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add prisma src/lib/security src/app/api/auth/login/route.ts src/app/api/vote tests/client-ip.test.ts
git commit -m "fix: persist rate limits in PostgreSQL"
```

---

### Task 5: Vote-window enforcement and atomic poll locking

**Files:**
- Create: `src/lib/pollLock.ts`
- Modify: `src/lib/tokens.ts`
- Modify: `src/app/api/vote/[token]/route.ts`
- Create: `tests/vote-window.test.ts`
- Create: `tests/integration/vote-close-lock.test.ts`

**Interfaces:**
- Produces: `isPollOpen(poll, now): boolean`, `acquirePollLock(tx, pollId): Promise<void>`, and a vote transaction that revalidates under the shared lock.

- [ ] **Step 1: Write failing window tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { isPollOpen } from "../src/lib/tokens";

const base = { status: "active", startAt: new Date("2026-07-20T10:00:00Z"), endAt: new Date("2026-07-20T11:00:00Z") };

test("poll is closed before start", () => assert.equal(isPollOpen(base, new Date("2026-07-20T09:59:59Z")), false));
test("poll is open inside the inclusive window", () => assert.equal(isPollOpen(base, new Date("2026-07-20T10:30:00Z")), true));
test("poll is closed after end or while closing", () => {
  assert.equal(isPollOpen(base, new Date("2026-07-20T11:00:01Z")), false);
  assert.equal(isPollOpen({ ...base, status: "closing" }, new Date("2026-07-20T10:30:00Z")), false);
});
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test tests/vote-window.test.ts`

Expected: FAIL because `isPollOpen` is missing and current validation accepts pre-start access.

- [ ] **Step 3: Implement namespaced locking and route validation**

Derive the two-key advisory lock from a fixed Hlasujme namespace integer and a stable 32-bit hash of `pollId`; call `SELECT pg_advisory_xact_lock(namespace, pollKey)`. Parse answers before the transaction. Inside the transaction acquire the lock, refetch token/poll/unit/owner, call `isPollOpen`, then compute and insert versions. Log every inserted authoritative vote version after commit without plaintext tokens.

- [ ] **Step 4: Add disposable-schema concurrency test**

The integration test must refuse to run unless `TEST_DATABASE_URL` contains a schema matching `^hlasujme_test_[a-z0-9_]+$`. It starts a vote and close concurrently, asserts exactly one lock order, and verifies either the vote is in the seal snapshot or the vote returns `409`; a committed omitted vote is forbidden.

- [ ] **Step 5: Run GREEN**

Run: `npm test`

If disposable PostgreSQL is configured, also run: `npm run test:integration`.

Expected: pure tests PASS; integration test PASS or is explicitly skipped because `TEST_DATABASE_URL` is absent.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/pollLock.ts src/lib/tokens.ts src/app/api/vote tests/vote-window.test.ts tests/integration/vote-close-lock.test.ts
git commit -m "fix: serialize votes with poll closing"
```

---

### Task 6: Eligible-unit and co-owner tally correctness

**Files:**
- Modify: `src/lib/engine.ts`
- Modify: `src/app/api/admin/unit/route.ts`
- Modify: `src/app/api/admin/unit/[id]/route.ts`
- Create: `tests/engine.test.ts`

**Interfaces:**
- Produces: exported pure `computeEffectiveVote` and `computeTally` helpers with validated inputs; database loader filters `status: "active"`.

- [ ] **Step 1: Write failing engine regressions**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { computeTalliesFromRows } from "../src/lib/engine";

test("inactive units do not affect total or threshold", () => {
  const result = computeTalliesFromRows({
    majorityType: "half_all",
    units: [
      { id: "active", status: "active", votes: 1, coMode: "single", owners: [] },
      { id: "inactive", status: "inactive", votes: 100, coMode: "single", owners: [] },
    ],
    votes: [{ unitId: "active", answer: "agree" }],
    subvotes: [],
    closed: false,
  });
  assert.equal(result.total, 1);
  assert.equal(result.status, "approved");
});

test("internal ownership requires more than one half", () => {
  const result = computeTalliesFromRows({
    majorityType: "half_all",
    units: [{ id: "u", status: "active", votes: 1, coMode: "internal", owners: [{ id: "a", share: 0.5 }, { id: "b", share: 0.5 }] }],
    votes: [],
    subvotes: [{ unitId: "u", ownerId: "a", answer: "agree" }, { unitId: "u", ownerId: "b", answer: "disagree" }],
    closed: false,
  });
  assert.equal(result.disputed, 1);
});
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test tests/engine.test.ts`

Expected: FAIL because the pure entry point is missing and current DB loader includes inactive units.

- [ ] **Step 3: Extract pure tally core and filter eligibility**

Keep exact statutory threshold formulas. Filter inactive units before total calculation, reject non-positive/non-integer vote weights, and retain strict `share > 0.5` for internal consensus. Query `db.unit.findMany({ where: { buildingId, status: "active" } })`.

- [ ] **Step 4: Enforce owner validation in create/update routes**

Call `validateOwners`; never use `o.share || 1.0`. Persist the normalized explicit share and reject invalid unit vote weights or owner/unit relationships with `400`.

- [ ] **Step 5: Run GREEN**

Run: `npm test`

Expected: all engine and security tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/engine.ts src/app/api/admin/unit tests/engine.test.ts
git commit -m "fix: count only eligible voting units"
```

---

### Task 7: Idempotent close and independent result/PDF seals

**Files:**
- Create: `src/lib/seal.ts`
- Modify: `src/lib/pdf.ts`
- Modify: `src/app/api/admin/poll/[id]/close/route.ts`
- Modify: `src/app/api/sealed/[pollId]/pdf/route.ts`
- Create: `tests/seal.test.ts`

**Interfaces:**
- Produces: `canonicalJson(value): string`, `sha256Hex(data): string`, `verifySha256(data, expected): boolean`, idempotent close response.

- [ ] **Step 1: Write failing seal tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256Hex, verifySha256 } from "../src/lib/seal";

test("canonical JSON ignores object insertion order", () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
});

test("result and PDF hashes detect independent tampering", () => {
  const resultHash = sha256Hex(canonicalJson({ approved: true }));
  const pdfHash = sha256Hex(Buffer.from("pdf"));
  assert.equal(verifySha256(canonicalJson({ approved: false }), resultHash), false);
  assert.equal(verifySha256(Buffer.from("changed"), pdfHash), false);
});
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test tests/seal.test.ts`

Expected: FAIL because `seal.ts` is missing.

- [ ] **Step 3: Implement deterministic seal helpers**

Recursively sort plain-object keys, preserve array order, reject unsupported values, encode UTF-8, and compare hash buffers with `timingSafeEqual`.

- [ ] **Step 4: Rework closing around the shared lock**

Acquire the poll lock, transition `active -> closing` with a guarded update, calculate one canonical result snapshot, generate PDF from that exact snapshot, persist PDF under the confined storage root, then atomically create `SealedResult(resultJson, resultSha256, sha256)` and set `closed`. On retry, return the existing seal. Never regenerate a different snapshot for an already sealed poll.

- [ ] **Step 5: Verify artifacts before download**

Recompute the local/Drive PDF hash and return `409` on mismatch. Verify `resultSha256` before parsing new records; mark null-hash records as legacy. Replace timeless protocol signatures with `pollId.expiresAt.signature` and enforce expiry.

- [ ] **Step 6: Run GREEN**

Run: `npm test`

Expected: all seal tests PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/seal.ts src/lib/pdf.ts src/app/api/admin/poll src/app/api/sealed tests/seal.test.ts
git commit -m "fix: seal one atomic result snapshot"
```

---

### Task 8: Authorized, non-executable document handling

**Files:**
- Create: `src/lib/storage.ts`
- Create: `src/lib/security/documents.ts`
- Create: `tests/documents.test.ts`
- Modify: `src/app/api/admin/poll/[id]/upload/route.ts`
- Modify: `src/app/api/document/[id]/route.ts`
- Delete: `src/app/api/file/[fileId]/route.ts`
- Modify: `src/app/hlasuj/[token]/page.tsx`
- Modify: `src/app/api/admin/poll/[id]/files/route.ts`

**Interfaces:**
- Produces: `resolveStoragePath(relative): string`, `validateDocumentUpload(file): Promise<NormalizedDocument>`, `authorizeDocumentAccess(document, voteToken, session)`.

- [ ] **Step 1: Write failing path/MIME tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { resolveStoragePath } from "../src/lib/storage";
import { isAllowedDocument } from "../src/lib/security/documents";

test("storage rejects traversal outside configured root", () => {
  assert.throws(() => resolveStoragePath("../../.env"), /úložisk/i);
});

test("executable active content is rejected", () => {
  assert.equal(isAllowedDocument("text/html", "payload.html"), false);
  assert.equal(isAllowedDocument("image/svg+xml", "payload.svg"), false);
  assert.equal(isAllowedDocument("application/pdf", "material.pdf"), true);
});
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test tests/documents.test.ts`

Expected: FAIL because both helpers are missing.

- [ ] **Step 3: Implement storage confinement and allowlist**

Require absolute `STORAGE_ROOT` in production, resolve and compare with `path.relative`, allow PDF, PNG, JPEG, DOCX, XLSX, and plain text only, and verify PDF/image/ZIP-container magic bytes. Store generated UUID filenames rather than user names.

- [ ] **Step 4: Require document authorization**

The download route accepts a vote token query parameter or current session. A vote token must belong to the same poll as the document and still identify the unit/owner; an owner session must belong to that poll's building. Return every document as `attachment`, add `Cache-Control: private, no-store`, and remove the arbitrary Drive proxy route.

- [ ] **Step 5: Update voter URLs**

Serialize document URLs as `/api/document/{id}?token={voteToken}` only inside the token-authorized voter page. Do not persist plaintext vote tokens in the database or logs.

- [ ] **Step 6: Run GREEN**

Run: `npm test`

Expected: all document tests PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/storage.ts src/lib/security/documents.ts src/app/api/admin/poll src/app/api/document src/app/hlasuj tests/documents.test.ts
git add -u src/app/api/file
git commit -m "fix: authorize and constrain voting documents"
```

---

### Task 9: HTML sanitization, CSP, protocol authorization, and audit order

**Files:**
- Create: `src/lib/security/html.ts`
- Create: `tests/html.test.ts`
- Modify: `src/components/admin/EmailTemplateEditor.tsx`
- Modify: `src/components/admin/PollDetailView.tsx`
- Modify: `src/components/admin/SettingsView.tsx`
- Modify: `next.config.ts`
- Modify: `src/app/api/sealed/[pollId]/pdf/route.ts`
- Modify: `src/lib/hashChain.ts`
- Create: `tests/hash-chain.test.ts`

**Interfaces:**
- Produces: `sanitizeEmailPreview(html): string`; audit queries order by `sequence`.

- [ ] **Step 1: Write failing sanitizer and ordering tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeEmailPreview } from "../src/lib/security/html";

test("preview sanitizer removes active content", () => {
  const clean = sanitizeEmailPreview('<img src=x onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">x</a>');
  assert.doesNotMatch(clean, /onerror|script|javascript:/i);
});
```

Add a source-invariant test that asserts `hashChain.ts` orders both append lookup and verification by `sequence`, not only `createdAt`.

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test tests/html.test.ts tests/hash-chain.test.ts`

Expected: FAIL because sanitizer is missing and hash-chain ordering uses timestamps.

- [ ] **Step 3: Implement an allowlist sanitizer**

Allow only email formatting tags (`p`, `br`, `strong`, `em`, `ul`, `ol`, `li`, `a`, `span`, `div`) and safe attributes (`href` with `https:|mailto:`, `title`, limited inline text styles). Escape or remove everything else. Sanitize immediately before each admin preview render.

- [ ] **Step 4: Harden CSP and protocol access**

Read `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`. Remove `unsafe-eval` from production script policy and do not permit inline script handlers. For protocol PDFs, require either a valid unexpired HMAC link or a current account authorized for the poll's building; do not treat any session as universal authorization.

- [ ] **Step 5: Use monotonic audit ordering**

Order latest lookup by `sequence: "desc"` and verification by `sequence: "asc"`. Include draft vote-version creation in the audit chain and retain the advisory append lock.

- [ ] **Step 6: Run GREEN**

Run: `npm test && npm run lint`

Expected: tests PASS and lint has zero errors.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/security/html.ts src/components/admin next.config.ts src/app/api/sealed src/lib/hashChain.ts tests/html.test.ts tests/hash-chain.test.ts
git commit -m "fix: harden previews protocols and audit order"
```

---

### Task 10: Complete lint remediation and deployment verification

**Files:**
- Modify: lint-reported files under `src/`
- Modify: `next.config.ts`
- Modify: `README.md`
- Modify: `scripts/clear-db.ts`
- Create: `scripts/check-db-boundary.ts`

**Interfaces:**
- Produces: clean `npm run check`; destructive scripts refuse shared/production schemas.

- [ ] **Step 1: Add a failing database-boundary check test**

Extend `tests/config.test.ts` to execute the exported parser from `scripts/check-db-boundary.ts` and assert that destructive operations reject database `lemon` with schema `hlasujme`, reject schema `public`, and accept only names matching `hlasujme_test_*` when `ALLOW_DESTRUCTIVE_TEST_DB=1`.

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test tests/config.test.ts`

Expected: FAIL because `check-db-boundary.ts` is missing.

- [ ] **Step 3: Guard destructive scripts and document Hetzner deployment**

Make `clear-db.ts` call the boundary checker before any delete. Document `prisma migrate deploy`, `STORAGE_ROOT`, `TRUST_PROXY`, backup verification, and the shared `lemon`/`hlasujme` boundary in `README.md`. Never include real credentials.

- [ ] **Step 4: Fix remaining production lint errors without disabling rules**

Replace render-time randomness with `useId`, replace `any` with explicit interfaces or `unknown` narrowing, rename non-hook PDF font callbacks so they do not begin with `use`, convert immutable `let` bindings to `const`, and remove unused values. Do not add blanket ESLint disables.

- [ ] **Step 5: Remove the broad NFT trace warning**

Use `STORAGE_ROOT` plus narrowly scoped static storage subdirectories and the installed Next.js 16 tracing guidance so `next build` no longer traces the project root from `process.cwd()`.

- [ ] **Step 6: Run complete verification**

Run sequentially:

```powershell
npm test
npm run lint
npx tsc --noEmit --pretty false
npx prisma validate
npx prisma generate
npm run build
npm audit --omit=dev --audit-level=high
git diff --check
git status --short
```

Expected: tests, lint, typecheck, Prisma validation/generation, build, audit high/critical gate, and whitespace check all exit `0`. Build has no broad project-tracing warning. `git status` lists only intentional implementation files before the final commit.

- [ ] **Step 7: Run browser smoke test**

Start the production server on an unused local port. Verify login renders, an unauthenticated admin endpoint returns `401` or `403`, an invalid vote token returns the Slovak invalid-link screen when the disposable database is available, executable uploads are rejected, and CSP/HSTS/nosniff headers are present. Stop the test server afterward.

- [ ] **Step 8: Commit**

```powershell
git add README.md scripts src next.config.ts tests package.json prisma
git commit -m "chore: complete production hardening verification"
```

---

## Final review gate

- Re-read `docs/superpowers/specs/2026-07-19-production-hardening-design.md` and map every completion criterion to Tasks 1–10.
- Inspect every migration statement for an explicit `hlasujme` schema target and absence of Lemon-owned object names.
- Inspect `git diff main...HEAD` for secrets, plaintext tokens, default passwords, unchecked role casts, and destructive database commands.
- Run the complete verification commands from Task 10 using fresh output before making any completion claim.
