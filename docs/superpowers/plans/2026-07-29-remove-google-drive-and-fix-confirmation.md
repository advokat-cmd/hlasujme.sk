# Remove Google Drive and Fix Confirmation Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Google Drive from the application, serve all voting files from persistent server storage, relocate legacy local files safely, and render `{buildingShort}` in vote-confirmation emails.

**Architecture:** `STORAGE_ROOT` is the sole file store, while PostgreSQL keeps relative paths, metadata, hashes, and sealed result JSON. Email rendering is split into a pure renderer plus a database-backed template loader. A dry-run-capable relocation utility copies legacy `/storage/...` files into `STORAGE_ROOT`, verifies SHA-256, and only then permits Hlasujme-owned path updates.

**Tech Stack:** Next.js 16.2.9 route handlers, TypeScript 5, Node test runner via `tsx --test`, Prisma 6.19.3, PostgreSQL, persistent Hetzner filesystem.

## Global Constraints

- Production remains on the persistent Hetzner server.
- Hlasujme may read and update only schema `hlasujme` in database `lemon`.
- No command may read, alter, reset, truncate, seed, or delete Lemon-owned schemas or tables.
- `STORAGE_ROOT` is the sole runtime file store after this change.
- No Google Drive API call or Google credential is required by the application.
- Existing Drive-related database columns remain intact and unused.
- Legacy files are copied and hash-verified; their old copies are not deleted.
- All production implementation follows a failing-test-first red-green cycle.

---

### Task 1: Render the building short name in confirmation emails

**Files:**
- Create: `tests/email.test.ts`
- Modify: `src/lib/email.ts`
- Modify: `src/lib/tokens.ts`
- Modify: `src/app/api/vote/[token]/route.ts`
- Modify: `src/components/admin/SettingsView.tsx`

**Interfaces:**
- Produces: `ConfirmationEmailParams`
- Produces: `renderConfirmationEmail(template: EmailTemplateContent, params: ConfirmationEmailParams): { subject: string; html: string }`
- Changes: `validateVoteToken()` returns `poll.building`
- Consumes: `poll.building.short` in the vote route

- [ ] **Step 1: Write the failing confirmation-renderer test**

Create `tests/email.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { renderConfirmationEmail } from "../src/lib/email";

test("confirmation email replaces buildingShort in subject and body", () => {
  const result = renderConfirmationEmail(
    {
      subject: "Potvrdenie – {buildingShort}: {pollTitle}",
      body: "<p>byt č. {unitNo} vo vchode {buildingShort}</p>",
    },
    {
      ownerName: "Milan Ficek",
      unitNo: "6",
      buildingShort: "Björnsonova 3",
      pollTitle: "Oprava strechy",
      dateFormatted: "29. 7. 2026 18:44",
      answersSummary: [],
    },
  );

  assert.equal(result.subject, "Potvrdenie – Björnsonova 3: Oprava strechy");
  assert.match(result.html, /byt č\. 6 vo vchode Björnsonova 3/);
  assert.doesNotMatch(result.subject + result.html, /\{buildingShort\}/);
});
```

The production change this catches is removal or omission of the
`buildingShort` replacement.

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npx tsx --test tests/email.test.ts
```

Expected: FAIL because `renderConfirmationEmail` is not exported.

- [ ] **Step 3: Add the pure renderer and delegate the database-backed helper**

In `src/lib/email.ts`, define:

```ts
export interface ConfirmationEmailParams {
  ownerName: string;
  unitNo: string;
  buildingShort: string;
  pollTitle: string;
  dateFormatted: string;
  answersSummary: { qNo: number; qTitle: string; answerText: string }[];
}

