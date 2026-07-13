# AI Sales OS — Agent Handoff Document

> **Last updated:** Sprint 1.3 complete (2026-07-13)
> **Next sprint:** Sprint 1.4 — Email sequences & outreach automation

---

## Replit Setup — Completed 2026-07-13

The project is installed and running on Replit. All Sprint 1.1, 1.2, and 1.3 work is complete:

- `pnpm install` done, all packages build clean
- DB migrated (migrations `0000_supreme_donald_blake.sql` + `0001_silly_joystick.sql` applied)
- Redis runs locally (started by the "API Server" workflow)
- All secrets configured as shared env vars (see `replit.md → Environment Status`)
- Both workflows healthy: "Start application" (port 5000) + "API Server" (port 3001)

**Sprint 1.1 bugs fixed (already in AI_HANDOFF.md v1):**
1. `users.emailVerified` column added via migration `0001_silly_joystick.sql`
2. Better Auth `generateId: false` → DB generates UUIDs

**Sprint 1.2 critical fix:**
3. **Workspace provisioning** — Better Auth `databaseHooks.user.create.before` now creates a workspace and injects `workspaceId` into the user row before insert. Signup works end-to-end. See `apps/api/src/plugins/auth.ts`.

---

## Project Overview

AI-powered B2B outbound sales automation platform for Russian SMB market.
Core entity: **Company** (not Lead). Workspace-isolated, multi-tenant, plugin-driven.

---

## Monorepo Structure

```
ai-sales-os/
├── apps/
│   ├── api/          — Fastify 5 REST API (port 3001)
│   ├── web/          — Next.js 15 App Router (port 5000 in Replit, 3000 elsewhere)
│   └── workers/      — BullMQ background workers
├── packages/
│   ├── config/       — Zod env validation, getEnv()
│   ├── db/           — Drizzle ORM, PostgreSQL schema, migrations
│   ├── errors/       — AppError hierarchy + domain errors
│   ├── logger/       — Pino factory, dev pretty / prod JSON
│   ├── plugins/      — Plugin interfaces + registry + circuit breaker
│   ├── queue/        — BullMQ job types, queue factories, Redis connection
│   └── types/        — Canonical TypeScript domain types (17 entities)
├── verticals/
│   └── transport/    — ICP scoring rules, lead source config
├── infra/
│   ├── docker-compose.yml   — Local dev (postgres:16 + redis:7)
│   └── init-db.sql          — PostgreSQL extensions init
└── .github/workflows/ci.yml — Typecheck + lint + test pipeline
```

---

## Sprint 1.1 Status — ✅ COMPLETE

### Completed
- [x] pnpm 10 workspace + Turborepo task graph
- [x] `packages/logger` — Pino with dev/prod modes
- [x] `packages/errors` — AppError + HTTP subclasses + 8 domain errors
- [x] `packages/config` — Zod env schema, memoized `getEnv()`
- [x] `packages/types` — Full TypeScript types for all 17 domain entities
- [x] `packages/db` — Drizzle ORM, 8 schema files (all tables), client singleton
- [x] `packages/plugins` — 7 plugin interfaces, PluginRegistry, circuit breaker, waterfall
- [x] `packages/queue` — BullMQ connection, job type defs, queue factories
- [x] `apps/api` — Fastify 5: health endpoints, Better Auth proxy, workspace middleware, companies CRUD
- [x] `apps/web` — Next.js 15: login/register forms, dashboard layout, sidebar, dark theme, TanStack Query
- [x] `apps/workers` — BullMQ workers: enrichment, email, AI (stubs ready for Sprint 1.3+)
- [x] `infra/docker-compose.yml` — postgres:16 + redis:7 for local dev
- [x] `.github/workflows/ci.yml` — typecheck + lint + test pipeline
- [x] `verticals/transport/icp.yaml` + `sources.yaml`
- [x] Replit workflows configured (`Start application` on port 5000)
- [x] All TypeScript packages compile clean

---

## Sprint 1.2 Status — ✅ COMPLETE

