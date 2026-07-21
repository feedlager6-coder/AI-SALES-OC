# Changelog

All notable changes to AI Sales OS are documented here.
Format: [Sprint] — [Date] — [Summary]

---

## RC1 Complete — Contacts Workspace Isolation + Quality Gate (2026-07-21)

Closes the incomplete security fix from Sprint 1.7 and confirms RC1 is fully green.
No new features added.

### Security fix: Contacts API regression test

- **`apps/api/tests/routes/contacts.test.ts`** — New test file (21 tests) covering
  workspace isolation across all 5 contacts endpoints:
  - `GET /` — list: pagination, empty state, companyId filter, search param
  - `GET /:id` — own workspace → 200; other workspace → 404 (no info leak); soft-deleted → 404
  - `POST /` — workspace assignment; cross-workspace company → 400; duplicate email → 400; no company
  - `PATCH /:id` — own workspace → 200; other workspace → 404; duplicate email → 400
  - `DELETE /:id` — own workspace → 204; other workspace → 404; already deleted → 404
  - Summary suite: 4 explicit cross-workspace isolation checks

  The implementation uses a thenable mock chain pattern to handle Drizzle's
  `Promise.all([rowQuery, countQuery])` list pattern without a real DB connection.

### Lint fix: contacts.ts non-null assertion

- **`apps/api/src/routes/contacts.ts`** — Replaced `or(...)!` non-null assertion (line 56)
  with a guarded `if (searchExpr) conditions.push(searchExpr)` pattern.
  Result: 0 ESLint warnings (was 1 pre-existing warning).

### RC1 Quality Gate — Final Results

| Check | Result |
|-------|--------|
| `pnpm turbo run typecheck` | ✅ 17/17 packages, 0 errors |
| `pnpm turbo run lint` | ✅ 9/9 packages, 0 errors, **0 warnings** |
| `pnpm turbo run test` | ✅ **48/48 tests** (3 test files) |
| Workflows | ✅ API (3001) + Web (5000) healthy |
| Smoke test | ✅ All 6 UI pages render; API auth enforced |

---

## Sprint 1.7 — E2E Outreach Flow Completion (2026-07-20)

Sprint 1.7 closes the critical gap that prevented any emails from being sent after enrollment,
fixes reply stat tracking, adds click stat tracking, and hardens the sequence delete endpoint.

### Critical fix: Enrollment now starts the email flow

- **`apps/api/src/routes/campaigns.ts`** — After batch-inserting `sequenceEnrollments`, the
  enroll endpoint now dispatches `SEND_EMAIL` BullMQ jobs for each new enrollment. The job
  targets the first step of the sequence and uses the first active email account for the
  workspace. Without this fix, enrolled companies never received any emails.
- Also hardened: `campaigns.stats.enrolled` increment now includes `workspaceId` in the WHERE
  clause (workspace filter was missing in Sprint 1.6).
- New imports: `emailAccounts` (db), `getEmailQueue`, `JOBS`, `makeJobId` (queue).

### Stats accuracy fixes

- **`apps/api/src/routes/webhooks.ts`** — Added `case 'replied': updates.repliedAt = timestamp`
  to the `emailSends` update switch. Previously `repliedAt` was never set on the DB row,
  causing `workspace.stats.repliesCount` to always return 0.
- **`apps/workers/src/ai/ai.worker.ts`** — `CLASSIFY_REPLY` handler now also sets
  `emailSends.repliedAt = new Date()` after classification completes. Provides a second write
  path for replies that come through AI classification.
- **`apps/api/src/routes/webhooks.ts`** — `clicked` events now call
  `incrementCampaignStat(enrollmentId, 'clicked')` (de-duped to first click per send).
  `incrementCampaignStat` type extended to include `'clicked'`.

### Email worker: company email fallback

- **`apps/workers/src/email/email.worker.ts`** — When no `contactId` is provided, the worker
  now falls back to `company.emails[0]` before marking the enrollment as stopped. This allows
  outreach to work for companies with email addresses in their company record.

### Sequence delete guard

- **`apps/api/src/routes/sequences.ts`** — `DELETE /api/sequences/:id` now checks for active
  enrollments before deleting. Returns `400 BAD_REQUEST` if any exist. Import of
  `sequenceEnrollments` added.

### Analytics page: per-campaign breakdown