export function renderConfirmationEmail(
  template: EmailTemplateContent,
  params: ConfirmationEmailParams,
) {
  const answersListHtml = params.answersSummary.map(/* existing literal markup */).join("");
  const replaceAll = (value: string) => value
    .replace(/{ownerName}/g, params.ownerName)
    .replace(/{unitNo}/g, params.unitNo)
    .replace(/{buildingShort}/g, params.buildingShort)
    .replace(/{pollTitle}/g, params.pollTitle)
    .replace(/{dateFormatted}/g, params.dateFormatted)
    .replace(/{answersList}/g, answersListHtml);

  return {
    subject: replaceAll(template.subject),
    html: applyEmailStyles(replaceAll(template.body)),
  };
}
```

Keep `getConfirmationEmail(params)` responsible only for loading the stored or
default template and calling `renderConfirmationEmail`.

- [ ] **Step 4: Load and pass the building**

In `src/lib/tokens.ts`, change the poll include to:

```ts
poll: {
  include: {
    building: true,
    questions: { orderBy: { no: "asc" } },
  },
},
```

In `src/app/api/vote/[token]/route.ts`, pass:

```ts
buildingShort: poll.building.short,
```

Add `{buildingShort}` to the confirmation branch in
`src/components/admin/SettingsView.tsx`.

- [ ] **Step 5: Run targeted and type verification**

Run:

```powershell
npx tsx --test tests/email.test.ts
npx tsc --noEmit --pretty false
```

Expected: PASS with zero TypeScript errors.

- [ ] **Step 6: Commit Task 1**

```powershell
git add -- tests/email.test.ts src/lib/email.ts src/lib/tokens.ts src/app/api/vote/[token]/route.ts src/components/admin/SettingsView.tsx
git commit -m "fix: render building name in vote confirmations"
```

---

### Task 2: Make persistent local storage the only backend file source

**Files:**
- Modify: `tests/documents.test.ts`
- Modify: `src/lib/storage.ts`
- Modify: `src/app/api/admin/poll/route.ts`
- Modify: `src/app/api/admin/poll/[id]/upload/route.ts`
- Modify: `src/app/api/admin/poll/[id]/files/route.ts`
- Modify: `src/app/api/admin/poll/[id]/close/route.ts`
- Modify: `src/app/api/document/[id]/route.ts`
- Modify: `src/app/api/sealed/[pollId]/pdf/route.ts`
- Delete: `src/app/api/admin/poll/[id]/retry-drive-upload/route.ts`
- Delete: `src/lib/gdrive.ts`

**Interfaces:**
- Produces: `readStoredFile(relativePath: string): Buffer | null`
- Preserves: `resolveStoragePath(relativePath: string): string`
- Changes: close response is `{ success, sha256, resultSha256 }`
- Changes: admin file entries are `{ id, name, mimeType, webViewLink }`

- [ ] **Step 1: Write failing real-filesystem tests**

Extend `tests/documents.test.ts`:

```ts
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readStoredFile } from "../src/lib/storage";

test("stored files are read only from STORAGE_ROOT", () => {
  const previous = process.env.STORAGE_ROOT;
  const root = mkdtempSync(path.join(tmpdir(), "hlasujme-storage-"));
  process.env.STORAGE_ROOT = root;
  try {
    writeFileSync(path.join(root, "document.pdf"), "local-authority");
    assert.equal(readStoredFile("document.pdf")?.toString(), "local-authority");
    assert.equal(readStoredFile("missing.pdf"), null);
    assert.throws(() => readStoredFile("../../outside.pdf"), /úložisk/i);
  } finally {
    if (previous === undefined) delete process.env.STORAGE_ROOT;
    else process.env.STORAGE_ROOT = previous;
    rmSync(root, { recursive: true, force: true });
  }
});
```

The production changes this catches are reading outside `STORAGE_ROOT` or
silently treating another remote store as the source.

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npx tsx --test tests/documents.test.ts
```

Expected: FAIL because `readStoredFile` is not exported.

- [ ] **Step 3: Implement the minimal local reader**

In `src/lib/storage.ts`:

```ts
import fs from "node:fs";

export function readStoredFile(relativePath: string): Buffer | null {
  const absolutePath = resolveStoragePath(relativePath);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath) : null;
}
```

- [ ] **Step 4: Remove Drive from poll creation and uploads**

In `src/app/api/admin/poll/route.ts`, remove `createDriveFolder`, folder-name
construction, and `driveFolderId` from poll creation.

In `src/app/api/admin/poll/[id]/upload/route.ts`, keep validation, confined
local write, `PollDocument` creation, question attachment registration, and
audit logging. Remove `createDriveFolder`, `uploadFileToDrive`, and Drive
metadata writes:

```ts
const document = await db.pollDocument.create({
  data: {
    pollId,
    questionNo: questionNo && !Number.isNaN(questionNo) ? questionNo : null,
    name: file.name,
    mimeType,
    size: file.size,
    localPath: relativePath,
  },
});
```