### Completed
- [x] **Workspace provisioning** — `databaseHooks.user.create.before` in Better Auth (`apps/api/src/plugins/auth.ts`). On sign-up: workspace created → `workspaceId` injected before user INSERT. Signup now works end-to-end.
- [x] **ICP Scoring service** — Rule-based scoring in `apps/api/src/services/icp-scoring.ts`. Mirrors `verticals/transport/icp.yaml` rules. Score 0–100. Called on company create/update/import.
- [x] **PATCH /api/companies/:id** — Update company with ICP score recomputation
- [x] **Full-text search** — `GET /api/companies?search=` uses PostgreSQL `to_tsvector('russian', ...)` + GIN index + ILIKE fallback
- [x] **POST /api/companies/:id/enrich** — Triggers enrichment (sets `in_progress`). Queue dispatch stubbed for Sprint 1.3.
- [x] **POST /api/companies/import** — Batch JSON import (up to 500 rows). Deduplicates by INN. Returns `{imported, skipped, errors}`.
- [x] **GET /api/companies/:id/contacts** — Contacts for a company
- [x] **GET/POST /api/companies/:id/activities** — Activity timeline + manual log (note/call/meeting)
- [x] **Contact CRUD** — Full routes in `apps/api/src/routes/contacts.ts` (GET list, GET one, POST, PATCH, DELETE)
- [x] **Deal CRUD** — Full routes in `apps/api/src/routes/deals.ts` (GET list, GET one, POST, PATCH, DELETE). Stage changes log activities automatically.
- [x] **UI: /companies** — Companies list page with TanStack Table, filters (status, search), pagination, ICP score badges, status badges. Add company modal. CSV import modal (client-side CSV parsing → batch JSON import).
- [x] **UI: /companies/:id** — Company detail page: ICP bar, company info sidebar, contacts tab, activity timeline tab. Add contact/activity modals. Enrich button.
- [x] **API client extended** — `apps/web/src/lib/api-client.ts` now covers companies, contacts, deals APIs.
- [x] All TypeScript strict — zero errors across api, web, workers
- [x] Lint — zero ESLint warnings across all apps
- [x] Packages rebuild — all 7 packages build clean

---

## Sprint 1.3 Status — ✅ COMPLETE

### Completed
- [x] **2ГИС lead source plugin** — `TwoGisPlugin` in `packages/plugins/src/implementations/lead-sources/twogis.provider.ts`. Calls `catalog.api.2gis.com/3.0/items`. City-name→ID map. Parses rubrics, phones, websites. Requires `TWOGIS_API_KEY`.
- [x] **HH.ru lead source plugin** — `HHRuPlugin` in `packages/plugins/src/implementations/lead-sources/hhru.provider.ts`. Calls `api.hh.ru/employers`. Public API, no key needed. City-name→area-ID map (Russian cities).
- [x] **Dadata enrichment plugin** — `DadataPlugin` in `packages/plugins/src/implementations/enrichment/dadata.provider.ts`. Calls Dadata Suggestions API (ЕГРЮЛ). INN lookup first, name search fallback. Requires `DADATA_API_KEY`.
- [x] **Hunter.io email finder** — `HunterPlugin` in `packages/plugins/src/implementations/enrichment/hunter.provider.ts`. Priority 1 in email waterfall. Email Finder (person) + Domain Search. Requires `HUNTER_API_KEY`.
- [x] **Snov.io email finder** — `SnovPlugin` in `packages/plugins/src/implementations/enrichment/snov.provider.ts`. Priority 2 in email waterfall. Requires `SNOV_API_KEY`.
- [x] **Plugin registry updated** — `packages/plugins/src/registry/register-all.ts` registers all new plugins with priorities: 2GIS=1, HH=2, CSV=99; Hunter=1, Snov=2, Pattern=99; Dadata=1, EGRUL=2.
- [x] **Scraping queue** — `getScrapingQueue()` in `packages/queue/src/queues.ts`. Handles `Search2GISPayload | SearchHHRuPayload`.
- [x] **Scraping worker** — `apps/workers/src/scraping/scraping.worker.ts`. Processes `SEARCH_2GIS` and `SEARCH_HHRU` jobs. Upserts companies to DB (dedup by INN). Computes ICP score. Concurrency=2.
- [x] **Lead sources API** — `apps/api/src/routes/lead-sources.ts`. `POST /api/lead-sources/search` dispatches scraping job; `GET /api/lead-sources/jobs/:jobId` polls BullMQ state; `GET /api/lead-sources/providers` lists providers.
- [x] **Enrichment queue wiring** — `POST /api/companies/:id/enrich` now dispatches real `ENRICH_COMPANY` BullMQ job (no longer a stub).
- [x] **Companies API extended** — `GET /api/companies` supports `icpMin`, `icpMax`, `source` filters.
- [x] **UI: "Найти компании" modal** — `apps/web/src/components/companies/lead-search-modal.tsx`. Source selector (2ГИС/HH.ru), city, industry, limit slider. Polls job status with progress bar. Shows result stats.
- [x] **UI: ICP range filter** — `/companies` page has collapsible ICP Score panel with dual min/max sliders. Values applied on "Применить".
- [x] **UI: Source filter** — Source dropdown on companies list page.
- [x] **API client extended** — `apps/web/src/lib/api-client.ts` — added `icpMin`, `icpMax`, `source` to `CompanyFilters`; `api.leadSources` namespace (`search`, `jobStatus`, `providers`).
- [x] All TypeScript strict — zero errors across api, web, workers, all packages
- [x] Lint — zero ESLint warnings across all apps
- [x] All 7 packages build clean

### Env vars to add for Sprint 1.3 features
- `TWOGIS_API_KEY` — required for 2ГИС search
- `DADATA_API_KEY` — required for ЕГРЮЛ enrichment via Dadata
- `HUNTER_API_KEY` — required for Hunter.io email finder
- `SNOV_API_KEY` — required for Snov.io email finder