- **`apps/web/src/app/(dashboard)/analytics/page.tsx`** — New `CampaignBreakdown` component
  renders a table of campaigns with activity (enrolled > 0 or sent > 0), showing: name (linked),
  status, enrolled, sent, opened (+open rate %), clicked, replied (+reply rate %). Skeleton
  loading state; hidden when no active campaigns.

### Tests

- **`apps/api/tests/routes/sequences.test.ts`** — Added `sequenceEnrollments` to the DB mock
  and two new test cases: "deletes sequence when found" (updated with enrollment count mock) and
  "blocks delete when active enrollments exist" (new 400 guard test).
- **Total: 27/27 tests ✅** (+1 vs Sprint 1.6)

### Verification

- `pnpm turbo run typecheck` → ✅ 0 errors (17 packages)
- `pnpm turbo run lint` → ✅ 0 errors
- `pnpm turbo run test` → ✅ 27/27
- Both workflows running: API (3001) + Web (5000)

---

## Sprint 1.6 — AI Email Generation & Reply Classifier (2026-07-20)

Sprint 1.6 wires up the OpenAI-powered personalisation that was built in Sprint 1.4 but never connected to the sending pipeline. Adds campaign stats tracking, reply classification dispatch, and a sequence builder "Generate with AI" preview feature.

### New features

- **AI email personalisation at send time** (`apps/workers/src/email/email.worker.ts`)
  - Before every email is sent, `generatePersonalisedEmail()` is called with the company context (name, city, industry, INN, website, employees).
  - OpenAI `gpt-4o-mini` personalises subject + body; falls back to `{{variable}}` template substitution when no API key is set.
  - `usedAI` flag logged to `ai_logs` for audit trail.

- **Reply classifier dispatched from webhook** (`apps/api/src/routes/webhooks.ts`)
  - New `replied` event case: dispatches `CLASSIFY_REPLY` BullMQ job to the AI queue.
  - `CLASSIFY_REPLY` in `ai.worker.ts`: classifies reply as `interested` / `not_now` / `not_interested` / `out_of_office` / `question` / `other`; stops sequence for definitive replies; increments `campaigns.stats.replied`.

- **Campaign stats tracking** (`apps/api/src/routes/webhooks.ts`, `apps/workers/src/ai/ai.worker.ts`)
  - `stats.sent` incremented on `delivered` event.
  - `stats.opened` incremented on first `opened` event per send.
  - `stats.replied` incremented after CLASSIFY_REPLY completes.
  - All increments use atomic `jsonb_set` — no race conditions.

- **AI Preview endpoint** (`apps/api/src/routes/sequences.ts`, `apps/api/src/services/ai-preview.ts`)
  - `POST /api/sequences/:id/generate-preview` — takes `{ stepNumber, companyId }`, returns personalised `{ subject, bodyText, bodyHtml, usedAI, companyName }`.
  - Called synchronously in the API process (same OpenAI model as workers).

- **Sequence builder UX improvements** (`apps/web/src/app/(dashboard)/campaigns/[id]/page.tsx`)
  - **✨ "Generate with AI" button** per email step — opens `AiPreviewDialog`: search for a company, press generate, see personalised preview in-place.
  - **↑↓ step reordering buttons** — move any step up or down; step numbers auto-renumbered.
  - **AI hint banner** in editor explaining template variables.
  - **Reply classification labels** in enrollments table — shows emoji-annotated Russian labels instead of raw enum values.
  - Stats grid now shows `sent` / `opened` / `replied` counts (previously always 0).

### Technical

- **Shared AI helpers** (`apps/workers/src/shared/ai-helpers.ts`) — extracted from ai.worker to avoid duplication between email.worker and ai.worker.
- **DB migration 0002** — 5 new performance indexes: `sequence_enrollments(sequence_id)`, `sequence_enrollments(workspace_id, status)`, `email_sends(contact_id)`, `email_sends(enrollment_id)`, `email_sends(workspace_id, sent_at)`.
- **Plugin type extended** — `EmailWebhookEvent.event` now includes `'replied'`; metadata extended with reply-specific fields (`from`, `replyText`, `body`, `stripped`).
- `openai` package added to `apps/api` for synchronous preview generation.

### Verification

- TypeScript: `tsc --noEmit` — 0 errors: `apps/api`, `apps/workers`, `apps/web`
- Tests: **26/26 ✅** (no regressions)
- DB migration: applied cleanly (`0002_sprint_1_6_indexes.sql`)
- Both workflows healthy: API (3001) + Web (5000)

---

## Production-Ready Audit — Pre-Sprint 1.6 (2026-07-20, второй проход)

