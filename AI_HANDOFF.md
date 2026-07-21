# AI Sales OS — Agent Handoff Document

> **Last updated:** RC1 Complete + RC2 Plan (2026-07-21)
> **Next milestone:** RC2 — Real Integration Wiring

---

## Replit Setup — Completed 2026-07-13

The project is installed and running on Replit. All Sprint 1.1–1.4 work is complete:

- `pnpm install` done, all packages build clean
- DB migrated (`0000_supreme_donald_blake.sql` + `0001_silly_joystick.sql` — 19 tables)
- Redis runs locally (started by the "API Server" workflow)
- All secrets configured as shared env vars (see `replit.md → Environment Status`)
- Both workflows healthy: "Start application" (port 5000) + "API Server" (port 3001)

**Sprint 1.1 bugs fixed:**
1. `users.emailVerified` column added via migration `0001_silly_joystick.sql`
2. Better Auth `generateId: false` → DB generates UUIDs

**Sprint 1.2 critical fix:**
3. **Workspace provisioning** — Better Auth `databaseHooks.user.create.before` now creates a workspace and injects `workspaceId` into the user row before insert. Signup works end-to-end.

**Post-Sprint 1.4 QA fixes:**
4. **Register form** — `workspaceName` field was collected but not passed to Better Auth → fixed. Now passed as `additionalField`; workspace is named with the value directly (not `"name's Workspace"` suffix).
5. **`next.config.ts`** — `127.0.0.1` added to `allowedDevOrigins` so screenshot tooling and dev-proxy HMR work correctly.

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

## Sprint Status Summary

| Sprint | Status | Key deliverable |
|--------|--------|-----------------|
| 1.1 | ✅ Complete | Foundation — monorepo, packages, Fastify, Next.js scaffold |
| 1.2 | ✅ Complete | CRM Core — companies CRUD, contacts, deals, ICP scoring, activities |
| 1.3 | ✅ Complete | Lead generation — 2ГИС, HH.ru, Dadata, Hunter, Snov plugins |
| 1.4 | ✅ Complete | Outreach — campaigns, sequences, email accounts, sending worker, webhooks |
| 1.5 | ✅ Complete | Dashboard stats, ZodError → 400, rate limiting, contacts page, analytics page, sequence builder UI, ConfirmDialogs |
| QA | ✅ Complete | Pre-Sprint 1.6 audit — 6 bugs fixed (2 P0, 4 P1) |
| 1.6 | ✅ Complete | AI email generation (OpenAI), reply classifier, campaign stats, sequence builder UX |
| **1.7** | **✅ Complete** | E2E outreach flow wired end-to-end: enrollment dispatches jobs, reply stats fixed, delete guard, analytics breakdown |

---

## ════════════════════════════════════════════
## SPRINT 1.7 DELIVERABLES (2026-07-20)
## ════════════════════════════════════════════

Sprint 1.7 closes the last critical gaps in the E2E outreach flow: enrollment now actually
starts email sending, reply stats are accurate, campaign stats cover clicks, the sequence
delete is guarded, and the analytics page shows per-campaign breakdowns.

### Critical E2E Fix — Enrollment → SEND_EMAIL job dispatch

**File:** `apps/api/src/routes/campaigns.ts`

The `POST /api/campaigns/:id/enroll` endpoint was inserting DB records but **never dispatching
BullMQ jobs**, so enrolled companies never received any emails. Fixed:

- After batch insert of `sequenceEnrollments`, the endpoint now calls `getEmailQueue().add(JOBS.SEND_EMAIL, ...)` for each new enrollment.
- Uses the first active email account for the workspace (workspace-scoped, no cross-tenant leakage).
- Falls back gracefully: if no email account is configured, logs a warning but still returns 201 (enrollment persisted).
- Job IDs are deterministic via `makeJobId()` — deduplication is automatic on retry.

### Reply Stats Fixed

**Files:** `apps/api/src/routes/webhooks.ts`, `apps/workers/src/ai/ai.worker.ts`

`emailSends.repliedAt` was never being set, so `workspace.stats.repliesCount` was always 0.
Now fixed in two places for redundancy:

1. **Webhook `replied` event** — adds `case 'replied': updates.repliedAt = timestamp` to the `emailSends` update switch.
2. **CLASSIFY_REPLY job** — after updating `sequenceEnrollments.replyAt`, also sets `emailSends.repliedAt = new Date()`.

The workspace stats query (`WHERE email_sends.replied_at IS NOT NULL`) now returns real counts.

### Campaign `clicked` Stat

**File:** `apps/api/src/routes/webhooks.ts`

- `incrementCampaignStat` type extended to include `'clicked'`.
- Webhook `clicked` event now calls `incrementCampaignStat(enrollmentId, 'clicked')` — de-duped to first click per send (mirrors the existing `opened` pattern).

### Email Worker — Company Email Fallback

**File:** `apps/workers/src/email/email.worker.ts`

- Import `companies` added from `@ai-sales-os/db`.
- When `contactId` is empty/absent, the worker now falls back to `company.emails[0]` before giving up.
- This makes the E2E flow work for companies that have email addresses in their company record without needing a separate contact entity.

### Sequence Delete Guard

**File:** `apps/api/src/routes/sequences.ts`

- Import `sequenceEnrollments` added.
- Before deleting, queries `COUNT(*) WHERE sequenceId = :id AND status = 'active'`.
- Returns `400 BAD_REQUEST` with a clear message when active enrollments exist.
- **New test:** `tests/routes/sequences.test.ts` — "blocks delete when active enrollments exist" case.

### Analytics Page — Per-Campaign Breakdown

**File:** `apps/web/src/app/(dashboard)/analytics/page.tsx`