### Notes
- EGRUL nalog.ru provider (`packages/plugins/src/implementations/enrichment/egrul.ts`) remains a stub returning `null`. Dadata is the primary ЕГРЮЛ data source.
- `RawCompanyData` interface now has `ogrn?: string` field (added for 2ГИС org data).

---

## Sprint 1.4 — What to do next

### Critical path
1. **Email sequence builder** — Compose multi-step email sequences with delay rules, A/B variants, stop conditions
2. **Outreach sending** — Integrate email sending (SMTP / SendGrid / Postmark). Queue-based delivery. Respect daily send limits.
3. **Sequence status tracking** — Track open, click, reply, bounce events per contact per sequence
4. **Sequence UI** — `/sequences` page with builder, active campaign dashboard, per-lead status
- `HUNTER_API_KEY`
- `SNOV_API_KEY`

---

## Architecture Decisions

### Plugin System
All external integrations go through typed interfaces in `packages/plugins/src/interfaces/`.
New providers implement the interface and register in `register-all.ts`.
Circuit breaker (5 failures → 30 min open) guards every provider call.
Email finding uses waterfall: confidence >= 0.3 required to stop trying.

### ICP Scoring (Sprint 1.2, rule-based)
`apps/api/src/services/icp-scoring.ts` mirrors `verticals/transport/icp.yaml`.
Score thresholds: `qualified >= 50`, `high_quality >= 75`, `reject < 30`.
Called automatically on company create, update, and import.
Sprint 2.2 will add LLM hybrid scoring for edge cases.

### Workspace Provisioning
Implemented via Better Auth `databaseHooks.user.create.before`. Creates workspace, generates a slug from email domain, sets 14-day trial. Injects `workspaceId` and `role: 'owner'` into user data before DB insert. No schema migration required.

### `sent_today` Counter (RISK-001)
Daily email send limits per email account live in **Redis INCR** (key: `sent_today:{emailAccountId}:{YYYY-MM-DD}`), **not** in the DB column. This avoids write contention under high concurrency. The `emailAccounts.sentToday` DB column is NOT used — treat it as display cache only.

### Workspace Isolation
Double isolation: PostgreSQL RLS (`app.current_workspace_id` session variable) + `workspace_id` column on every table. The workspace context Fastify plugin sets the RLS variable on every authenticated request.

### BullMQ + ioredis
Two ioredis versions may be pulled in by BullMQ's deps. The `packages/queue/src/queues.ts` casts the connection to `ConnectionOptions` to avoid the type conflict. At runtime they're the same binary — no issue.

### Better Auth + Zod
`better-auth@1.2.x` internally requires `zod@^4` (via `better-call` peer). We pin `zod@^3` in all our packages and schemas. This is a peer dep warning only; auth functionality works. Resolve in a future sprint by either: (a) upgrading to zod v4 throughout, or (b) waiting for better-auth to ship a zod-agnostic adapter.

### `exactOptionalPropertyTypes: true`
The tsconfig enforces `exactOptionalPropertyTypes`. This means `{ foo?: string }` rejects explicit `undefined`. When building payloads to pass to API functions, use the omit-if-falsy pattern (`if (x) payload.x = x`) rather than spreading optional fields directly.

---

## Replit Dev Environment Notes

- **Web preview** runs on port 5000 (`apps/web`, Next.js). Workflow: `Start application`
- **API** runs on port 3001 (`apps/api`, Fastify). Workflow: `API Server`
- No Docker on Replit — use Replit PostgreSQL integration for the DB, and add Redis as a system dep or use Upstash Redis with `REDIS_URL`
- `SESSION_SECRET` is already in Replit Secrets
- Replit proxy requires `allowedDevOrigins: ['*']` in `next.config.ts` ✅

---

## Key Files Reference

| What | Where |
|------|-------|
| Env schema | `packages/config/src/index.ts` |
| All DB tables | `packages/db/src/schema/` |
| Domain types | `packages/types/src/index.ts` |
| Plugin interfaces | `packages/plugins/src/interfaces/` |
| Plugin registry | `packages/plugins/src/registry/register-all.ts` |
| Job types | `packages/queue/src/jobs.ts` |
| Fastify app setup | `apps/api/src/app.ts` |
| Auth (Better Auth) | `apps/api/src/plugins/auth.ts` |
| Workspace context | `apps/api/src/plugins/workspace-context.ts` |
| Companies API | `apps/api/src/routes/companies.ts` |
| Contacts API | `apps/api/src/routes/contacts.ts` |
| Deals API | `apps/api/src/routes/deals.ts` |
| ICP Scoring service | `apps/api/src/services/icp-scoring.ts` |
| API client (web) | `apps/web/src/lib/api-client.ts` |
| Next.js root | `apps/web/src/app/layout.tsx` |
| Auth middleware | `apps/web/src/middleware.ts` |
| Companies list page | `apps/web/src/app/(dashboard)/companies/page.tsx` |
| Company detail page | `apps/web/src/app/(dashboard)/companies/[id]/page.tsx` |
| ICP rules | `verticals/transport/icp.yaml` |
