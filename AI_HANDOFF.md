# AI Sales OS — Agent Handoff Document

> **Last updated:** Sprint 1.1 complete (2026-07-13)
> **Next sprint:** Sprint 1.2 — Database migrations, auth workspace provisioning, companies list UI

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

## Sprint 1.2 — What to do next

### Critical path (do first)
1. **Database migrations** — Run `pnpm --filter=@ai-sales-os/db db:generate && db:migrate` once `DATABASE_URL` is set
2. **Replit secrets needed:**
   - `DATABASE_URL` — PostgreSQL connection string (Replit DB or external)
   - `REDIS_URL` — Redis connection string
   - `BETTER_AUTH_SECRET` — min 32-char secret for auth signing
   - `ENCRYPTION_KEY` — 64-char hex for field encryption
   - `BETTER_AUTH_URL` — full URL of the API (e.g. `https://<repl>.replit.dev`)
3. **Workspace provisioning** — After registration, a workspace must be created and `users.workspaceId` set. Currently Better Auth creates the user but no workspace. Need a post-registration hook.

### API routes to add in Sprint 1.2
- `POST /api/workspaces` — create workspace (triggered after first sign-up)
- `GET /api/companies/:id/contacts` — company contacts
- `POST /api/companies/:id/enrich` — trigger enrichment job
- `GET /api/contacts` — list contacts
- `PATCH /api/contacts/:id` — update contact

### Web pages to add in Sprint 1.2
- `/companies` — companies list with filters (table with TanStack Table)
- `/companies/:id` — company detail with enrichment status, contacts, timeline

---

## Architecture Decisions

### Plugin System
All external integrations go through typed interfaces in `packages/plugins/src/interfaces/`.
New providers implement the interface and register in `register-all.ts`.
Circuit breaker (5 failures → 30 min open) guards every provider call.
Email finding uses waterfall: confidence >= 0.3 required to stop trying.

### `sent_today` Counter (RISK-001)
Daily email send limits per email account live in **Redis INCR** (key: `sent_today:{emailAccountId}:{YYYY-MM-DD}`), **not** in the DB column. This avoids write contention under high concurrency. The `emailAccounts.sentToday` DB column is NOT used — treat it as display cache only.

### Workspace Isolation
Double isolation: PostgreSQL RLS (`app.current_workspace_id` session variable) + `workspace_id` column on every table. The workspace context Fastify plugin sets the RLS variable on every authenticated request.

### BullMQ + ioredis
Two ioredis versions may be pulled in by BullMQ's deps. The `packages/queue/src/queues.ts` casts the connection to `ConnectionOptions` to avoid the type conflict. At runtime they're the same binary — no issue.

### Better Auth + Zod
`better-auth@1.2.x` internally requires `zod@^4` (via `better-call` peer). We pin `zod@^3` in all our packages and schemas. This is a peer dep warning only; auth functionality works. Resolve in Sprint 1.2 by either: (a) upgrading to zod v4 throughout, or (b) waiting for better-auth to ship a zod-agnostic adapter.

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
| Next.js root | `apps/web/src/app/layout.tsx` |
| Auth middleware | `apps/web/src/middleware.ts` |
| ICP rules | `verticals/transport/icp.yaml` |