- [ ] **Step 5: Remove Drive from list and download routes**

Make `src/app/api/admin/poll/[id]/files/route.ts` return only:

```ts
const files = poll.documents.map(document => ({
  id: document.id,
  name: document.name,
  mimeType: document.mimeType,
  webViewLink: `/api/document/${document.id}`,
}));
```

Use `readStoredFile(document.localPath)` in the document route and
`readStoredFile(sealedResult.pdfPath)` in the sealed PDF route. Return the
existing 404 when it returns `null`; retain authorization, headers, and sealed
PDF SHA-256 verification.

- [ ] **Step 6: Remove Drive from poll closing**

Delete Drive imports, configuration checks, upload calls, Drive fields in
`sealedResult.create`, Drive audit metadata, and Drive response fields from
`src/app/api/admin/poll/[id]/close/route.ts`.

The success response becomes:

```ts
return NextResponse.json({
  success: true,
  sha256: sealedResult.sha256,
  resultSha256: sealedResult.resultSha256,
});
```

- [ ] **Step 7: Delete the unused Drive backend**

Delete:

```text
src/lib/gdrive.ts
src/app/api/admin/poll/[id]/retry-drive-upload/route.ts
```

- [ ] **Step 8: Run targeted tests and compilation**

Run:

```powershell
npx tsx --test tests/documents.test.ts tests/seal.test.ts tests/protocol-link.test.ts
npx tsc --noEmit --pretty false
```

Expected: PASS with no missing Drive imports.

- [ ] **Step 9: Commit Task 2**

```powershell
git add -A -- src/lib/storage.ts src/lib/gdrive.ts src/app/api/admin/poll src/app/api/document src/app/api/sealed tests/documents.test.ts
git commit -m "refactor: use local storage for voting files"
```

---

### Task 3: Remove Drive gating and language from the UI

**Files:**
- Create: `tests/protocol-availability.test.ts`
- Create: `src/lib/protocolAvailability.ts`
- Modify: `src/components/admin/PollDetailView.tsx`
- Modify: `src/components/admin/CloseModal.tsx`
- Modify: `src/app/admin/(dashboard)/poll/[id]/page.tsx`
- Modify: `src/app/admin/(dashboard)/poll/create/page.tsx`
- Modify: `src/app/hlasuj/[token]/page.tsx`
- Modify: `src/app/hlasuj/[token]/VoterAppClient.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `hasSealedProtocol(value: { pdfPath: string } | null | undefined): boolean`
- Changes: protocol send button depends on a sealed local protocol only
- Changes: file entries no longer expose Drive fields or source labels

- [ ] **Step 1: Write the failing protocol-availability test**

Create `tests/protocol-availability.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { hasSealedProtocol } from "../src/lib/protocolAvailability";

