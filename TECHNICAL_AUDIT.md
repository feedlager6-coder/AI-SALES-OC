# AI Sales OS — Technical Audit
*Generated: 2026-07-27*

---

## Executive Summary

AI Sales OS is a B2B sales intelligence and outreach automation platform targeting the Russian market. The codebase is architecturally sound — a clean pnpm monorepo with Fastify API, Next.js frontend, BullMQ workers, PostgreSQL + Drizzle ORM, and a plugin model for external providers. Authentication is stable. The database schema is comprehensive. Backend workers are largely implemented.

The gap between "built" and "shippable MVP" is narrower than it might appear. The main blockers are: **intent parsing is mocked on the frontend**, **message generation is mocked**, and the **workers process is not wired into the main deployment flow**. These are high-leverage, focused gaps — not architectural rewrites.

---

## 1. Completed ✅

### Infrastructure
- Monorepo (pnpm + Turborepo) with clean package boundaries
- PostgreSQL + Drizzle ORM: complete schema covering companies, contacts, deals, campaigns, sequences, email accounts, enrichment jobs, hunt sessions, audit logs, AI logs
- Redis + BullMQ queue system with 6 named queues, deterministic job IDs, retry/backoff policy
- Pino logger with dev/prod formatting
- Shared `AppError` hierarchy with HTTP codes
- Config package with Zod-validated env vars
- Railway deployment (API + Web services, green)
- Startup-time DB migrations (idempotent, works on Railway)

### Authentication & Multi-tenancy
- Better Auth + Drizzle adapter (registration, login, logout, session persistence)
- Workspace provisioning on registration
- `workspace-context` Fastify plugin — all routes are workspace-scoped
- Role-based access middleware (`require-role`)
- Protected routes via Next.js middleware
- CORS, trusted origins, cookie handling all correct

### API Routes (all workspace-scoped)
- `GET/PATCH /api/workspaces/me` — workspace info + settings
- `GET /api/workspaces/stats` — dashboard summary stats
- Full CRUD: `/api/companies`, `/api/contacts`, `/api/deals`
- `/api/companies/import` — batch CSV import
- Full CRUD: `/api/email-accounts`, `/api/campaigns`, `/api/sequences`
- `POST /api/sequences/:id/generate-preview` — AI personalized email preview (GPT-4o-mini, real)
- `POST /api/lead-sources/search` — enqueue scraping jobs
- `POST /api/v1/intent/parse` — rule-based NLP intent extraction
- `GET/POST /api/v1/hunts` + `POST /api/v1/hunts/:id/search` — Discover Flow V4
- `PATCH /api/v1/hunts/:id/rejection-feedback` — ICP tuning signal
- `POST /api/webhooks/mailgun` — email event tracking

### Frontend Pages (all real API integration except noted)
- `/dashboard` — onboarding steps, real stats
- `/companies` + `/companies/[id]` — full CRM with contacts, activities
- `/contacts` — global contact list
- `/campaigns` + `/campaigns/[id]` — outreach campaign management with sequences
- `/settings` — workspace + email account management
- `/login` + `/register` — auth forms
- `/discover` — hunt creation + search results (real API)

### Background Workers (all implemented)
- **Enrichment Worker**: company enrichment via Dadata/EGRUL (INN, revenue, employee count)
- **Scraping Worker**: 2GIS and HH.ru lead ingestion with ICP scoring + DB upsert
- **Contact Discovery Worker**: waterfall pipeline (Dadata → Hunter → Snov → Pattern → Generic)
- **Email Worker**: sequence orchestration, daily limits, AI personalization, Mailgun sending
- **AI Worker**: GPT-4o-mini email generation + reply classification

### Search / Discover Layer
- `SearchOrchestratorImpl` — multi-provider merge, dedup (INN → domain → id), rank
- `V4RankingEngine` — rule-based, 8 criteria, score stripped before API response
- 2GIS provider: full implementation (types, config, rate limiter, retry policy, mapper)
- Mock provider: 12 Russian B2B companies, 400ms delay, intent filtering
- Plugin registry pattern — zero-change provider additions

### Plugin Architecture
- Dadata plugin (company enrichment + contact director lookup)
- Hunter.io plugin (email finding)
- Snov.io plugin (email finding)
- Mailgun plugin (email sending)
- Circuit breaker pattern on providers

---

## 2. Partially Implemented ⚠️

### Intent Parsing — Frontend Still Uses Mock
**What exists:** The API has a working `POST /api/v1/intent/parse` route with a `RuleBasedIntentParser`. It is complete and available.

**What's broken:** `apps/web/src/lib/intent/intent-api.ts` calls `parseIntentMock` (a keyword-based frontend function) instead of calling the real API endpoint. There is a TODO comment in the code.

**Impact:** The Discover flow works end-to-end, but intent parsing quality is limited by the frontend mock instead of the server-side rule engine.

