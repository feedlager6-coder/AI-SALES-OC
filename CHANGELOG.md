# Changelog

All notable changes to AI Sales OS are documented here.
Format: [Sprint] — [Date] — [Summary]

---

## Sprint 1.3 — Lead Generation (2026-07-13)

### New Features
- **2ГИС lead source plugin** — `TwoGisPlugin` (`packages/plugins/src/implementations/lead-sources/twogis.provider.ts`) searches companies by city + industry via `catalog.api.2gis.com/3.0/items`. Parses rubrics, phones, websites, org INN/OGRN.
- **HH.ru lead source plugin** — `HHRuPlugin` (`packages/plugins/src/implementations/lead-sources/hhru.provider.ts`) searches Russian employers from hh.ru (public API, no key). City-name→area-ID map for major cities.
- **Dadata enrichment plugin** — `DadataPlugin` (`packages/plugins/src/implementations/enrichment/dadata.provider.ts`) fetches ЕГРЮЛ data via Dadata Suggestions API. INN lookup preferred, name-search fallback.
- **Hunter.io email finder** — `HunterPlugin` (`packages/plugins/src/implementations/enrichment/hunter.provider.ts`). Priority 1 email waterfall. Supports Email Finder (person) + Domain Search.
- **Snov.io email finder** — `SnovPlugin` (`packages/plugins/src/implementations/enrichment/snov.provider.ts`). Priority 2 email waterfall.
- **Scraping queue + worker** — `getScrapingQueue()` in `packages/queue`. Scraping worker (`apps/workers/src/scraping/scraping.worker.ts`) processes `SEARCH_2GIS`/`SEARCH_HHRU` jobs, upserts companies with dedup by INN, computes ICP score.
- **Lead sources API** — `POST /api/lead-sources/search`, `GET /api/lead-sources/jobs/:jobId`, `GET /api/lead-sources/providers`.
- **Enrichment queue wiring** — `POST /api/companies/:id/enrich` now dispatches real `ENRICH_COMPANY` BullMQ job.
- **Companies API filters** — `GET /api/companies` now supports `icpMin`, `icpMax`, `source` query params.
- **UI: "Найти компании" launch modal** — Source selector (2ГИС/HH.ru), city (with quick-pick buttons), industry, limit slider (10–200). Polls job status with progress bar. Shows result stats (найдено/добавлено/дубли).
- **UI: ICP Score range filter** — Collapsible panel on `/companies` with dual min/max range sliders. Legend shows Reject/Нейтральный/Qualified/High thresholds.
- **UI: Source filter** — Dropdown on `/companies` to filter by 2ГИС / HH.ru / CSV / Вручную.

### Internal
- `RawCompanyData` interface extended with `ogrn?: string`
- All TypeScript strict checks pass — zero errors across all apps and packages
- ESLint zero warnings across all apps
- All 7 packages build clean via `pnpm turbo run build`

---

## Sprint 1.2 — CRM Core (2026-07-13)

### New Features
- **Workspace auto-provisioning on signup** — Better Auth `databaseHooks.user.create.before` creates a workspace (slug from email domain, 14-day trial) and injects `workspaceId` / `role: 'owner'` before user INSERT. Signup now works end-to-end.
- **ICP Scoring service** — Rule-based scoring (`apps/api/src/services/icp-scoring.ts`) based on transport vertical rules (`verticals/transport/icp.yaml`). Score 0–100 computed automatically on company create, update, and batch import.
- **Companies PATCH endpoint** — `PATCH /api/companies/:id` with ICP score recomputation on update.
- **Full-text search** — `GET /api/companies?search=` uses PostgreSQL `to_tsvector('russian', ...)` + GIN index approach with ILIKE fallback.
- **Enrichment trigger** — `POST /api/companies/:id/enrich` sets company to `enriching` status. Queue dispatch stubbed for Sprint 1.3.
- **Batch CSV import** — `POST /api/companies/import` (JSON body `{companies:[...]}`). Deduplicates by INN. Returns `{imported, skipped, errors}`. Client-side CSV parser included in the UI.
- **Activity timeline** — `GET/POST /api/companies/:id/activities`. Supports `note`, `call`, `meeting` types.
- **Contacts CRUD** — Full `GET list`, `GET /:id`, `POST`, `PATCH`, `DELETE` (soft) at `/api/contacts`.
- **Deals CRUD** — Full CRUD at `/api/deals`. Stage changes automatically log an activity in the timeline.
- **Companies list UI** — TanStack Table, filters (status badge, search), pagination, ICP score badges, status badges, create/import actions.
- **Company detail UI** — ICP bar (0–100), company info sidebar, contacts tab, activity timeline tab. Enrich button, edit/delete actions. Add contact and add activity modals.
- **API client** — `apps/web/src/lib/api-client.ts` extended with typed `companies`, `contacts`, `deals`, and `workspace` namespaces.

### Bug Fixes
- Removed unused imports and fixed TS2578 unused `@ts-expect-error` directive in contacts route.
- Fixed `??` and `||` operator precedence error (`TS5076`) in contacts route.

### Internal
- All TypeScript strict checks pass across `apps/api`, `apps/web`, `apps/workers`
- ESLint zero warnings across all apps
- All packages build clean via `pnpm turbo run build`

---

## Sprint 1.1 — Foundation (2026-07-12)

### New Features
- Monorepo scaffold: pnpm 10 workspaces + Turborepo
- `packages/logger`, `packages/errors`, `packages/config`, `packages/types`
- `packages/db` — Drizzle ORM + PostgreSQL schema (8 table files, all domain entities)
- `packages/plugins` — 7 plugin interfaces, PluginRegistry, circuit breaker, waterfall composer
- `packages/queue` — BullMQ connection, job types, queue factories
- `apps/api` — Fastify 5: health endpoints, Better Auth proxy, workspace middleware, companies CRUD
- `apps/web` — Next.js 15 App Router: login/register, dashboard layout, sidebar, dark theme, TanStack Query
- `apps/workers` — BullMQ workers (enrichment, email, AI stubs)
- `infra/docker-compose.yml`, `infra/init-db.sql`
- `.github/workflows/ci.yml`
- `verticals/transport/icp.yaml`, `verticals/transport/sources.yaml`
- Replit env configured, workflows set up

### Bug Fixes (Replit setup)
- Added `emailVerified` column migration (`0001_silly_joystick.sql`)
- Better Auth `generateId: false` (let DB generate UUIDs)
- Workspace provisioning via `databaseHooks.user.create.before`