- New `CampaignBreakdown` component using `useQuery` → `api.campaigns.list()`.
- Shows campaigns with any activity (enrolled > 0 OR sent > 0) in a sortable table.
- Columns: Campaign name (link to detail), Status, Enrolled, Sent, Opened (+ open rate %), Clicked, Replied (+ reply rate %).
- Skeleton loading state; hidden when no active campaigns.

### Verification

- TypeScript: `pnpm turbo run typecheck` → ✅ 0 errors (17 packages)
- Lint: `pnpm turbo run lint` → ✅ 0 errors (1 pre-existing non-null warning in contacts.ts)
- Tests: `pnpm turbo run test` → ✅ **27/27** (+1 new guard test vs Sprint 1.6's 26)
- Both workflows: API (3001) + Web (5000) → ✅ running

### Remaining tech debt (carry forward)

| ID | Priority | Description |
|----|----------|-------------|
| TD-001 | P2 | No soft-delete on campaigns, sequences, email_accounts |
| TD-003 | P2 | ICP scoring logic duplicated in api + workers packages |
| TD-004 | P2 | Path params `:id` not UUID-validated before DB queries |
| TD-006 | P2 | `email_sends.workspaceId` has no FK constraint |
| SEC-005 | P2 | No CSP headers configured |
| TD-007 | P3 | Single `contactId` per batch enrollment — large campaigns need per-company contacts |

---

## ════════════════════════════════════════════
## PRODUCTION-READY AUDIT — PRE-SPRINT 1.6 (2026-07-20, полный аудит)
## ════════════════════════════════════════════

Полный E2E + Security + Performance + Reliability аудит. 6 багов исправлено (2 P0, 4 P1).

### Bugs fixed in this audit

| ID | Priority | Area | File(s) | Description |
|----|----------|------|---------|-------------|
| P0-01 | **P0** | E2E / UX | `campaigns/[id]/page.tsx` | **Enrollment UI отсутствовал** — пользователь не мог зачислить ни одну компанию в цепочку. Весь outreach заблокирован. Добавлен `EnrollModal`. |
| P0-02 | **P0** | E2E / UX | `campaigns/[id]/page.tsx`, `routes/campaigns.ts` | **Таблица участников показывала UUID** вместо названия компании. Исправлено: LEFT JOIN companies + `companyName` в ответе. |
| P1-01 | **P1** | Security | `routes/webhooks.ts` | **Webhook без workspace-фильтра** при hard bounce — `UPDATE companies` без `workspaceId`. Добавлен фильтр по `send.workspaceId`. |
| P1-02 | **P1** | Performance | `routes/webhooks.ts` | **N+1 в webhook-обработчике** — повторный `findFirst` enrollment который уже был загружен. Убрано. |
| P1-03 | **P1** | Performance | `routes/campaigns.ts` | **Последовательные INSERT** — `for...of await insert` для каждой компании. Заменено на batch insert с `onConflictDoNothing()`. |
| P1-04 | **P1** | UX | `campaigns/[id]/page.tsx` | **Статусы участников на английском** — `active`, `bounced` etc. Добавлен `ENR_LABELS` с переводами. |

### Verification results

- `tsc --noEmit`: ✅ apps/api, apps/workers, apps/web — 0 ошибок
- `pnpm turbo run test`: ✅ 26/26 тестов
- Оба воркфлоу: API (3001) + Web (5000) — healthy

### Sprint 1.6 deliverables — все реализованы

| # | Область | Файл | Описание |
|---|---------|------|----------|
| 1 | Workers | `apps/workers/src/shared/ai-helpers.ts` | Новый shared AI-модуль: `generatePersonalisedEmail()`, `classifyReplyText()` с OpenAI + keyword fallback |
| 2 | Workers | `apps/workers/src/email/email.worker.ts` | Вызов AI-персонализации перед отправкой каждого письма; использует company data из БД |
| 3 | Workers | `apps/workers/src/ai/ai.worker.ts` | Рефакторинг на shared ai-helpers; `CLASSIFY_REPLY` теперь инкрементирует `campaigns.stats.replied` |
| 4 | API | `apps/api/src/routes/webhooks.ts` | `replied` event → dispatch `CLASSIFY_REPLY` job; stats update (sent/opened) на `delivered`/`opened` |
| 5 | API | `apps/api/src/services/ai-preview.ts` | Синхронный OpenAI preview для sequence builder UI |
| 6 | API | `apps/api/src/routes/sequences.ts` | `POST /api/sequences/:id/generate-preview` — AI preview endpoint |
| 7 | DB | `packages/db/src/migrations/0002_sprint_1_6_indexes.sql` | 5 индексов: `sequence_enrollments(sequence_id)`, `email_sends(contact_id)` + ещё 3 |
| 8 | Plugins | `packages/plugins/src/interfaces/email-sending.interface.ts` | `EmailWebhookEvent.event` расширен до `'replied'`; metadata получила reply-поля |
| 9 | Web | `apps/web/src/app/(dashboard)/campaigns/[id]/page.tsx` | AI Preview Dialog (выбор компании → OpenAI preview); кнопки ↑↓ для перестановки шагов; AI hint в редакторе; улучшены labels для reply classifications |
| 10 | Web | `apps/web/src/lib/api-client.ts` | `api.sequences.generatePreview()` метод |

### P2 — открытые технические долги (после Sprint 1.6)

- `campaigns.stats.sent` / `opened` / `replied` — не обновляются (требует инструментации worker'а)
- `DELETE /api/sequences/:id` — hard delete, не проверяет активные enrollments
- Нет soft-delete на sequences, campaigns, email_accounts
- Нет FK-индексов на некоторых таблицах

---

## ════════════════════════════════════════════
## FIRST QA PASS — PRE-SPRINT 1.6 (2026-07-20)
## ════════════════════════════════════════════

### Bugs fixed

| ID | Priority | File(s) | Description |
|----|----------|---------|-------------|
| BUG-01 | **P0** | `routes/sequences.ts` | `CreateSequenceSchema.steps` min(1) rejected empty-steps creation from UI → 400 on every new sequence. Fixed: min(0). |
| BUG-02 | **P0** | `routes/campaigns.ts`, `routes/sequences.ts` | PATCH/DELETE/start/pause/stop DML used only `eq(id)` with no workspace filter. Fixed: `eq(workspaceId)` added to every DML WHERE. |
| BUG-03 | **P1** | `routes/companies.ts` | `PATCH /companies/:id` UPDATE lacked `isNull(deletedAt)` → soft-deleted companies could be edited. Fixed. |
| BUG-04 | **P1** | `workers/email.worker.ts`, `queue/jobs.ts` | `scheduleNextStep()` always picked first active account. Fixed: `emailAccountId` propagated through all calls. |
| BUG-05 | **P1** | `routes/contacts.ts` | Contact search only matched `fullName`. Fixed: `OR(fullName, email, phone)`. |
| BUG-06 | **P1** | `routes/campaigns.ts` | `stats.enrolled` never incremented. Fixed: atomic `jsonb_set` after enroll. |

---

## ════════════════════════════════════════════
## POST-SPRINT 1.4 FULL AUDIT (2026-07-19)
## ════════════════════════════════════════════

### What works end-to-end (tested manually)

| Feature | Status | Notes |
|---------|--------|-------|
| Registration | ✅ Working | Workspace name now correctly saved |
| Login / session | ✅ Working | Better Auth cookie, 30-day session |
| Route protection | ✅ Working | Middleware redirects to /login |
| Companies list | ✅ Working | Real data, filters, search, pagination |
| Company detail | ✅ Working | ICP score, contacts tab, timeline, edit, delete |
| Add company (manual) | ✅ Working | |
| CSV import | ✅ Working | Client-side parse → batch JSON POST |
| Lead search (2ГИС / HH) | ✅ API works | Requires `TWOGIS_API_KEY` / optional |
| Company enrichment | ✅ API works | Requires `DADATA_API_KEY` |
| Campaigns list | ✅ Working | Real data, status tabs, lifecycle buttons |
| Create campaign | ✅ Working | |
| Email accounts (Settings) | ✅ Working | Add / disable / delete, credentials encrypted |
| Dashboard page | 🟡 Partial | Renders, all 4 stats hardcoded to `0` |
| Contacts page | ❌ Stub | "Раздел в разработке" |
| Analytics page | ❌ Stub | "Раздел в разработке" |
| Sequence builder UI | ❌ Missing | API exists, no UI |
| Deals UI | ❌ Missing | API exists, no UI |
| AI email writing | ❌ Stub | Worker stub only |
| Reply classification | ❌ Stub | Worker stub only |

---

## CRITICAL BUGS (fix before Sprint 1.5 features)

### BUG-001 — ZodError → HTTP 500 (HIGH)
**Severity:** HIGH — leaks stack traces, breaks all form submissions with bad input

All API routes use `.parse()` (throws `ZodError`) instead of `.safeParse()`. The Fastify
error handler does not catch `ZodError`, so any validation failure returns 500 with a
stack trace instead of 400 with a readable error message.

**Affected routes:** `companies.ts:58`, `contacts.ts:40`, `campaigns.ts:82`, `sequences.ts`,
`email-accounts.ts`, `lead-sources.ts`

**Fix:** Add a Zod error hook to the Fastify app in `apps/api/src/app.ts`:
```typescript
app.setErrorHandler((error, _req, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: error.issues[0]?.message ?? 'Validation error',
      issues: error.issues,
    })
  }
  // ... existing handler
})
```
Or switch all `.parse()` calls to `.safeParse()` and return 400 manually.

---

### BUG-002 — Dashboard stats hardcoded (HIGH UX)
**Severity:** HIGH UX — every new user sees "0 companies" even when they have 50

`apps/web/src/app/(dashboard)/dashboard/page.tsx` passes literal string `"0"` to all
four `StatCard` components. No API calls are made.

**Fix:** Add `GET /api/workspace/stats` endpoint that returns:
```json
{ "companies": 42, "enriched": 18, "emailsSent30d": 310, "replyRate": 4.2 }
```
Then wire it via `useQuery` in the dashboard page.

---

### BUG-003 — Import route N+1 queries (MEDIUM perf)
**Severity:** MEDIUM — importing 500 companies does 1000 DB round-trips

`POST /api/companies/import` calls `db.query.companies.findFirst()` inside a loop for
INN and domain dedup checks. For a 500-row import: 500 INN checks + up to 500 domain
checks = up to 1000 sequential queries.

**Fix:** Collect all INNs and domains upfront, do two bulk `inArray()` queries, build
a Set for O(1) lookup in the loop.

---

### BUG-004 — Rate limiting absent (MEDIUM security)
**Severity:** MEDIUM — auth endpoints and scraping triggers can be brute-forced

No rate limiting on any endpoint. The Better Auth layer has no built-in limit.
Particularly risky: `POST /api/auth/sign-in/email`, `POST /api/lead-sources/search`.

**Fix:** Add `@fastify/rate-limit` plugin in `apps/api/src/app.ts`. Recommended limits:
- Auth endpoints: 10 req/min per IP
- Lead source search: 5 req/min per workspace
- All other endpoints: 100 req/min per workspace

---

## TECHNICAL DEBT (prioritized)

### TD-001 — Soft delete inconsistency (MEDIUM)
`campaigns`, `sequences`, `tasks`, `email_accounts` tables have no `deletedAt` column —
deletes are permanent. Risk: accidental data loss. `companies`, `contacts`, `deals` do
have soft delete.

**Migration needed:** Add `deletedAt timestamp` to all four tables.

### TD-002 — Missing FK indexes (MEDIUM perf)
Three foreign key columns lack dedicated indexes, causing full table scans on joins:
- `sequences.campaign_id`
- `sequence_enrollments.sequence_id`
- `email_sends.contact_id`

**Migration needed:** `CREATE INDEX` on each.

### TD-003 — ICP scoring duplicated (LOW)
`apps/api/src/services/icp-scoring.ts` and `apps/workers/src/shared/icp-scoring.ts`
contain parallel implementations. Risk of drift.

**Fix:** Move canonical implementation to `packages/types/src/icp-scoring.ts` (or a
new `packages/scoring` package) and import it in both apps.

### TD-004 — Path params not Zod-validated (LOW)
Route handlers cast path params as `as { id: string }` without UUID format validation.
A malformed UUID reaches the DB query and produces a cryptic PostgreSQL error.

**Fix:** Add `z.string().uuid()` validation at the top of each handler.

### TD-005 — Zod v3/v4 peer dep conflict (LOW)
`better-auth@1.2.x` requires `zod@^4` internally. The repo pins `zod@^3`. Currently
a peer dep warning only; functionality works. Resolve in Sprint 2.x by upgrading to
zod v4 throughout.

### TD-006 — email_sends.workspaceId missing FK reference (LOW)
`outreach.ts` schema defines `email_sends.workspaceId` as `uuid()` without
`.references(() => workspaces.id)`, unlike every other table. No referential integrity.

**Fix:** Add `.references(() => workspaces.id, { onDelete: 'cascade' })` and run migration.

### TD-007 — Redis ioredis version cast hack (LOW)
`packages/queue/src/queues.ts` casts the ioredis connection to `ConnectionOptions` to
work around a version conflict between BullMQ's ioredis peer dep and our version.
Works at runtime; remove when BullMQ ships ioredis v5 support natively.

### TD-008 — companies ILIKE bypasses GIN index (LOW perf)
`GET /api/companies?search=` falls back to `ILIKE` on `name` and `inn` columns. At
>10k rows this will be slow. The GIN `companies_fts_idx` exists but isn't used for
single-term exact substring search.

**Fix:** Always route through `to_tsvector` search; remove the ILIKE branch.

---

## SECURITY FINDINGS

| ID | Severity | Finding | Fix |
|----|----------|---------|-----|
| SEC-001 | HIGH | `ZodError → HTTP 500` leaks stack traces (= BUG-001) | See BUG-001 |
| SEC-002 | MEDIUM | No rate limiting on auth or search endpoints (= TD-004) | See BUG-004 |
| SEC-003 | MEDIUM | Webhook (`POST /api/webhooks/mailgun`) not behind `workspaceContextPlugin`. Relies on `emailSends.providerId` lookup — timing-safe but workspaceId never validated server-side for webhook events | Add DB-level workspace check after providerId lookup |
| SEC-004 | LOW | Path params cast without UUID validation → raw untrusted string hits DB | See TD-004 |
| SEC-005 | LOW | No `Content-Security-Policy` headers on Next.js responses | Add CSP middleware or use `next.config.ts` headers config |
| SEC-006 | LOW | `email_sends.workspaceId` has no FK constraint → no referential integrity (= TD-006) | See TD-006 |

**Positive findings (working correctly):**
- ✅ Tenant isolation: all routes filter by `request.workspaceId` from session
- ✅ Credential encryption: AES-256-GCM, key never in DB, credentials never returned in GET
- ✅ Session cookies: `httpOnly`, `sameSite: 'lax'`, scoped to domain
- ✅ PostgreSQL RLS: `app.current_workspace_id` set per request via `workspaceContextPlugin`
- ✅ Mailgun signature validation on webhook

---

## FRONTEND GAPS (by page)

### `/dashboard`
- ❌ All 4 StatCards hardcoded to `"0"` — no API calls (= BUG-002)
- ❌ No loading skeleton
- ❌ "Начните с импорта..." CTA not linked to import modal
- ✅ Title fixed to Russian "Дашборд" (was English "Dashboard") — **fixed 2026-07-20**

### `/companies`
- ⚠️ Table has no `overflow-x-auto` wrapper — overflows on narrow screens
- ⚠️ No confirmation dialog before bulk delete (if added in future)
- ✅ Status badge colors fixed for dark theme — **fixed 2026-07-20**

### `/companies/:id`
- ✅ Mostly complete
- ✅ Delete button colors fixed for dark theme — **fixed 2026-07-20**
- ✅ `confirm()` replaced with ConfirmDialog modal — **fixed 2026-07-20**
- ⚠️ "Обогатить" button has no loading state after click (fires and forgets)
- ⚠️ Contact cards have no edit/delete actions (API supports PATCH + soft-delete, UI does not)

### `/contacts` (global)
- ✅ Implemented — real contacts table with search (debounced), avatars, email/phone links, company link, pagination — **fixed 2026-07-20**
- ⚠️ Company name not shown (only link icon) — contacts API returns companyId but not companyName
- ⚠️ No inline edit or bulk actions

### `/campaigns`
- ✅ List + lifecycle working
- ✅ Status badge colors fixed for dark theme — **fixed 2026-07-20**
- ✅ `confirm()` replaced with ConfirmDialog modal — **fixed 2026-07-20**
- ❌ Enrollment UI missing (enroll companies into a campaign from UI)

### `/campaigns/:id`
- ✅ Sequence builder works
- ✅ `confirm()` replaced with ConfirmDialog modal (stop + delete sequence) — **fixed 2026-07-20**

### `/analytics`
- ✅ Implemented — KPI cards, conversion funnel bars, reply rate gauge, "Coming soon" report grid — **fixed 2026-07-20**
- ⚠️ Only uses workspace.stats() aggregate endpoint; no time-series data yet

### `/settings`
- ✅ Email accounts CRUD working
- ✅ `confirm()` replaced with ConfirmDialog modal — **fixed 2026-07-20**
- ⚠️ No workspace settings (team members, plan info)
- ⚠️ No way to test email account connection (send test email)

### Global UX — fixed 2026-07-20
- ✅ `loading.tsx` and `error.tsx` added for `/dashboard` route group
- ✅ Root `error.tsx` added for catastrophic failures
- ✅ `ConfirmDialog` component created in `apps/web/src/components/ui/confirm-dialog.tsx`

### Global UX gaps (remaining)
- ❌ No keyboard navigation for modals (Escape to close)
- ❌ Icon-only buttons (`🗑️`, `▶`, `⏸`) have no `aria-label`
- ❌ No empty state illustrations — only text placeholders

---

## DATABASE STATE

### Tables (19 total)
```
Core:       workspaces, users
CRM:        companies, contacts, deals, activities, tasks
Outreach:   campaigns, sequences, sequence_enrollments, email_sends, email_accounts
System:     enrichment_jobs, api_keys, ai_logs, audit_logs
Auth:       accounts, sessions, verifications
```

### Indexes present
- `companies_fts_idx` — GIN full-text (but ILIKE fallback bypasses it)
- `companies_status_idx`, `companies_workspace_idx`
- `contacts_company_idx`, `contacts_workspace_idx`
- `campaigns_workspace_idx`, `email_sends_provider_idx`

### Missing indexes (see TD-002)
- `sequences(campaign_id)`
- `sequence_enrollments(sequence_id)`
- `email_sends(contact_id)`

### Soft-delete coverage
- Has `deletedAt`: `companies`, `contacts`, `deals`
- **Missing** `deletedAt`: `campaigns`, `sequences`, `tasks`, `email_accounts` (see TD-001)

---

## SPRINT 1.5 — PLAN (prioritized)

### Must-do before new features (P0 — fix critical debt)

**P0.1 — ZodError global handler** (BUG-001)
- File: `apps/api/src/app.ts`
- Add `setErrorHandler` that catches `ZodError` → 400
- Unblocks: all form submissions returning 500

**P0.2 — Dashboard stats API + UI** (BUG-002)
- Add `GET /api/workspace/stats` → `{companies, enriched, emailsSent30d, replyRate}`
- Wire `useQuery` in `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- Time: ~2h

**P0.3 — Rate limiting** (BUG-004)
- Add `@fastify/rate-limit` in `apps/api/src/app.ts`
- 10 req/min on `/api/auth/*`, 100 req/min elsewhere
- Time: ~1h

### Sprint 1.5 features (P1)

**P1.1 — AI email writer** (was Sprint 1.5 plan)
- Implement `GENERATE_EMAIL` job in `apps/workers/src/ai/ai.worker.ts`
- Input: company data + sequence step template + vertical prompts
- Output: personalised subject + body stored in `email_sends.bodyHtml`
- Requires `OPENAI_API_KEY` or compatible LLM endpoint
- New package: `packages/ai/` with prompt templates per vertical

**P1.2 — Reply classifier** (was Sprint 1.5 plan)
- Implement `CLASSIFY_REPLY` job
- Classes: `interested | not_now | not_interested | out_of_office | auto_reply`
- Update `sequence_enrollments.replyClassification`
- Stop sequence on `interested` / `not_interested` if `stopOnReply = true`

**P1.3 — Sequence builder UI**
- Route: `/campaigns/:id` (campaign detail) → shows sequences list
- Route: `/sequences/:id` → step editor (ordered list of email+wait steps)
- Drag-to-reorder steps, per-step subject/body editor, preview panel
- Enrollment list tab: who is in this sequence + per-person status

**P1.4 — Global toast notification system**
- Install `sonner` or `react-hot-toast`
- Replace all silent `console.log` success/error handlers with toasts
- Affects: all mutation callbacks in companies, contacts, campaigns, settings pages

**P1.5 — Import N+1 fix** (BUG-003)
- Refactor `POST /api/companies/import` bulk dedup check
- Two `inArray()` queries (INN set + domain set) instead of N findFirst calls

### Sprint 1.6 (P2 — next quarter)

**P2.1 — Global contacts page**
- Table with search, filter by company/status/enrichment
- Inline edit (PATCH), soft-delete
- Bulk actions: enroll in campaign, export CSV

**P2.2 — Analytics page**
- Campaign funnel: enrolled → sent → opened → clicked → replied → meeting
- Per-campaign breakdown table
- Time-series chart (daily sends + replies over 30 days)
- Requires: query `email_sends` grouped by `campaign_id` + date

**P2.3 — Soft delete for campaigns/sequences/tasks/email_accounts** (TD-001)
- Migration: add `deletedAt timestamp` to all four tables
- Update all DELETE routes to soft-delete

**P2.4 — Missing FK indexes** (TD-002)
- Migration: add indexes on `sequences.campaign_id`, `sequence_enrollments.sequence_id`, `email_sends.contact_id`

**P2.5 — Deals UI**
- Kanban board at `/deals` (drag cards between stages)
- Deal sidebar on company detail page
- Links deal stage changes to activity timeline (already working in API)

**P2.6 — Workspace settings page**
- Team member management (invite by email)
- Plan / billing info panel
- API keys management (table already in DB)

### Sprint 2.x (backlog)

| Item | Why |
|------|-----|
| ICP scoring dedup (`@ai-sales-os/scoring`) | TD-003 — same logic in two places |
| Zod v4 upgrade | TD-005 — peer dep warning, resolve before major release |
| email_sends FK constraint | TD-006 — referential integrity |
| CSP headers | SEC-005 — security hardening |
| LLM hybrid ICP scoring | Sprint 2.2 placeholder in AI_HANDOFF v1 |
| Multi-workspace support (team roles) | Growth feature |
| Mobile-responsive companies table | TD — overflow-x |
| A11y pass (aria-labels, keyboard nav) | Accessibility |

---

## Architecture Decisions (carry forward)

### Plugin System
All external integrations go through typed interfaces in `packages/plugins/src/interfaces/`.
New providers implement the interface and register in `register-all.ts`.
Circuit breaker (5 failures → 30 min open) guards every provider call.
Email finding uses waterfall: confidence >= 0.3 required to stop trying.

### ICP Scoring (Sprint 1.2, rule-based)
`apps/api/src/services/icp-scoring.ts` mirrors `verticals/transport/icp.yaml`.
Score thresholds: `qualified >= 50`, `high_quality >= 75`, `reject < 30`.
Called automatically on company create, update, and import.
**Known debt:** Same logic duplicated in `apps/workers/src/shared/icp-scoring.ts`. See TD-003.

### Workspace Provisioning
Implemented via Better Auth `databaseHooks.user.create.before`. Creates workspace,
uses `workspaceName` additionalField if passed (else falls back to user's name).
Sets 14-day trial. Injects `workspaceId` and `role: 'owner'` into user data before DB insert.

### `sent_today` Counter (RISK-001)
Daily email send limits per email account live in **Redis INCR**
(key: `sent_today:{emailAccountId}:{YYYY-MM-DD}`), **not** in the DB column.
This avoids write contention under high concurrency.
The `emailAccounts.sentToday` DB column is NOT used — treat it as display cache only.

### Workspace Isolation
Double isolation: PostgreSQL RLS (`app.current_workspace_id` session variable) +
`workspace_id` column on every table. The workspace context Fastify plugin sets the
RLS variable on every authenticated request.

### BullMQ + ioredis
Two ioredis versions may be pulled in by BullMQ's deps. The `packages/queue/src/queues.ts`
casts the connection to `ConnectionOptions` to avoid the type conflict.
At runtime they're the same binary — no issue. See TD-007.

### Better Auth + Zod
`better-auth@1.2.x` internally requires `zod@^4` (via `better-call` peer).
We pin `zod@^3` in all our packages and schemas. Peer dep warning only; auth works.
See TD-005 for resolution plan.

### `exactOptionalPropertyTypes: true`
The tsconfig enforces this. `{ foo?: string }` rejects explicit `undefined`.
Use the omit-if-falsy pattern (`if (x) payload.x = x`) when building API payloads.

---

## Replit Dev Environment Notes

- **Web preview** runs on port 5000 (`apps/web`, Next.js). Workflow: `Start application`
- **API** runs on port 3001 (`apps/api`, Fastify). Workflow: `API Server`
- No Docker on Replit — use Replit PostgreSQL integration for the DB
- Redis started by `API Server` workflow via `redis-server --daemonize yes`
- Dev bypass: append `?_dev=1` to any dashboard URL — skips auth in `NODE_ENV=development`
- `SESSION_SECRET` is in Replit Secrets; `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY` are in shared env
- `127.0.0.1` is in `allowedDevOrigins` in `next.config.ts` ✅

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
| Campaigns API | `apps/api/src/routes/campaigns.ts` |
| Sequences API | `apps/api/src/routes/sequences.ts` |
| Email accounts API | `apps/api/src/routes/email-accounts.ts` |
| Webhook handler | `apps/api/src/routes/webhooks.ts` |
| Deals API | `apps/api/src/routes/deals.ts` |
| ICP Scoring service | `apps/api/src/services/icp-scoring.ts` |
| Email sending worker | `apps/workers/src/email/email.worker.ts` |
| AI worker (stub) | `apps/workers/src/ai/ai.worker.ts` |
| API client (web) | `apps/web/src/lib/api-client.ts` |
| Next.js root layout | `apps/web/src/app/layout.tsx` |
| Auth middleware | `apps/web/src/middleware.ts` |
| Dashboard page | `apps/web/src/app/(dashboard)/dashboard/page.tsx` |
| Companies list page | `apps/web/src/app/(dashboard)/companies/page.tsx` |
| Company detail page | `apps/web/src/app/(dashboard)/companies/[id]/page.tsx` |
| Campaigns page | `apps/web/src/app/(dashboard)/campaigns/page.tsx` |
| Settings page | `apps/web/src/app/(dashboard)/settings/page.tsx` |
| ICP rules | `verticals/transport/icp.yaml` |

---

## ════════════════════════════════════════════
## RC1 COMPLETE — Quality Gate (2026-07-21)
## ════════════════════════════════════════════

### Security fix completed: Contacts API workspace isolation

The incomplete security fix from Sprint 1.7 has been closed:
- `apps/api/src/routes/contacts.ts` — workspace isolation was already implemented across all 5
  endpoints (GET list, GET /:id, POST, PATCH /:id, DELETE /:id). The remaining gap was the
  **absence of a regression test file**.
- `apps/api/tests/routes/contacts.test.ts` — **new file, 21 tests** covering:
  - GET / list: paginated, empty, companyId filter, search param
  - GET /:id: own workspace → 200, other workspace → 404, soft-deleted → 404
  - POST /: workspace assignment, cross-workspace company rejection (400), email duplicate (400), no company
  - PATCH /:id: own workspace → 200, other workspace → 404, email duplicate → 400
  - DELETE /:id: own workspace → 204, other workspace → 404, already deleted → 404
  - Summary suite: 4 explicit cross-workspace checks (404 = no info leak, no mutation possible)
- Lint fix: `or()` non-null assertion in `contacts.ts:56` replaced with a guarded `if (searchExpr)`
  pattern — 0 warnings now (was 1 warning).

### RC1 Quality Gate — Final Results

| Check | Result | Detail |
|-------|--------|--------|
| `pnpm turbo run typecheck` | ✅ 0 errors | 17 packages |
| `pnpm turbo run lint` | ✅ 0 errors, 0 warnings | 9 packages (was 1 warning) |
| `pnpm turbo run test` | ✅ **48/48** | +21 contacts tests vs RC0's 27 |
| Workflows | ✅ Both healthy | API (3001) + Web (5000) |
| Smoke test UI | ✅ All 6 pages render | Login, Dashboard, Companies, Contacts, Campaigns, Analytics |
| API endpoints | ✅ Auth enforced | 401 on unauthenticated, correct shapes |

**RC1 is fully green. No new features added.**

---

## ════════════════════════════════════════════
## RC2 PLAN — Real Integration Wiring
## ════════════════════════════════════════════

> Scope: connect the already-implemented plugin code to real external APIs.
> No new features — just secrets, config, and end-to-end wire-up tests.

### Integration Status Matrix

| Integration | Plugin File | Status | Missing |
|-------------|-------------|--------|---------|
| **OpenAI** | `apps/workers/src/shared/ai-helpers.ts` | ✅ Real code, gpt-4o-mini | `OPENAI_API_KEY` secret |
| **Mailgun** | `packages/plugins/src/implementations/email/mailgun.provider.ts` | ✅ Real code, REST API | `MAILGUN_API_KEY` + `MAILGUN_DOMAIN` secrets + DNS setup |
| **Brevo SMTP** | *(not yet implemented)* | ❌ No provider | New `SmtpPlugin`, `BREVO_API_KEY` / SMTP creds |
| **2GIS** | `packages/plugins/src/implementations/lead-sources/twogis.provider.ts` | ✅ Real code, Catalog API v3 | `TWOGIS_API_KEY` secret |
| **HH.ru** | `packages/plugins/src/implementations/lead-sources/hhru.provider.ts` | ✅ Real code, Public API | No key needed (public), but User-Agent must be set |
| **Hunter.io** | `packages/plugins/src/implementations/enrichment/hunter.provider.ts` | ✅ Real code, v2 API | `HUNTER_API_KEY` secret |
| **Snov.io** | `packages/plugins/src/implementations/enrichment/snov.provider.ts` | ✅ Real code (domain-search) | `SNOV_API_KEY` secret, person-endpoint missing |
| **Dadata** | `packages/plugins/src/implementations/enrichment/dadata.provider.ts` | ✅ Real code, ЕГРЮЛ/ЕГРИП | `DADATA_API_KEY` secret |

### Secrets Required for RC2

| Secret / Env Var | Where Used | Free Tier | Registration |
|------------------|-----------|-----------|--------------|
| `OPENAI_API_KEY` | AI email personalisation + reply classification | No free tier; gpt-4o-mini ~$0.15/1M tokens | platform.openai.com |
| `MAILGUN_API_KEY` | Email sending (production) | Flex: 100 emails/day free for 3 months | mailgun.com |
| `MAILGUN_DOMAIN` | Email sending (sender domain) | Sandbox domain available for testing | mailgun.com |
| `BREVO_API_KEY` | Alternative SMTP (optional, RC2 stretch) | **300 emails/day free forever** | brevo.com |
| `TWOGIS_API_KEY` | Lead generation from 2GIS catalog | Free tier: registration required, limited RPS | dev.2gis.ru |
| `HUNTER_API_KEY` | Email finding (waterfall, priority 1) | **25 searches/month free** | hunter.io |
| `SNOV_API_KEY` | Email finding (waterfall, priority 2) | Trial credits on signup | snov.io |
| `DADATA_API_KEY` | Company enrichment via ЕГРЮЛ | **100 requests/day free** | dadata.ru |
| *(none)* | HH.ru lead source | Public API, no key | hh.ru/api |

> **Quick start for RC2:** `OPENAI_API_KEY` + `HUNTER_API_KEY` + `MAILGUN_API_KEY`/`MAILGUN_DOMAIN`
> are the three highest-value secrets. Everything else can be added incrementally.

### What's Already Implemented (no code changes needed)

1. **OpenAI AI helpers** (`apps/workers/src/shared/ai-helpers.ts`)
   - `generatePersonalisedEmail(companyId, template)` — calls gpt-4o-mini, falls back to `{{var}}` substitution
   - `classifyReplyText(text)` — 5-class classifier (interested/not_now/not_interested/ooo/auto)
   - Lazy client singleton: just set `OPENAI_API_KEY` and it activates automatically

2. **Mailgun sending** (`packages/plugins/src/implementations/email/mailgun.provider.ts`)
   - Full `send()` implementation with tracking (opens, clicks)
   - `parseWebhook()` for Mailgun webhook events
   - Webhook route already wired: `POST /api/webhooks/mailgun` with HMAC signature validation
   - Just needs `MAILGUN_API_KEY` + `MAILGUN_DOMAIN` env vars

3. **2GIS lead search** (`packages/plugins/src/implementations/lead-sources/twogis.provider.ts`)
   - Searches by rubric code + city name → returns companies with address, phone, category
   - City IDs hardcoded for major Russian cities (Moscow, SPb, Ekb, etc.)
   - Registered in plugin registry as priority 1 lead source

4. **HH.ru employer search** (`packages/plugins/src/implementations/lead-sources/hhru.provider.ts`)
   - Public API, no key required
   - Searches employers with open vacancies → buying signal
   - Works now (just needs HH.ru to not block the User-Agent)

5. **Hunter.io email finder** (`packages/plugins/src/implementations/enrichment/hunter.provider.ts`)
   - `findEmail(domain, firstName, lastName)` — email-finder endpoint
   - `enrichDomain(domain)` — domain-search for all emails at a company
   - `verifyEmail(email)` — email-verifier
   - Confidence ≥ 0.3 required to stop the waterfall chain

6. **Dadata enrichment** (`packages/plugins/src/implementations/enrichment/dadata.provider.ts`)
   - `enrichByInn(inn)` — exact lookup via ЕГРЮЛ/ЕГРИП
   - `enrichByName(name)` — fuzzy suggest
   - Returns: full legal name, address, OKVED, headcount, registration date

7. **Plugin registry** (`packages/plugins/src/registry/register-all.ts`)
   - All plugins registered with priority and category
   - Circuit breaker (5 failures → 30 min open) already wraps every provider
   - Waterfall composer: tries priority-1, falls back to priority-2, etc.

### What Needs to Be Done for RC2

#### RC2-01 — Secret injection (30 min)
Set the following in Replit shared env (via environment-secrets skill):
```
OPENAI_API_KEY      = sk-...
MAILGUN_API_KEY     = ...
MAILGUN_DOMAIN      = mg.yourdomain.com  (or sandbox-xxx.mailgun.org for testing)
TWOGIS_API_KEY      = ...
HUNTER_API_KEY      = ...
DADATA_API_KEY      = ...
```

#### RC2-02 — Mailgun domain DNS (30–60 min, user action)
Mailgun requires DNS records (MX, SPF, DKIM) on the sending domain.
For testing, use the Mailgun sandbox domain — no DNS setup needed, but can only
send to verified recipient addresses.
- Action: add verified recipient emails in Mailgun dashboard for sandbox testing

#### RC2-03 — Brevo SMTP plugin (optional, 2h)
Brevo's 300 emails/day free tier is better for early-stage than Mailgun's 100/day.
Implement `packages/plugins/src/implementations/email/brevo.provider.ts`:
```typescript
// SMTP via nodemailer or Brevo REST API
// Interface: IEmailSendingPlugin (same as Mailgun)
// Env vars: BREVO_API_KEY
// Register in register-all.ts as priority 2 (Mailgun stays priority 1)
```
Webhook tracking for Brevo requires a different event schema than Mailgun's — new
`parseWebhook()` branch needed in `apps/api/src/routes/webhooks.ts`.

#### RC2-04 — End-to-end smoke test with real keys (1h)
After secrets are set:
1. Register account → creates workspace
2. Add email account in Settings (uses encrypted credentials)
3. Create company manually or import CSV
4. Trigger enrichment → Dadata should populate fields
5. Use "Найти компании" → 2GIS + HH.ru should return results
6. Create campaign → add sequence → enroll company
7. Workers dispatch `SEND_EMAIL` → Mailgun sends real email
8. Check Mailgun logs → verify delivered/opened events hit `/api/webhooks/mailgun`
9. Check analytics page → stats should update

#### RC2-05 — Snov.io person-based email finder (2h)
Current implementation only uses `get-emails-from-url` (domain-search).
The person-based endpoint (`/v1/get-emails-from-names`) gives higher quality results.
File: `packages/plugins/src/implementations/enrichment/snov.provider.ts`
Add `findEmail(domain, firstName, lastName)` method calling the names endpoint.

#### RC2-06 — Webhook HMAC hardening (1h)
Current Mailgun webhook handler validates field presence but not the full HMAC-SHA256
signature as Mailgun's docs specify. File: `apps/api/src/routes/webhooks.ts`
The existing skeleton has the right structure — just needs the crypto verification call.

#### RC2-07 — 2GIS dynamic city lookup (1h)
Currently `CITY_IDS` is a hardcoded map for ~10 major cities.
Small/mid cities not in the map fall back to no results.
File: `packages/plugins/src/implementations/lead-sources/twogis.provider.ts`
Add a `/3.0/suggest/geo` call to resolve city names to IDs dynamically.

### RC2 Priority Order

```
P0 (blocks all real sending):
  RC2-01 — Set secrets
  RC2-02 — Mailgun DNS / sandbox setup

P1 (validates the full E2E flow):
  RC2-04 — End-to-end smoke test with real keys

P2 (improves coverage):
  RC2-03 — Brevo SMTP plugin (better free tier)
  RC2-06 — Webhook HMAC hardening

P3 (quality improvements):
  RC2-05 — Snov.io person-based finder
  RC2-07 — 2GIS dynamic city lookup
```

---

## Sprint 1.1–1.4 Completed Work (archived)

### Sprint 1.1 ✅
- pnpm 10 workspace + Turborepo task graph
- `packages/logger`, `packages/errors`, `packages/config`, `packages/types`
- `packages/db` — Drizzle ORM, 8 schema files (all tables), client singleton
- `packages/plugins` — 7 plugin interfaces, PluginRegistry, circuit breaker, waterfall
- `packages/queue` — BullMQ connection, job type defs, queue factories
- `apps/api` — Fastify 5: health endpoints, Better Auth proxy, workspace middleware
- `apps/web` — Next.js 15: login/register forms, dashboard layout, sidebar, dark theme
- `apps/workers` — BullMQ workers (enrichment, email, AI stubs)
- `infra/`, `.github/workflows/ci.yml`, `verticals/transport/`

### Sprint 1.2 ✅
- Workspace auto-provisioning on signup
- ICP Scoring service (rule-based, 0–100)
- Companies full CRUD + FTS + import + enrichment trigger
- Contacts CRUD, Deals CRUD, Activity timeline
- UI: `/companies` list + `/companies/:id` detail

### Sprint 1.3 ✅
- 2ГИС plugin, HH.ru plugin, Dadata plugin, Hunter.io, Snov.io
- Scraping queue + worker
- Lead sources API (`/api/lead-sources/*`)
- UI: "Найти компании" modal, ICP range filter, source filter

### Sprint 1.4 ✅
- Campaigns API (CRUD + lifecycle state machine)
- Sequences API (JSONB steps, uniqueness validation)
- Email accounts API (AES-256-GCM encryption)
- Email sending worker (BullMQ, daily limits via Redis INCR)
- Mailgun webhook handler (signature validation)
- UI: `/campaigns` page
- API tests: 26/26 passing (campaigns + sequences)