Full E2E + security + performance + reliability audit. Found 6 bugs (2 P0, 4 P1). All fixed.

### P0 — Blocking

- **P0-01 — Enrollment UI полностью отсутствовал** (`apps/web/src/app/(dashboard)/campaigns/[id]/page.tsx`)
  - API `POST /api/campaigns/:id/enroll` существовал и был типизирован, но ни один UI-компонент его не вызывал.
  - Вкладка «Участники» говорила «Зачислите компании из раздела Компании», но такой функции там тоже не было.
  - Весь outreach-поток был заблокирован: создать цепочку можно, запустить нельзя.
  - Fix: добавлен `EnrollModal` — поиск компаний по названию, checkbox-выбор, выбор цепочки (если их несколько), кнопка зачисления. Кнопка «Зачислить компании» появляется в заголовке вкладки и на empty-state.

- **P0-02 — Таблица участников показывала сырой UUID** (`apps/web/src/app/(dashboard)/campaigns/[id]/page.tsx`, `apps/api/src/routes/campaigns.ts`)
  - `enr.companyId` (UUID вида `550e8400-e29b-41d4...`) отображался как имя участника — нечитаемо.
  - Fix: GET `/api/campaigns/:id/enrollments` теперь делает LEFT JOIN с таблицей `companies` и возвращает `companyName`; таблица показывает название с кликабельной ссылкой на карточку компании. Тип `SequenceEnrollment` в api-client обновлён.

### P1 — Серьёзные ошибки

- **P1-01 — Webhook: обновление статуса компании без workspace-фильтра** (`apps/api/src/routes/webhooks.ts`)
  - При hard bounce: `UPDATE companies SET status='opted_out' WHERE id=?` — без `workspaceId`. Подписанный webhook мог изменить компанию из другого workspace через известный `companyId`.
  - Fix: добавлен `and(eq(companies.id, ...), eq(companies.workspaceId, send.workspaceId))`.

- **P1-02 — Webhook N+1: повторный запрос enrollment** (`apps/api/src/routes/webhooks.ts`)
  - Обработчик hard bounce обновлял `sequenceEnrollments` по `enrollmentId`, а затем снова делал `findFirst` на тот же `enrollmentId` чтобы получить `companyId` — 3 запроса вместо 2.
  - Fix: enrollment загружается один раз в начале блока, используется для обоих обновлений.

- **P1-03 — Зачисление: N последовательных INSERT вместо batch** (`apps/api/src/routes/campaigns.ts`)
  - `for...of` с `await db.insert(...)` на каждой компании: 50 компаний = 50 round-trip к БД.
  - Fix: заменено на `db.insert().values([...]).onConflictDoNothing().returning()`. Один round-trip, дубликаты обрабатываются на уровне БД.

- **P1-04 — Статусы участников на английском** (`apps/web/src/app/(dashboard)/campaigns/[id]/page.tsx`)
  - Таблица отображала `active`, `bounced`, `completed` вместо «Активен», «Отскок», «Завершён».
  - Fix: добавлен `ENR_LABELS` с русскими переводами всех статусов.

### Верификация

- TypeScript: `tsc --noEmit` — 0 ошибок: `apps/api`, `apps/workers`, `apps/web`
- Тесты: 26/26 ✅
- Оба воркфлоу healthy: API (3001) + Web (5000)

---

## QA Audit — Pre-Sprint 1.6 Bug Fixes (2026-07-20)

Full audit of the codebase after Sprint 1.5. Found and fixed 6 bugs (2 P0, 4 P1).

### P0 — Blocking fixes

- **BUG-01 — Sequence creation always failed** (`apps/api/src/routes/sequences.ts`)
  - `CreateSequenceSchema.steps` required `min(1)`, but the UI sends `steps: []` when creating a new empty sequence, causing a 400 on every creation attempt.
  - Fix: relaxed to `min(0)` — steps are filled in the sequence editor after creation.

- **BUG-02 — Missing workspace filter on DML** (`apps/api/src/routes/campaigns.ts`, `sequences.ts`)
  - `PATCH`/`DELETE`/`start`/`pause`/`stop` routes verified ownership via `findFirst` but the actual `UPDATE`/`DELETE` SQL used only `eq(id)` without `eq(workspaceId)`. Any authenticated user knowing a resource ID could mutate another workspace's data.
  - Fix: added `eq(workspaceId, request.workspaceId)` to every DML `WHERE` clause.

### P1 — Logic errors