### Message Generation — Fully Mocked on Frontend
**What exists:** `apps/api/src/services/ai-preview.ts` generates personalized emails via GPT-4o-mini and is called by `POST /api/sequences/:id/generate-preview`. The AI Worker also generates emails via `generate_email` jobs. These are both real and working.

**What's broken:** `apps/web/src/components/draft/draft-message-screen.tsx` uses `mockMessageGenerator` (template-based, hardcoded). Generated draft messages are **not persisted** to the backend (explicit TODO on line 42).

**Impact:** The "send message" outreach flow is disconnected. Users see fake generated messages and can't save/send them.

### Website Contact Extraction — Stub
**What exists:** `apps/api/src/contact-discovery/steps/website-step.ts` (Pass 3 of the waterfall) exists as a file.

**What's broken:** It returns an empty array. Playwright/OpenAI scraping is noted as "Pass 5" and unimplemented.

**Impact:** Contact discovery falls back to Hunter/Snov only. For companies with public websites listing contacts, discovery yield is lower.

### Analytics — Partial "Coming Soon" Blocks
**What exists:** `/analytics` page has real API integration for summary metrics.

**What's broken:** Detailed report sections (conversion funnel visualization, line 237+) are "Coming Soon" placeholders.

**Impact:** Analytics is presentable at the top level but shallow on drill-down.

### Sender Profile — Local Storage Only
**What exists:** `/sender-profile` page is complete UI-wise.

**What's broken:** Uses `LocalStorageRepository` — not persisted to the backend. Clears on new browser/device.

**Impact:** Users lose their configured "voice" when switching devices or clearing storage.

### Workers — Not Running in Current Deployment
**What exists:** `apps/workers` is fully implemented and ready.

**What's broken:** No workflow is configured for the workers process in the Replit environment. Railway may or may not have a workers service deployed.

**Impact:** Enrichment, scraping background jobs, contact discovery, and email sequences won't execute even if triggered.

---

## 3. Missing for MVP 🚫

These are the gaps between the current codebase and a usable first release:

### M1. Wire Frontend Intent Parsing to the Real API
**Effort:** ~1 hour
**What:** Replace `parseIntentMock` in `apps/web/src/lib/intent/intent-api.ts` with a real `POST /api/v1/intent/parse` call. The backend route exists and works.

### M2. Wire Draft Message Generation to the Real AI API
**Effort:** ~3 hours
**What:** Replace `mockMessageGenerator` with a call to `POST /api/sequences/:id/generate-preview`. Add backend persistence endpoint for saving drafts. Connect save action to API.

### M3. Workers Service Running in Production
**Effort:** ~2 hours
**What:** Confirm a workers Railway service exists and is running. If not, create it (Railway config already present in `railway.toml`). Without this, no background jobs execute.

### M4. Sender Profile Backend Persistence
**Effort:** ~2 hours
**What:** Add `sender_profiles` table to schema, migrate, add API route, swap `LocalStorageRepository` for API calls.

### M5. End-to-End "Discover → Enrich → Draft → Send" Flow Verification
**Effort:** ~1 day testing + fixes
**What:** Manually walk the full user journey with real data. The individual pieces exist but have never been verified as a connected flow. Fix any integration seams discovered.

### M6. Error States and Empty States in Key Pages
**Effort:** ~half day
**What:** Several pages assume happy-path data. Need proper empty states for: no companies, no campaigns, search returning zero results, API errors.

---

## 4. Technical Debt 🔧

*Worth doing — but should NOT block MVP:*

### TD1. Frontend Uses No Shared Component Library
The app manually replicates atomic patterns (buttons, inputs, cards) across pages without a formal component library. Shadcn/UI or Radix primitives would reduce duplication. The `components/ui/` folder contains only `confirm-dialog.tsx`.

### TD2. API Key Management is Env-Var Only
External API keys (Hunter, Snov, Dadata, etc.) are all process-level env vars. The DB has an `api_keys` table suggesting per-workspace key management was planned but not implemented. This limits multi-tenancy.

### TD3. No Automated Tests
Zero test files across the entire codebase. Critical paths (search orchestration, contact discovery waterfall, sequence scheduling) have no regression coverage. This will slow down future development.

### TD4. Search Plan Builder is Placeholder
`apps/api/src/search/search-plan-builder.ts` contains placeholder summaries. Not user-visible yet, but referenced in the orchestration layer.

### TD5. `notification-queue` Has No Worker
The queue is defined in `packages/queue/` but no worker processes it. Notification features are silently dropped.

### TD6. MinIO / S3 Storage Not Used
`MINIO_*` env vars are in config but no code actually writes to storage yet. Either wire it up or remove from config to avoid confusion.