test("a local sealed PDF enables protocol delivery without a Drive id", () => {
  assert.equal(hasSealedProtocol({ pdfPath: "sealed/zapisnica.pdf" }), true);
  assert.equal(hasSealedProtocol({ pdfPath: "" }), false);
  assert.equal(hasSealedProtocol(null), false);
});
```

The production change this catches is reintroducing a remote-backup
requirement for sending an existing sealed protocol.

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npx tsx --test tests/protocol-availability.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement and consume the availability rule**

Create `src/lib/protocolAvailability.ts`:

```ts
export function hasSealedProtocol(
  value: { pdfPath: string } | null | undefined,
): boolean {
  return Boolean(value?.pdfPath.trim());
}
```

In `PollDetailView`, remove Drive fields, retry state, retry handler, backup
warnings, backup link, and `extractDriveFileId`. Render the sealed message:

```tsx
Zápisnica bola úspešne vygenerovaná a bezpečne uložená.
Môžete ju stiahnuť alebo odoslať vlastníkom.
```

Render the send button when `hasSealedProtocol(poll.sealedResult)` is true.

- [ ] **Step 4: Remove remaining Drive UI and serialized fields**

In `CloseModal`, remove the `driveError` alert and describe local generation
without a backup prerequisite.

In the admin poll page, serialize only `pdfPath` and `sha256`.

In poll creation and document views, replace Google Drive wording with
“bezpečne uložené na serveri”.

In the voter page, rename `driveFiles` to `files`; keep the authenticated
`/api/document/<id>?token=...` links. In `VoterAppClient.tsx`, remove
`extractDriveFileId` and use each database-backed attachment URL directly.
Production contains two question attachment links and both already use
`/api/document/...`; no Drive-link data rewrite is needed.

- [ ] **Step 5: Remove the Google client dependency**

Run:

```powershell
npm uninstall googleapis
```

Confirm `package.json` and `package-lock.json` no longer contain `googleapis`.

- [ ] **Step 6: Verify the UI task**

Run:

```powershell
npx tsx --test tests/protocol-availability.test.ts
rg -n -i "google drive|driveFileId|driveFolderId|driveWebViewLink|retry-drive-upload|@/lib/gdrive" src package.json
npx tsc --noEmit --pretty false
```

Expected: the test and TypeScript pass; `rg` returns no runtime references.
Drive-related Prisma schema fields are intentionally excluded from this scan.

- [ ] **Step 7: Commit Task 3**

```powershell
git add -- tests/protocol-availability.test.ts src/lib/protocolAvailability.ts src/components/admin/PollDetailView.tsx src/components/admin/CloseModal.tsx src/app/admin src/app/hlasuj package.json package-lock.json
git commit -m "refactor: remove Google Drive from voting UI"
```

---

### Task 4: Relocate legacy local files without deleting their sources

**Files:**
- Create: `tests/legacy-storage.test.ts`
- Create: `src/lib/legacyStorage.ts`
- Create: `scripts/relocate-legacy-storage.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `LegacyRelocation`
- Produces: `planLegacyRelocation(storedPath, legacyRoot, storageRoot): LegacyRelocation | null`
- Produces: `relocateLegacyFile(plan, dryRun): { copied: boolean; sourceSha256: string; destinationSha256: string }`
- Produces CLI: `npm run storage:relocate-legacy -- --dry-run`

- [ ] **Step 1: Write failing confinement and copy tests**

Create `tests/legacy-storage.test.ts` with real temporary directories:

```ts
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  planLegacyRelocation,
  relocateLegacyFile,
} from "../src/lib/legacyStorage";

test("legacy relocation copies and verifies a /storage path", () => {
  const sandbox = mkdtempSync(path.join(tmpdir(), "hlasujme-legacy-"));
  const legacyRoot = path.join(sandbox, "legacy-storage");
  const storageRoot = path.join(sandbox, "persistent-storage");
  const source = path.join(legacyRoot, "sealed", "protocol.pdf");
  require("node:fs").mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(source, "sealed-bytes");
  try {
    const plan = planLegacyRelocation(
      "/storage/sealed/protocol.pdf",
      legacyRoot,
      storageRoot,
    );
    assert.ok(plan);
    const result = relocateLegacyFile(plan, false);
    assert.equal(result.copied, true);
    assert.equal(readFileSync(plan.destinationPath, "utf8"), "sealed-bytes");
    assert.equal(result.sourceSha256, result.destinationSha256);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("legacy relocation dry run writes nothing and rejects traversal", () => {
  const sandbox = mkdtempSync(path.join(tmpdir(), "hlasujme-legacy-"));
  const legacyRoot = path.join(sandbox, "legacy-storage");
  const storageRoot = path.join(sandbox, "persistent-storage");
  try {
    assert.throws(
      () => planLegacyRelocation("/storage/../../.env", legacyRoot, storageRoot),
      /mimo/i,
    );
    const plan = planLegacyRelocation(
      "/storage/uploads/poll/file.pdf",
      legacyRoot,
      storageRoot,
    );
    assert.ok(plan);
    relocateLegacyFile(plan, true);
    assert.equal(existsSync(plan.destinationPath), false);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});
```

