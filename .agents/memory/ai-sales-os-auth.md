---
name: AI Sales OS Auth quirks
description: Better Auth + Fastify integration gotchas, cookie handling, trustedOrigins, and form error handling patterns
---

# AI Sales OS Auth Quirks

## trustedOrigins must include 127.0.0.1 for dev tooling
Better Auth returns 403 "Invalid origin" for any origin not in `trustedOrigins`. Dev tools (screenshot browsers, curl) use `http://127.0.0.1:5000` not `http://localhost:5000`. Both must be listed.

**Why:** The two resolve to the same server but are treated as different origins for CORS purposes.

**How to apply:** In `apps/api/src/plugins/auth.ts`, trustedOrigins includes both `http://localhost:5000` and `http://127.0.0.1:5000` (and 3000/3001 variants).

## Fastify rejects empty JSON body — sign-out breaks without a custom parser
Better Auth's sign-out POST sends no body but sets `Content-Type: application/json`. Fastify's default JSON parser throws 500 "Body cannot be empty when content-type is set to 'application/json'".

**Why:** Fastify's body parser is strict; Better Auth assumes a lenient HTTP server.

**How to apply:** In `apps/api/src/routes/auth.ts`, register a scoped `addContentTypeParser('application/json', ...)` that returns `null` for empty bodies. The route handler then checks `request.body != null` before `JSON.stringify`.

## Login form MUST have try/catch/finally around signIn.email
`@better-fetch/fetch` does NOT catch network errors — if `fetch()` throws (connection refused, proxy timeout), the exception propagates up. Without a try-catch, `setIsLoading(false)` is never called and the button stays in "Войти..." state forever.

**Why:** This is the root cause of the "20-30 second loading spinner then nothing happens" user bug.

**How to apply:** In `apps/web/src/components/auth/login-form.tsx`, wrap `signIn.email` in `try/catch` with `finally { setIsLoading(false) }`. Mirror this pattern in register form.

## Better Auth client returns {data, error} — does NOT throw
`authClient.signIn.email()` returns `{data, error}` on API-level errors (wrong password, invalid origin 403, etc.). It only throws for network-level failures (connection refused, DNS failure, timeout).

## additionalFields required for custom user schema
Better Auth silently drops fields injected by `databaseHooks.user.create.before` unless they are declared in `user.additionalFields`. Without this, workspace provisioning fields are missing from DB inserts.

## DB migration on fresh Replit env
Run `cd packages/db && pnpm db:migrate` after import. All packages must be built first: `pnpm --filter '@ai-sales-os/*' build`.

## REPLIT_DEV_DOMAIN in trustedOrigins
`process.env.REPLIT_DEV_DOMAIN` is auto-injected by Replit into all processes. Include it dynamically in trustedOrigins so the Replit preview proxy domain is always trusted regardless of session.