- **BUG-03 — Soft-deleted companies could be PATCH'd** (`apps/api/src/routes/companies.ts`)
  - `PATCH /api/companies/:id` UPDATE query lacked `isNull(deletedAt)`, allowing updates to soft-deleted records.
  - Fix: added `isNull(companies.deletedAt)` to the UPDATE WHERE clause.

- **BUG-04 — Email worker used wrong account for follow-up steps** (`apps/workers/src/email/email.worker.ts`, `packages/queue/src/jobs.ts`)
  - `scheduleNextStep()` always picked the first active email account instead of the account that sent step 1. Multi-account workspaces would send follow-up emails from a different sender, breaking deliverability.
  - Fix: added `emailAccountId?: string` to `ScheduleSequenceStepPayload`; original account is now propagated through every `scheduleNextStep` call. Falls back to first-active only when no account ID is known.

- **BUG-05 — Contact search ignored email and phone** (`apps/api/src/routes/contacts.ts`)
  - `GET /api/contacts?search=` only matched `fullName` via ILIKE. Searching a contact by email address returned zero results.
  - Fix: expanded to `OR(ilike(fullName), ilike(email), ilike(phone))`.

- **BUG-06 — Campaign stats (enrolled/sent) never updated** (`apps/api/src/routes/campaigns.ts`)
  - `campaigns.stats` JSONB initialised as all zeros and never mutated. The enroll route only touched `updatedAt`.
  - Fix: `POST /api/campaigns/:id/enroll` now atomically increments `stats.enrolled` via `jsonb_set`.

### Verification

- TypeScript: `tsc --noEmit` passes for `apps/api`, `apps/workers`, `apps/web`
- Tests: 26/26 passing (campaigns + sequences test suites)
- Both workflows healthy: API (port 3001) + Web (port 5000)

---

## Demo Polish Audit — First-User UX Fixes (2026-07-20)

### Navigation & Layout
- **Sidebar** (`sidebar.tsx`) — `'Dashboard'` label renamed to `'Дашборд'` (was the only remaining English nav item).
- **Header** (`header.tsx`) — Left side was `<div />` (empty). Now shows the current page name as a breadcrumb label using `usePathname()` — e.g. "Компании", "Кампании", "Настройки". Right side unchanged (Выйти button).

### Dashboard (`dashboard/page.tsx`) — Full rewrite
- Removed static "Начните с импорта..." box that always rendered regardless of workspace data.
- Added **smart onboarding guide** (3-step checklist: Add email account → Import companies → Create campaign) visible only when `totalCompanies === 0`.
- Added **"next step" hint** banner (link to /campaigns) visible when companies exist but no emails have been sent yet (`emailsSent30d === 0`).
- Fixed `"Reply rate: X%"` subtitle → `"Конверсия: X%"` (Russian).
- Fixed `"Готовы к outreach"` → `"Готовы к рассылке"`.
- Added per-card loading skeletons (pulsing placeholder block during API load).

### Companies page (`companies/page.tsx`)
- **Loading state** — replaced plain `"Загрузка..."` centered text with 6 skeleton table rows that match the real column structure (company name/subtitle, city, industry, source badge, status badge, ICP, data columns).
- **Subtitle loading state** — replaced `'Загрузка...'` string with an animated inline skeleton pill.
- **ICP filter labels** — translated English labels: `"Reject"` → `"Не в ICP"`, `"Qualified"` → `"Квалифицирован"`, `"High"` → `"Высокий"`.
- **IcpScoreBadge colors** — updated from light-mode-only `-600` variants (`emerald-600`, `blue-600`, `amber-600`) to dark-compatible `-400` variants for contrast on dark backgrounds.

### Company detail page (`companies/[id]/page.tsx`)
- **Loading state** — replaced `"Загрузка..."` plain text with a full skeleton matching the two-column layout (back link, header, ICP panel, details panel, tab area with contact cards).

### Campaigns page (`campaigns/page.tsx`)
- **Loading skeleton** — replaced empty `h-40 animate-pulse` blocks with structured card skeletons showing title, status badge, action buttons, stat grid, and metadata rows.
- **Action button hover colors** — `hover:bg-emerald-50` → `hover:bg-emerald-900/20`, `hover:bg-yellow-50` → `hover:bg-yellow-900/20`; text colors `text-emerald-600`/`text-yellow-600` → `text-emerald-400`/`text-yellow-400`.