### TD7. `activities` Table is Under-Used
The schema has a rich `activities` table (calls, emails, meetings). The API partially writes to it but the frontend doesn't display a proper activity timeline.

---

## 5. Risks ⚡

### R1. Russian Market API Dependency Concentration
The entire data layer depends on 2GIS, Dadata, HH.ru, Hunter, and Snov. All are single points of failure. If 2GIS rate-limits or changes their API, company discovery stops. Mitigation: the plugin registry model makes adding providers easy — but alternative providers need to be sourced.

### R2. Sequence Email Sending Has No Deliverability Infrastructure
The email worker sends through Mailgun but there's no bounce handling, unsubscribe link injection, spam score checking, or domain warm-up logic. This is a serious risk for production email sending — ISPs will block bulk cold outreach very quickly.

### R3. OpenAI Dependency Without Fallback
Email generation, reply classification, and (future) enrichment all hit OpenAI directly. There's an `ANTHROPIC_API_KEY` in config but no Anthropic integration in code. A single provider with no fallback is a reliability risk for core workflows.

### R4. No Rate Limiting on Worker Job Enqueueing
`POST /api/lead-sources/search` enqueues scraping jobs without throttling. A user could trigger hundreds of concurrent 2GIS/HH.ru searches and hit external API limits or incur unexpected costs.

### R5. ICP Score Never Recalculated After Enrichment
The `recalculate_icp_score` job type is defined in the queue package but the enrichment worker doesn't appear to enqueue it after completing enrichment. Companies get an initial score but it doesn't update as data improves.

### R6. Session Secret in Single-Service Config
`BETTER_AUTH_SECRET` is shared between the API and potentially readable by Next.js. If the web service is compromised, the auth secret is exposed. Consider service-level isolation in production.

---

## 6. Roadmap Ideas Evaluation

These are the future ideas from the brief — evaluated for business value, complexity, and recommended phase.

| Idea | Business Value | Complexity | Competitive Edge | Recommended Phase | Architecture Notes |
|------|---------------|------------|-----------------|-------------------|-------------------|
| **Website Discovery Engine** | High — fills gaps where 2GIS has no data | Medium | Medium | **V2** | Playwright is already referenced in contact-discovery code. Build on existing plugin model. |
| **Universal Search** | Very High — key differentiator | High | High | **V2** | Requires headless browser infrastructure (Playwright cluster). Don't add to MVP. |
| **AI Site Reader** | High — enables richer profiles | Medium | High | **V2** | Depends on Website Discovery. Reuse `ai-preview.ts` pattern. |
| **Multi-source Intelligence** | Medium — improves data quality | Medium | Medium | **V2** | Plugin registry already designed for this. Implement as `merge-step` in enrichment pipeline. |
| **Trust Score** | Medium — nice UX feature | Low | Low | **V2** | Straightforward: add `confidenceScore` field per fact, computed during merge. Low risk to add early. |
| **Site Monitoring** | High — drives retention / recurring usage | High | High | **V3** | Needs scheduled jobs, change detection, notification system. Build on BullMQ delayed jobs. |
| **Company Timeline** | Medium — good for sales context | Medium | Medium | **V3** | Requires historical snapshot storage. MinIO already in config — could store snapshots there. |
| **Search Everywhere** | Very High — moat feature | Very High | Very High | **V3** | The ultimate vision. Requires crawler infra, proxy rotation, structured extraction at scale. |

**Architecture note for today:** The plugin registry (`ProviderRegistry`) is already designed to accommodate all of these. No architectural changes needed to support V2/V3 — just add providers. The one thing worth deciding now: whether `signals` (JSONB on the `companies` table) is the right storage for trust scores and multi-source facts. It likely is — JSONB with a typed interface is flexible enough without a schema migration per new signal type.

---

## 7. Recommended Next Milestone

**The single highest-value next milestone for MVP is:**

### 🎯 M2 — Close the Discover → Draft → Send Loop

**Why this one:** Every other feature (companies, campaigns, analytics) works end-to-end. The one flow that defines the product's value proposition — "find a company, generate a personalized message, send it" — is broken at the draft step. The AI generation exists on the backend. The send infrastructure exists. Only the wiring is missing.

**Scope (2–3 days of focused work):**
1. Wire `parseIntentMock` to the real API (M1) — 1 hour
2. Connect `DraftMessageScreen` to `POST /api/sequences/:id/generate-preview` — 2 hours
3. Add draft persistence (save generated message to sequence step or a new `drafts` table) — 3 hours
4. Verify workers service is running on Railway — 1 hour
5. Walk the full flow: Discover → select company → generate draft → save → campaign sends it — 1 day

After this milestone, AI Sales OS is demonstrable end-to-end to early users.

---

*Audit produced by automated codebase analysis + prior session context. Authentication, search, and CRM are the stable foundation. The path to MVP is focused, not broad.*
