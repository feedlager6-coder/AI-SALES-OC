---
name: AI Sales OS environment setup
description: Required env vars, database, and dev-specific config for running the project on Replit.
---

## Required secrets (set via setEnvVars in shared env)
- `BETTER_AUTH_SECRET` — min 32 chars; auto-generated 96-char hex on first setup
- `ENCRYPTION_KEY` — exactly 64 hex chars (32 bytes); auto-generated; used for AES-256-GCM email-account credential encryption
- `BETTER_AUTH_URL` — set to `http://localhost:3001` in shared env

## Database
- Run `cd packages/db && DATABASE_URL=$DATABASE_URL pnpm db:migrate` on fresh envs
- 19 tables created by `0000_supreme_donald_blake.sql`
- Better Auth tables (users, sessions, accounts, verifications) are part of the same migration

## Dev-only conveniences added
- `apps/web/src/middleware.ts` — `?_dev=1` query param bypasses auth in NODE_ENV=development (for screenshot tooling)
- `apps/web/src/app/dev-preview/route.ts` — GET /dev-preview?to=/path signs in test user and redirects (cookie domain issue prevents it from working across 127.0.0.1/localhost boundary)
- Test user: `test@example.com` / `testpass123`

## Bugs fixed during setup session
- `register-form.tsx`: `workspaceName` was collected in form but not sent to Better Auth → Fixed by passing it as additionalField
- `auth.ts`: `workspaceName` added to `additionalFields`; workspace creation now uses it as the workspace name directly (not suffixed with "'s Workspace")
- `next.config.ts`: Added `127.0.0.1` to `allowedDevOrigins` so HMR works in screenshot tooling

**Why:**
These were runtime env mismatches discovered on first end-to-end test, not code bugs from CI perspective.