The production changes these catch are path escape, deletion/mutation during
dry run, and unverified copying.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
npx tsx --test tests/legacy-storage.test.ts
```

Expected: FAIL because `src/lib/legacyStorage.ts` does not exist.

- [ ] **Step 3: Implement confined planning and hash-verified copying**

`planLegacyRelocation` accepts only paths beginning `/storage/`, strips that
prefix, validates both resolved paths with `path.relative`, and returns:

```ts
export interface LegacyRelocation {
  storedPath: string;
  normalizedPath: string;
  sourcePath: string;
  destinationPath: string;
}
```

`relocateLegacyFile`:

- verifies the source is a regular file;
- returns without writing in dry-run mode;
- creates only the destination parent;
- copies without deleting the source;
- calculates SHA-256 for both files;
- throws if byte size or SHA-256 differ;
- is idempotent when an identical destination already exists;
- refuses to overwrite a destination with different bytes.

- [ ] **Step 4: Add the Hlasujme-only CLI**

Create `scripts/relocate-legacy-storage.ts`. It:

1. parses only `--dry-run`;
2. loads `PollDocument` records with non-null `localPath` and `SealedResult`
   records with non-null `pdfPath`;
3. plans only `/storage/` records;
4. copies and verifies each planned file;
5. in non-dry-run mode updates that record's single path to
   `plan.normalizedPath`;
6. prints record type, id, old path, normalized path, mode, and hash;
7. never deletes source files or touches any other model.

Add:

```json
"storage:relocate-legacy": "tsx scripts/relocate-legacy-storage.ts"
```

- [ ] **Step 5: Verify the migration task locally**

Run:

```powershell
npx tsx --test tests/legacy-storage.test.ts
npx tsc --noEmit --pretty false
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```powershell
git add -- tests/legacy-storage.test.ts src/lib/legacyStorage.ts scripts/relocate-legacy-storage.ts package.json
git commit -m "feat: relocate legacy voting files safely"
```

---

### Task 5: Full verification and production rollout

**Files:**
- Verify all files changed in Tasks 1–4
- Production copy target: `/var/lib/hlasujme/storage`
- Production legacy source: `/var/www/hlasovanie/storage`
- Production database boundary: `lemon`, schema `hlasujme`

**Interfaces:**
- Consumes CLI: `npm run storage:relocate-legacy -- --dry-run`
- Consumes CLI: `npm run storage:relocate-legacy`

- [ ] **Step 1: Run the complete local verification**

Run:

```powershell
npm run test
npm run lint
npx tsc --noEmit --pretty false
npm run build
git diff --check
git status --short
```

Expected: all commands exit zero and only intentional committed changes exist.

- [ ] **Step 2: Re-read the design and verify requirement coverage**

Check every section of
`docs/superpowers/specs/2026-07-29-local-storage-and-email-template-fix-design.md`
against the diff. Confirm:

- confirmation renders `buildingShort`;
- no runtime Drive code or UI remains;
- local sealed PDFs can be emailed without Drive metadata;
- Drive columns remain untouched;
- relocation is dry-run-capable, confined, copy-only, hash-verified, and
  idempotent.

- [ ] **Step 3: Push the verified commits**

```powershell
git push origin main
```

Wait for the `Deploy to Production` GitHub Actions run and require success.

- [ ] **Step 4: Confirm the deployed runtime before migration**

Over SSH, verify:

```bash
cd /var/www/hlasovanie
git rev-parse HEAD
systemctl is-active hlasovanie
curl --fail --silent --show-error http://127.0.0.1:3001/admin/login >/dev/null
```

Do not run any destructive database command.

- [ ] **Step 5: Dry-run the production relocation**

Run:

```bash
cd /var/www/hlasovanie
npm run storage:relocate-legacy -- --dry-run
```

Expected: exactly one legacy `PollDocument` and one legacy `SealedResult`;
neither the database nor destination files change.

- [ ] **Step 6: Execute and verify the production relocation**

Run:

```bash
cd /var/www/hlasovanie
npm run storage:relocate-legacy
npm run storage:relocate-legacy -- --dry-run
```

Expected: the first run copies and updates exactly two Hlasujme path fields.
The second run reports no remaining `/storage/` records. Old source files
remain in place.

- [ ] **Step 7: Verify production behavior**

Verify:

- current and relocated attachments download through authorized app links;
- current and relocated sealed PDFs download and pass stored SHA-256 checks;
- the closed poll shows the send-to-owners button without Drive metadata;
- a controlled confirmation-template render contains the building short name;
- `journalctl -u hlasovanie` shows no new application errors.

- [ ] **Step 8: Remove unused production Google credentials after health checks**

Create a root-readable backup of `/var/www/hlasovanie/.env`, remove only:

```text
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
GOOGLE_DRIVE_PARENT_FOLDER_ID
```

Restart `hlasovanie`, verify `active`, and repeat the local health check. Do
not print credential values.
