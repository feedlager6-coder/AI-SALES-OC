---
name: AI Sales OS Architecture
description: Monorepo layout, route prefixes, auth flow, Replit port-proxy notes, Plugin Registry design
---

# AI Sales OS Architecture

## Monorepo layout
- `apps/api` — Fastify 5, port 3001, handles all `/api/*` except auth
- `apps/web` — Next.js 15, port 5000 in Replit (dev), proxies `/api/*` to Fastify
- `apps/workers` — BullMQ workers (5 total: email, ai, enrichment, scraping, contact-discovery)
- `packages/db` — Drizzle ORM schema + migrations
- `packages/plugins` — Provider Registry (lead sources, enrichment, email sending)
- `packages/queue` — BullMQ queue definitions + Redis connection
- `packages/config` — Zod env validation
- `packages/logger` — Pino logger

## Route prefixes
- `/api/auth/*` — Better Auth, handled inside Next.js (NOT proxied to Fastify)
- `/api/v1/hunts`, `/api/v1/drafts`, `/api/v1/intent` — Fastify (newer routes)
- `/api/companies`, `/api/campaigns`, `/api/sequences`, `/api/contacts`, `/api/email-accounts` — Fastify (no v1 prefix)
- `/health/live`, `/health/ready` — Fastify only (not through proxy)

**Why:** Auth routes are more-specific in Next.js App Router and take priority over the `[...path]` catch-all proxy. API routes that lack `/v1/` in the path use the original prefix — do not assume all routes are under `/api/v1/`.

## Auth flow
- Browser → Next.js `/api/auth/*` → Better Auth (runs in Next.js process, same DB)
- Browser → Next.js `/api/*` → catch-all proxy → Fastify
- Fastify auth: reads `better-auth.session_token` cookie via `auth.api.getSession({ headers })`
- `workspaceContextPlugin` extracts `workspaceId` and sets PostgreSQL RLS session var

## Plugin Registry
- Singleton `PluginRegistry` in `packages/plugins/src/registry/`
- Priority-ordered waterfall for single-winner tasks (email finding)
- Category broadcast (`getByCategory`) for parallel execution
- Circuit breaker per plugin
- Standardized `RawCompanyData` schema

**Why:** Architecture cleanly supports new `ILeadSourcePlugin` implementors (2GIS, HH.ru, industry directories). New signal-based sources (news, SERP) need a future `ISignalPlugin` interface.

## Core entity
`Company` (not `Lead`). Multi-tenant, workspace-isolated.

## Replit port-proxy
- Never call Fastify (3001) directly from the browser
- Use relative `/api/*` paths in frontend code
- `INTERNAL_API_URL=http://localhost:3001` in `apps/web/.env.local`
- `NEXT_PUBLIC_API_URL=""` (empty) — proxy uses relative rewrites

## DB data note
`companies.emails[]` is often empty; real emails from Discover flow go into `companies.contacts` JSONB array as `[{ email, name, role, ... }]`. Workers must check both.
