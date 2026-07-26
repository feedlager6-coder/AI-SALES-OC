---
name: AI Sales OS environment setup
description: Required env vars, database, and dev-specific config for running the project on Replit.
---

## Required secrets (set via setEnvVars in shared env)
- `BETTER_AUTH_SECRET` — min 32 chars; auto-generated 96-char hex on first setup
- `ENCRYPTION_KEY` — exactly 64 hex chars (32 bytes); auto-generated; used for AES-256-GCM email-account credential encryption
- `BETTER_AUTH_URL` — set to `http://localhost:3001` in shared env

## Database — startup auto-migration (current approach)

The API server runs `drizzle-orm/postgres-js/migrator`'s `migrate()` on every startup.
Migrations are idempotent (tracked in `drizzle.__drizzle_migrations`).
No manual `db:migrate` step needed on fresh environments.

Migration path logic in `apps/api/src/server.ts`:
- Compiled/deployed: looks for `dist/migrations/meta/_journal.json` next to `server.js`
- Dev mode (`tsx watch src/server.ts`): falls back to `packages/db/src/migrations/`

SQL files are copied to `apps/api/dist/migrations/` by the build script:
  `"build": "tsc --build && cp -r ../../packages/db/src/migrations dist/migrations"`

**Why startup migration instead of build-time `db:migrate`:**
Railway's build runner may not have DATABASE_URL available, or the `pnpm deploy` materialisation
step may run against a different DB context than the runtime. Startup migration guarantees the
correct database is always migrated before the first request.

## Dev-only conveniences added
- `apps/web/src/middleware.ts` — `?_dev=1` query param bypasses auth in NODE_ENV=development (for screenshot tooling)
- `apps/web/src/app/dev-preview/route.ts` — GET /dev-preview?to=/path signs in test user and redirects (cookie domain issue prevents it from working across 127.0.0.1/localhost boundary)
- Test user: `test@example.com` / `testpass123`

## Railway production env vars (API service)
Required: `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (API public URL),
`ENCRYPTION_KEY`, `WEB_URL` (web public URL for CORS/trustedOrigins), `NODE_ENV=production`

`WEB_URL` is optional in code but should always be set — without it CORS and Better Auth
trustedOrigins won't cover the web frontend in production.

## Bugs fixed during setup session
- `register-form.tsx`: `workspaceName` was collected in form but not sent to Better Auth → Fixed by passing it as additionalField
- `auth.ts`: `workspaceName` added to `additionalFields`; workspace creation now uses it as the workspace name directly
- `next.config.ts`: Added `127.0.0.1` to `allowedDevOrigins` so HMR works in screenshot tooling

## Registration 500 root cause (fixed)
`relation "users" does not exist` — migrations were never applied before the first request.
Better Auth queries users table before the hook even fires. Fix: startup-time `migrate()`.

Secondary issues also fixed:
- `trustedOrigins` only had BETTER_AUTH_URL (API URL), not WEB_URL (frontend URL)
- CORS `origin` also pointed to API URL instead of web URL
- `role.defaultValue: 'member'` is not a valid `user_role` enum value → changed to `'sdr'`