### Settings page (`settings/page.tsx`)
- **Loading skeleton** — replaced empty `h-24` blocks with structured skeletons matching actual email account cards (avatar circle, name/email/status lines, action buttons).
- **"Включить" button hover** — `hover:bg-emerald-50` → `hover:bg-emerald-900/20`, `text-emerald-600` → `text-emerald-400`.

### Analytics page (`analytics/page.tsx`)
- `"Готовы к outreach"` → `"Готовы к рассылке"`.
- `"Reply rate: X%"` subtitle → `"Конверсия: X%"`.

### Auth pages
- **Login** (`(auth)/login/page.tsx`) — Added Zap icon + wordmark inline header matching sidebar brand identity.
- **Register** (`(auth)/register/page.tsx`) — Same brand header treatment.

### CI
- Typecheck ✅ (0 errors), lint ✅ (0 warnings), all changes compile cleanly.

---

## QA Audit — UI Polish & Bug Fixes (2026-07-20)

### New Files
- **`apps/web/src/components/ui/confirm-dialog.tsx`** — Reusable modal dialog component replacing all native `confirm()` calls.
- **`apps/web/src/app/(dashboard)/loading.tsx`** — Dashboard-level loading boundary (spinner + text).
- **`apps/web/src/app/(dashboard)/error.tsx`** — Dashboard-level React error boundary with reset button.
- **`apps/web/src/app/error.tsx`** — Root-level global error boundary.

### Pages — Rewrites
- **`/contacts`** — Replaced "Раздел в разработке" stub with a fully functional contacts table. Features: search by name (debounced 300ms), avatar initials, seniority badge, email/phone links, company link, pagination (25/page), loading skeletons, empty state with CTA.
- **`/analytics`** — Replaced stub with real analytics page using `api.workspace.stats()`. Features: 4 KPI metric cards, conversion funnel bar chart, reply rate gauge, 6 "Coming soon" report cards.

### Bug Fixes
- **Status badge colors** (`companies/page.tsx`, `campaigns/page.tsx`) — Replaced light Tailwind color classes (`bg-slate-100 text-slate-700` etc.) with dark-compatible variants (`bg-slate-700/50 text-slate-300` etc.) that are visible on the dark background.
- **`confirm()` dialogs** (5 locations) — Replaced all native browser `confirm()` calls with `ConfirmDialog` component:
  - `campaigns/page.tsx` — Stop campaign
  - `campaigns/[id]/page.tsx` — Stop campaign + Delete sequence (2 separate confirms)
  - `companies/[id]/page.tsx` — Delete company
  - `settings/page.tsx` — Delete email account
- **Delete button colors** (`companies/[id]/page.tsx`) — Replaced light red (`border-red-200 hover:bg-red-50 text-red-600`) with dark-compatible (`border-red-900/50 hover:bg-red-900/20 text-red-400`).
- **Dashboard title** (`dashboard/page.tsx`) — Changed `<h1>` from "Dashboard" (English) to "Дашборд" (Russian).
- **Database migration** — Applied pending migrations (`pnpm db:migrate`) for fresh Replit environment; resolved `relation "users" does not exist` error that caused 500s on auth endpoints.

### QA Results
- `pnpm typecheck` — ✅ 0 errors (web + api)
- `pnpm lint` — ✅ 9/9 tasks passed
- `pnpm build` (web) — ✅ All 13 routes built clean
- `pnpm test` — ✅ 26/26 tests passed (2 test files)

---

## Post-Sprint 1.4 QA & Audit (2026-07-19)

### Bug Fixes
- **Register form** — `workspaceName` field was collected from the user but silently dropped before the Better Auth `signUp.email()` call. Added `workspaceName` to `user.additionalFields` in `apps/api/src/plugins/auth.ts` and passed it from `register-form.tsx`. Workspace is now named with the value entered by the user directly (removed the `"name's Workspace"` suffix pattern).
- **`next.config.ts`** — `127.0.0.1` was missing from `allowedDevOrigins`, causing HMR WebSocket failures when accessing the app through the local IP (screenshot tooling, Replit preview iframe).

### Audit Findings (no code changes — tracked as future work)
Full audit documented in `AI_HANDOFF.md`. Summary of critical items:

