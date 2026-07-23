---
name: AI Sales OS Architecture
description: Monorepo structure, key packages, plugin model, Replit gotchas, and search layer placement.
---

## Project structure

```
apps/web        — Next.js 15 frontend (port 5000)
apps/api        — Fastify backend (port 3001)
packages/
  db            — Drizzle ORM + PostgreSQL + migrations
  logger        — Pino logger (createLogger)
  config        — Runtime env config
  errors        — Shared error classes
  types         — Cross-package TypeScript types
  queue         — BullMQ task queue
  plugins       — Fastify plugins
```

## Sprint 1.1 completion status (as of 2026-07-23)

All search business logic now lives on the API server. Frontend is a thin renderer.

### Search layer on API (`apps/api/src/search/`)

```
types.ts                       — SearchCompany, SearchResult, SearchParams
search-provider.ts             — SearchProvider interface + SearchHunt type
provider-registry.ts           — ProviderRegistry (register/getAll)
ranking-engine.ts              — RankingEngine interface + DefaultRankingEngine
search-orchestrator.ts         — SearchOrchestratorImpl (merge + dedup + rank)
setup.ts                       — Singleton wiring (registry + orchestrator)
providers/mock/mock-data.ts    — 12 hardcoded Russian B2B companies
providers/mock/mock.provider.ts— MockSearchProvider (400ms delay, filters by intent)
providers/two-gis/             — 8 files: types, config, rate-limiter, retry-policy,
                                  mock-fixtures, client, mapper, provider
```

- `TWOGIS_API_KEY` (no NEXT_PUBLIC_ prefix) controls the 2GIS provider
- `useMock: true` in config.ts — flip to false when real key is set

### Search route (`apps/api/src/routes/hunts.ts`)

```
POST /api/v1/hunts/:id/search
  → fetch Hunt from DB (verify workspaceId)
  → updateStatus(searching)
  → searchOrchestrator.search(searchHunt)
  → updateStatus(completed | failed)
  → return { data: SearchResult }
```

Backend owns all status transitions: searching → completed | failed.

### Frontend after migration (`apps/web/src/lib/search/`)

Kept: `types.ts` (MockCompany, SearchResult for rendering), `hunt-service.ts` (thin adapter)

Deleted: search-orchestrator, provider-registry, search-provider, ranking-engine,
         mock-search-provider, mock-search-service, mock-data, providers/ directory

`hunt-service.ts` is now a one-liner proxy:
  `search(hunt) { return searchHunt(hunt.id) }`

`hunt-api.ts` exports `searchHunt(huntId)` → POST /api/v1/hunts/:id/search.

Discover page (`apps/web/src/app/(dashboard)/discover/page.tsx`):
  - Removed all `updateHuntStatus` calls (backend owns status now)
  - `huntService.search(hunt)` call signature is unchanged
  - UI is pixel-identical

## Core architecture

- **Plugin Architecture**: search providers registered in setup.ts; zero changes to routes/orchestrator to add new ones
- **No frontend leakage**: API keys, providers, and ranking are 100% server-side
- **Dedup keys**: INN → domain → id (first-provider-registered wins)
- **Ranking**: rule-based DefaultRankingEngine (max 100 pts, 8 criteria), score stripped before API response

## Replit gotchas

- **Package dist/ must exist** before API starts. Run `pnpm turbo run build --filter='./packages/*'` on fresh env. The `scripts/post-merge.sh` automates this.
- **Port proxy**: frontend on 5000, API on 3001. Never use `localhost` in frontend code — use relative URLs.
- **Entity is Company, not Lead** — the DB entity is `Company`; frontend calls them "компании".

## Better Auth wiring

- Auth lives in `apps/api/src/plugins/auth.ts`
- Frontend uses `@/lib/auth-client` (Better Auth React client)
- Trust origin: `BETTER_AUTH_URL=http://localhost:3001` (shared env)
