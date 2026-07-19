<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Production environment and database boundary

- Production runs on a persistent Hetzner server, not Vercel/serverless.
- Hlasujme shares PostgreSQL database `lemon` but owns only schema `hlasujme`.
- Commands and migrations in this repository must not read, alter, reset, truncate, seed, or delete Lemon-owned schemas or tables.
- Before any destructive database or migration-test command, verify an explicitly disposable database/schema; never use the production `hlasujme` schema.
- Supporting files and sealed PDFs use persistent server storage; Google Drive is backup-only.