| ID | Severity | Issue |
|----|----------|-------|
| BUG-001 | HIGH | `ZodError` not caught by Fastify error handler → all validation failures return 500 with stack trace instead of 400 |
| BUG-002 | HIGH UX | Dashboard StatCards hardcoded to `"0"` — no API calls, real data never shown |
| BUG-003 | MEDIUM perf | `POST /api/companies/import` runs N+1 queries (findFirst in loop for INN/domain dedup) |
| BUG-004 | MEDIUM sec | No rate limiting on any endpoint, including auth |
| TD-001 | MEDIUM | `campaigns`, `sequences`, `tasks`, `email_accounts` have no soft-delete (`deletedAt`) |
| TD-002 | MEDIUM perf | Missing indexes on `sequences.campaign_id`, `sequence_enrollments.sequence_id`, `email_sends.contact_id` |
| TD-003 | LOW | ICP scoring logic duplicated in `apps/api` and `apps/workers` |

### Pages verified (manual QA)
- `/login`, `/register` — ✅ working
- `/dashboard` — ✅ renders, stats hardcoded to 0
- `/companies` — ✅ fully functional with real data
- `/companies/:id` — ✅ fully functional (contacts, timeline, ICP, enrich)
- `/campaigns` — ✅ fully functional with real data
- `/settings` — ✅ email accounts CRUD, encryption working
- `/contacts` — ❌ stub ("Раздел в разработке")
- `/analytics` — ❌ stub ("Раздел в разработке")

---

## Sprint 1.4 — Email Sequences & Outreach Automation (2026-07-19)

### New Features
- **Campaigns API** — Full CRUD + lifecycle (`/api/campaigns`): `draft → active → paused → active → completed → archived`. Includes enrollment endpoint (`POST /api/campaigns/:id/enroll`) that deduplicates by unique constraint. Stats JSONB field tracks enrolled/sent/opened/clicked/replied/meetings.
- **Sequences API** — Multi-step email sequence builder (`/api/sequences`). Steps stored as JSONB with `email` and `wait` types. Step-number uniqueness validated on create and update. Sequences are scoped to a campaign.
- **Email accounts API** — SMTP/Mailgun/Brevo/SES account management (`/api/email-accounts`). AES-256-GCM credential encryption at rest. Credentials never returned in GET responses.
- **Email sending worker** — `apps/workers/src/email/email.worker.ts`. Processes `SEND_EMAIL` and `SCHEDULE_SEQUENCE_STEP` jobs. Redis INCR counter enforces daily send limits atomically (RISK-001). Schedules next sequence step with BullMQ delay. Marks enrollment completed/stopped/bounced on terminal events.
- **Mailgun webhook handler** — `POST /api/webhooks/mailgun`. Validates provider signature. Updates `email_sends` on delivered/opened/clicked/bounced/complained/unsubscribed events. Hard bounce marks company as `opted_out` and enrollment as `bounced`.
- **Campaigns UI** — `/campaigns` page with status filter tabs (All/Active/Draft/Paused/Completed), campaign cards with stats grid, action buttons (start/pause/stop), and "Новая кампания" creation modal.
- **API client extended** — `apps/web/src/lib/api-client.ts` now covers `campaigns`, `sequences`, and `emailAccounts` namespaces with full TypeScript types.
- **Outreach DB schema** — `packages/db/src/schema/outreach.ts`: `campaigns`, `sequences`, `sequence_enrollments`, `email_sends`, `email_accounts` tables with enums. Indexes for workspace isolation, status filtering, and provider event lookup. Schema included in initial migration.

### Code Quality Fixes (Sprint 1.4 review)
- **`campaigns.ts`**: Replaced dynamic `await import('drizzle-orm')` for `inArray` with a static top-level import.
- **`sequences.ts`**: Removed `Record<string, unknown>` type cast in PATCH route; replaced with a properly-typed Drizzle spread object.
- **`webhooks.ts`**: Typed the `updates` accumulator as `Partial<EmailSend>` (imported from `@ai-sales-os/db`) instead of `Record<string, unknown>`, eliminating the unsafe `as Parameters<...>[0]` cast.

### Testing
- **API test infrastructure** — Added `vitest` to `apps/api`, `apps/api/vitest.config.ts`, and `apps/api/tests/helpers.ts` (shared Fastify test app with production-matching error handler).
- **`campaigns.test.ts`** — 17 tests covering campaign lifecycle state machine: start/pause/stop/delete/patch/enroll validation. Guards against invalid state transitions (e.g. start completed, pause non-active, delete active).
- **`sequences.test.ts`** — 9 tests covering sequence creation and update: step-number uniqueness, campaign ownership validation, CRUD.
- All 26 API tests pass.

### Internal
- All TypeScript strict checks pass — zero errors across all apps and packages
- ESLint zero warnings across all apps
- All 10 build tasks pass (packages + apps)

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
