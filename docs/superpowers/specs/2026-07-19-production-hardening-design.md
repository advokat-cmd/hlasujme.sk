# Production Hardening Design

## Goal

Bring the voting application to a state suitable for legally significant apartment-building voting on a Hetzner-hosted Node.js server with PostgreSQL and persistent local storage. The work covers every issue recorded in the 19 July 2026 audit without changing the intended Slovak voting rules or user-facing workflow.

## Production environment

- The application is deployed on Hetzner, not Vercel or another serverless platform.
- PostgreSQL is the authoritative shared state for voting, authorization, sessions, rate limiting, audit records, and closing coordination.
- Supporting documents and sealed PDFs may use persistent local server storage. Google Drive remains a best-effort backup, never the authorization boundary or primary source of truth.
- The deployment may run more than one Node.js worker, so correctness cannot depend on process-local memory.
- `AGENTS.md` must record these facts for future AI-assisted work.

## Architecture

### Voting window and input validation

All vote submissions will pass a shared server-side validator. It will require an active poll, `startAt <= now <= endAt`, an unexpired token whose unit and optional owner still belong to the poll's building, and answers limited to existing question numbers and the Prisma `VoteAnswer` values. Final submissions must answer every question. Invalid inputs return a deterministic 4xx response and never reach Prisma as unchecked enum casts.

Poll creation will validate finite dates, `startAt < endAt`, non-empty trimmed content, supported majority types, at least one question, and the absence of another active poll for the building. These checks will execute on the server regardless of client validation.

### Atomic voting and closing

Closing will acquire a poll-scoped PostgreSQL transaction advisory lock, atomically transition the poll from `active` to a non-votable closing state, and calculate the final snapshot from the same protected database state. Vote writes will acquire the same poll lock and recheck the poll window inside their transaction. A vote that acquires the lock first is included; a close that acquires it first rejects the later vote. There will be no state in which a committed vote is absent from the sealed snapshot.

The schema will add a `closing` poll status. If PDF or local persistence fails after the status transition, the operation will restore `active` only when the original end time has not passed; otherwise it will remain safely non-votable and expose a retry path. Database finalization of the closed state and sealed metadata will be atomic.

### Result correctness and sealing

The engine will include only active eligible units belonging to the poll's building. Unit vote weights must be positive integers. Internal co-owner shares must be finite values in `(0, 1]`, owners must belong to the submitted unit, and internal shares must total exactly `1` within a small decimal tolerance.

The sealed record will store independent SHA-256 hashes for canonical result JSON and the PDF bytes. Canonical JSON serialization will be deterministic. PDF download will recompute and compare its hash before serving; result reads will verify the JSON hash. Existing records will remain readable through a migration-compatible nullable JSON hash and will be clearly treated as legacy.

### Accounts and sessions

Admin creation and updates will never upsert an unrelated account by email. Email conflicts return `409`. Owner and unit identifiers must match before credentials are changed. A normal administrator cannot modify, demote, reassign, or reset a superadmin account. Role values use an explicit allowlist and privileged role changes require a current superadmin.

No default password will exist. Temporary passwords will use `crypto.randomBytes` with sufficient entropy, and account creation that requires a password will reject a missing value. Password policy will require at least 12 characters for newly set passwords. Password reset and role/password changes will invalidate existing sessions.

Sessions will be database-backed. The cookie will hold only a cryptographically random session identifier hash plus the existing secure cookie flags. Every privileged data or API access will verify that the session is unexpired, not revoked, and refers to a current account and role. Logout, password change, role change, and account deletion revoke relevant sessions.

### Rate limiting

Login and vote limits will use a PostgreSQL table keyed by normalized action and trusted client address, with atomic window counters and periodic opportunistic cleanup. Proxy address parsing will trust only the deployment's configured proxy behavior and will select one normalized address rather than the raw `x-forwarded-for` string. Process-local maps and timers will be removed.

### Documents and browser security

