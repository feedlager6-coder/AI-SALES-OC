# AI Sales OS

## Project Overview

AI-powered B2B outbound sales automation platform for the Russian SMB market. Helps SDRs find companies, enrich contact data, run automated email sequences, and track replies — all orchestrated through a plugin system and AI agents.

**Core entity:** Company (not Lead). Multi-tenant, workspace-isolated, event-driven.

## Stack

- **Runtime:** Node.js 22, pnpm 10 + Turborepo
- **API:** Fastify 5 (apps/api, port 3001)
- **Web:** Next.js 15 App Router (apps/web, port 5000 in Replit)
- **Workers:** BullMQ background jobs (apps/workers)
- **DB:** Drizzle ORM + PostgreSQL 16
- **Queue:** BullMQ + Redis 7
- **Auth:** Better Auth
- **UI:** Tailwind CSS v4 + shadcn/ui components (hand-built)
- **State:** TanStack Query

## Running the Project

```bash
# Install all dependencies
pnpm install

# Build all packages first (required before running apps)
pnpm turbo run build --filter="./packages/*"

# Start Next.js web (Replit webview, port 5000)
cd apps/web && pnpm dev --port 5000

# Start API (separate terminal, port 3001)
cd apps/api && pnpm dev
```

## Environment Status (last verified 2026-07-23)

- `DATABASE_URL` — ✅ Replit's built-in PostgreSQL (migrations applied)
- `REDIS_URL` — ✅ `redis://localhost:6379`; a local `redis-server` is started by the "API Server" workflow itself (no separate Redis service on Replit)
- `BETTER_AUTH_SECRET` / `ENCRYPTION_KEY` — ✅ generated and stored as shared env vars
- `BETTER_AUTH_URL` — ✅ `http://localhost:3001` (internal; browser never calls the API origin directly, see below)
- `SESSION_SECRET` — ✅ already configured
- Optional external API keys (`OPENAI_API_KEY`, `MAILGUN_API_KEY`, `TWOGIS_API_KEY`, etc.) are still unset — add via Replit Secrets when those integrations are built.

### Replit networking note

The browser must never call the Fastify API (port 3001) directly — it should stay same-origin. `apps/web/next.config.ts` rewrites `/api/*` to `http://localhost:3001/api/*`, and `NEXT_PUBLIC_API_URL` is set to `""` (relative) for the web workflow only. Do not reintroduce an absolute `NEXT_PUBLIC_API_URL` pointing at port 3001.

`.replit` still declares an `externalPort` mapping for 3001: Replit's workflow port-detection (`waitForPort`) did not reliably detect the Fastify listener without a corresponding `[[ports]]` entry, even though the app itself was healthy (confirmed via direct `curl`) — removing it caused the "API Server" workflow to be killed as failed after its 180s timeout. Redis (6379) has no port mapping at all (unauthenticated by default, must stay localhost-only). If tightening the API's exposure further, keep an internal-only `[[ports]]` entry (no `externalPort`) rather than deleting it outright, and re-verify the workflow still opens the port before removing the external one.

### Known gap (tracked as a follow-up task)

Registration (`POST /api/auth/sign-up/email`) fails with a `workspace_id` NOT NULL violation — `users.workspaceId` is required but Better Auth has no workspace to assign at signup. This is the "workspace provisioning" hook already called out in `AI_HANDOFF.md` as Sprint 1.2 work, not a Sprint 1.1 regression.

## User Preferences

- All code comments and identifiers in English
- User-facing UI text in Russian (target market)
- Production-ready code — no mocks, no hardcoded values, no silent fallbacks
- Soft deletes everywhere (`deleted_at`)
- `Company` not `Lead` as the core entity
- Redis INCR for `sent_today` counters (not DB column) — see RISK-001 in AI_HANDOFF.md
