---
name: AI Sales OS Auth quirks
description: Better Auth + Drizzle integration gotchas that caused login/registration to fail
---

# Better Auth + Drizzle custom user fields

## The rule
When adding custom columns to the `users` table (e.g. `workspaceId`, `role`) that Better Auth needs to write on INSERT, you MUST declare them in `user.additionalFields` inside the Better Auth options. Without this, Better Auth strips unknown fields before calling the drizzle adapter — even if `databaseHooks.user.create.before` injects them.

**Why:** Better Auth validates all user fields against `additionalFields` before passing to the DB adapter. Undeclared fields are silently dropped, causing NOT NULL constraint violations.

**How to apply:** In `apps/api/src/plugins/auth.ts`, `betterAuth({ user: { additionalFields: { workspaceId: { type: 'string', required: false, fieldName: 'workspaceId' } } } })`. The `fieldName` must be the **camelCase Drizzle object key**, not the snake_case DB column name.

## The `required: false` rule
Set `required: false` for server-injected fields. `required: true` forces the client to send the field in the sign-up payload, which breaks the server-side injection pattern.

## React client error handling
`authClient.signIn.email()` and `authClient.signUp.email()` return `{ data, error }` — they NEVER throw. Forms must destructure `error` and check it explicitly. Using try/catch alone silently swallows auth errors and always proceeds to redirect.

## trustedOrigins
Must include `http://localhost:5000` (Next.js dev server) in addition to Replit proxy domains. Without it, requests from the Next.js server origin get `INVALID_ORIGIN` 403.

## baseURL in auth client
`NEXT_PUBLIC_API_URL=""` (empty string). Use `||` not `??` for fallback: `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'`. The `??` operator does not treat empty string as nullish.

## DB migrations
Tables do not exist on a fresh Replit environment. Must run `cd packages/db && pnpm run db:migrate` before the API can serve any auth requests.