Supporting-document downloads will require either a valid vote token for the document's poll or an authorized current session. Document URLs shown to voters will carry the vote token through a dedicated authorized route rather than expose bare document UUIDs.

Uploads will enforce a small MIME and extension allowlist suitable for voting material (PDF and common non-executable image/document formats), verify basic file signatures where practical, sanitize names, store only generated paths below the configured storage root, and always serve files with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`. The unauthenticated arbitrary Google Drive file proxy will be removed or changed to require a database document association and authorization.

HTML email-template previews will be sanitized before `dangerouslySetInnerHTML`; active script content, event-handler attributes, dangerous URLs, iframes, and embedded executable content will be rejected. Production CSP will remove `unsafe-eval`; inline styling may remain temporarily where required by the current component implementation, but inline script execution will not be permitted. Next.js's production CSP guidance in the installed Next.js 16 documentation is authoritative.

Sealed protocol downloads will authorize a current user only when their account belongs to the poll's building or they have an administrator role with access to it. Signed email links will include an expiry timestamp covered by the HMAC.

### Audit chain

Audit ordering will use a monotonic database identity/order rather than `createdAt` alone. Appends remain serialized by a PostgreSQL advisory transaction lock. Integrity verification will run in deterministic order and cover all security-sensitive mutations, including draft vote changes where they create authoritative vote versions.

### Database migrations and deployment

Prisma migrations will introduce session, rate-limit, closing-state, result-hash, and deterministic audit-order fields without deleting existing production data. Migration SQL will be committed and suitable for `prisma migrate deploy` on Hetzner. `prisma.config.ts` will replace the deprecated `package.json#prisma` configuration.

The storage location will be configurable with an absolute Hetzner path. Startup validation will reject production configurations with weak session secrets, insecure base URLs, missing writable storage, or an unavailable database. No environment values or credentials will be committed.

## Error handling and recovery

- Expected validation, conflict, authentication, authorization, and rate-limit failures return stable 4xx responses.
- Database, storage, PDF, email, and Drive failures are separated so callers can distinguish retryable backup failures from failures that affect the authoritative transaction.
- Email and Drive remain best-effort after authoritative data commits and record explicit retryable state.
- Closing is idempotent. Retrying cannot create a second sealed result or a different snapshot.
- Logs contain identifiers needed for diagnosis but never plaintext tokens, passwords, session identifiers, or full sensitive payloads.

## Testing strategy

Production changes follow red-green-refactor TDD. Tests will cover:

- vote rejection before start, after end, for invalid answers, unknown questions, mismatched owners, and concurrent close/vote ordering;
- eligible-unit filtering and all majority calculations, including invalid shares and weighted units;
- account email conflicts, owner/unit mismatches, superadmin protection, cryptographic password generation, session expiry and revocation;
- database-backed rate-limit behavior across independent callers;
- document authorization, MIME rejection, forced attachment responses, path confinement, and expiring protocol signatures;
- deterministic audit-chain ordering and independent JSON/PDF seal verification;
- poll date/majority validation and single-active-poll enforcement;
- migration validation, TypeScript, ESLint, production build, and a local browser smoke test.

Database integration tests will use a dedicated test schema or database and must never seed, clear, or mutate production data. Where a local test database is unavailable, pure unit suites must still run and the missing integration environment must be reported explicitly rather than treated as a pass.

## Completion criteria

- Every audit finding is covered by an automated regression test and an implemented correction.
- Production source passes TypeScript and ESLint with no errors.
- The production Next.js build succeeds without the current broad file-tracing warning.
- Prisma schema and committed migrations validate; database integration tests pass against a dedicated test database.
- `npm audit --omit=dev` has no fixable high or critical vulnerability. Moderate transitive findings without a compatible upstream fix are documented.
- Browser smoke tests confirm login rendering, authorization failures, invalid-token handling, and key security headers.
- `AGENTS.md` states that production runs on Hetzner with PostgreSQL and persistent storage.

