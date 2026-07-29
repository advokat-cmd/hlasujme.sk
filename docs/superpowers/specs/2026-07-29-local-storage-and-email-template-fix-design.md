# Local Storage and Confirmation Email Fix Design

## Goal

Remove Google Drive from the Hlasujme application, keep voting documents and
sealed protocol PDFs on persistent server storage, and correctly render the
`{buildingShort}` variable in vote-confirmation emails.

## Confirmed causes

The confirmation email renderer does not accept or replace
`{buildingShort}`, even though a stored production template uses that
variable. The vote route therefore sends the placeholder unchanged.

Production Google Drive uploads fail because the configured `Lemon` target is
a folder in a Workspace user's My Drive, not a Workspace Shared Drive. Google
service accounts have no personal storage quota and cannot own files uploaded
to that folder.

Google Drive is not required to preserve the current authoritative data:

- new poll documents are already stored below the persistent server storage
  root;
- sealed protocol PDFs are already stored below the same root;
- the database stores file metadata, relative paths, and sealed-result hashes;
- one legacy document and one legacy protocol still exist below the old
  application-local `storage` directory and need a safe, one-time relocation.

## Architecture

Persistent server storage is the sole file store. Poll documents live below
`uploads/<pollId>/`, and sealed protocols live below `sealed/`, both resolved
through `src/lib/storage.ts`. PostgreSQL continues to store metadata, relative
paths, hashes, and sealed result JSON, but not file bytes.

The application no longer imports Google APIs, creates Drive folders, uploads
files to Drive, lists Drive files, downloads Drive fallbacks, exposes retry
actions, or gates protocol-email delivery on a Drive identifier.

Existing Drive-related database columns remain in place but unused. This
avoids a destructive production migration and preserves historical metadata.
They can be removed separately only after a future retention decision.

## Component changes

### Confirmation email

The confirmation-email rendering boundary accepts `buildingShort` alongside
the existing owner, unit, poll, date, and answer values. The vote-token lookup
loads the poll's building, and the vote route passes `poll.building.short` to
the renderer.

The confirmation template editor lists `{buildingShort}` as a supported
variable. A pure renderer is used for regression testing without database or
email-provider access.

### Poll documents

The upload route writes and registers the local file only. It does not create
a Drive folder or attempt a Drive upload.

Document listing returns database-backed local documents only. Voter and
administrator downloads resolve the confined local path and do not fall back
to Drive. Legacy live Drive listings are removed from voter pages and admin
views.

### Sealed protocols

Closing a poll generates the PDF, writes it to persistent local storage,
records the sealed result, and returns success without Drive fields or Drive
warnings.

Protocol downloads use only the stored local path and retain the existing
authorization and SHA-256 integrity verification. Sending protocol links to
owners depends on a sealed local protocol, not `driveFileId`.

The Drive retry endpoint and all Drive buttons, links, status labels, and
messages are removed.

### Dependency and configuration cleanup

The `googleapis` runtime dependency is removed. Runtime code no longer reads
`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, or
`GOOGLE_DRIVE_PARENT_FOLDER_ID`. Production values may be removed from the
server environment after the Drive-free deployment is verified.

## Legacy file relocation

A one-time production script handles only Hlasujme-owned file records whose
stored paths start with the legacy `/storage/` prefix.

For each record, the script:

1. resolves and validates the existing source below the application-local
   legacy storage directory;
2. derives a confined destination below the configured persistent storage
   root;
3. copies the file without deleting the source;
4. verifies byte size and SHA-256 equality;
5. updates only the corresponding `hlasujme` document or sealed-result path to
   the normalized relative path.

The script refuses paths outside the two expected storage roots, refuses a
missing source, and never reads or modifies Lemon-owned schemas. It supports a
dry run and is idempotent. Legacy source files remain recoverable until a
separate cleanup decision.

## Error handling

A local write failure remains a blocking error because persistent storage is
authoritative. The poll is not reported as successfully sealed unless the PDF
has been written and the database transaction has recorded its path and
hashes.

A missing document or protocol returns a specific not-found response. A
sealed PDF whose bytes do not match its stored hash returns an integrity
error. No error message suggests that Google Drive is required.

## Testing

Regression tests cover:

- `{buildingShort}` replacement in confirmation subjects and bodies;
- no unresolved supported placeholders in a rendered confirmation;
- local document upload metadata and local-first download behavior;
- poll closing without any Drive configuration or Drive response fields;
- protocol email delivery when a sealed local PDF exists and no
  `driveFileId` exists;
- legacy relocation dry-run behavior, path confinement, copy-and-hash
  verification, normalized database updates, and idempotency.

The final verification runs the targeted regression tests, the complete test
suite, lint, TypeScript checking, and the Next.js production build.

## Rollout

1. Deploy the Drive-free application.
2. Run the relocation script in dry-run mode against production and inspect
   the two expected legacy records.
3. Run the relocation, then verify both copied hashes and database paths.
4. Verify the current and legacy document and protocol download endpoints.
5. Verify that protocol email sending is available without a Drive backup.
6. Remove the obsolete Google credentials from the production environment
   only after the application and downloads are confirmed healthy.

