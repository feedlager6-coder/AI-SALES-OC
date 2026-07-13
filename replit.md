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

## Required Secrets (not yet configured)

Add these in Replit Secrets before the API can work:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string  
- `BETTER_AUTH_SECRET` — min 32 characters
- `ENCRYPTION_KEY` — 64-char hex string
- `BETTER_AUTH_URL` — full URL of the API server
- `SESSION_SECRET` — ✅ already configured

## User Preferences

- All code comments and identifiers in English
- User-facing UI text in Russian (target market)
- Production-ready code — no mocks, no hardcoded values, no silent fallbacks
- Soft deletes everywhere (`deleted_at`)
- `Company` not `Lead` as the core entity
- Redis INCR for `sent_today` counters (not DB column) — see RISK-001 in AI_HANDOFF.md
