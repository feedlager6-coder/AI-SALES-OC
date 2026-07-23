# AI Sales OS — Search Engine V4: Implementation Plan

---

## ⚠️ IMPLEMENTATION PROTOCOL — ОБЯЗАТЕЛЬНО К ИСПОЛНЕНИЮ

> Этот раздел читается первым. Каждым агентом. Перед каждым проходом.

### Роль

Ты **НЕ** архитектор проекта. Ты инженер-реализатор.
Архитектура Search Engine V4 утверждена. Запрещено менять её без явного разрешения пользователя.

### Перед ЛЮБЫМИ изменениями — обязательный анализ

Прежде чем писать первую строку кода, выполни анализ и выведи отчёт:

1. Найди существующие интерфейсы, типы, абстракции
2. Найди зависимости между модулями
3. Найди все места, где используются изменяемые классы
4. Найди все импорты затрагиваемых файлов
5. Оцени побочные эффекты

**Отчёт перед реализацией:**
- Что уже существует и будет переиспользовано
- Какие файлы будут изменены
- Какие новые файлы будут созданы
- Какие зависимости будут затронуты

Только после этого начинай реализацию.

### Главные правила

- **НЕ удалять** существующий код, если это не требует спецификация
- **НЕ переименовывать** классы, интерфейсы, типы, DTO, сервисы, маршруты, таблицы БД — если этого прямо нет в плане V4
- **Перед созданием нового файла** проверь: есть ли уже похожий файл / сервис / интерфейс / тип? Если есть — расширяй, не дублируй
- **Запрещено использовать:** `any`, временные костыли, `TODO`, `FIXME`, заглушки вместо рабочей реализации — если это не указано в плане явно

### После завершения каждого прохода

Обязательно в таком порядке:

1. Запусти проверку типов — `pnpm tsc --noEmit` в затронутых пакетах
2. Исправь все ошибки TypeScript до нуля
3. Проверь импорты (нет broken imports)
4. Проверь сборку — `pnpm turbo run build --filter='./packages/*'`
5. Проверь, что оба workflow запускаются
6. Проверь отсутствие дублирования кода

### Обновление этого файла — ОБЯЗАТЕЛЬНО

После каждого прохода обнови раздел статуса прохода:

```
❌ NOT STARTED  →  🟡 IN PROGRESS  →  ✅ DONE
```

Заполни поле "Completion note" с:
- Дата завершения
- Какие файлы изменены / созданы / удалены
- Что реализовано
- Какие проблемы возникли и как решены
- Какие проблемы остались открытыми
- Что должен делать следующий агент

**Никогда не пропускай обновление этого файла.**

### Минимальный объём изменений (Pass 2 и далее)

Перед изменением любого существующего сервиса, класса или файла — определи минимальный объём изменений.

**Запрещается переписывать существующий модуль полностью**, если можно:
- расширить его
- внедрить новый сервис через интерфейс
- заменить одну зависимость через DI
- добавить новую стратегию
- добавить новый обработчик

**При изменении существующего файла сохрани:**
- публичный API
- экспортируемые типы
- интерфейсы
- сигнатуры методов
- существующее поведение, если оно не противоречит спецификации V4

**Перед началом изменения каждого файла выведи краткое обоснование:**
1. Почему требуется изменение именно этого файла
2. Почему нельзя реализовать функциональность без его переписывания
3. Какие публичные контракты сохраняются

> **Правило 30%:** Если изменение затрагивает более 30% существующего файла — остановись и запроси подтверждение пользователя перед продолжением.

---

### Архитектурные проблемы

Если обнаружишь архитектурную проблему — **НЕ исправляй самостоятельно**.
Запиши в раздел `## Known Issues` в конце файла и остановись.

### Работа только по одному проходу

Выполняй только один проход. Не переходи к следующему самостоятельно.
После завершения выведи финальный отчёт и жди указаний.

### Финальный отчёт после каждого прохода

```
PASS X COMPLETED
Изменено файлов: …
Создано файлов: …
Удалено файлов: …
Ошибок TypeScript: 0
Build: SUCCESS
AI_IMPLEMENTATION_PLAN.md обновлен: ДА
Следующий рекомендуемый проход: Pass X+1
```

---

## How to use this file

1. Найди первый проход со статусом `❌ NOT STARTED` или `🟡 IN PROGRESS`
2. Прочитай полное описание прохода — файлы для изменения, создания, компоненты для переиспользования
3. Выполни обязательный анализ (см. протокол выше) и выведи отчёт
4. Реализуй весь проход в одной сессии (он спроектирован как логически завершённый)
5. Убедись, что TypeScript компилируется без ошибок и оба workflow запускаются
6. Обнови статус прохода в этом файле
7. Выведи финальный отчёт и остановись

---

## Current Status

| Pass | Name | Status |
|------|------|--------|
| 1 | Type System + DB Schema | `✅ DONE` |
| 2 | Search Orchestration V4 | `❌ NOT STARTED` |
| 3 | Contact Discovery V4 | `❌ NOT STARTED` |
| 4 | Госзакупки + ФССП + LLM Intent | `❌ NOT STARTED` |
| 5 | AI Context Builder + Frontend V4 | `❌ NOT STARTED` |

---

## Architecture Constraints (read before every pass)

- **Entity is `Company`, not `Lead`** — DB table, types, and UI all use `Company`
- **No frontend leakage** — API keys, providers, and ranking are 100% server-side
- **Relative URLs only** — frontend never calls `localhost:3001` directly; uses Next.js rewrites via `/api/*`
- **`workspace_id` on everything** — all queries must be scoped to workspace; RLS enforced
- **No `any` type** — TypeScript strict mode, `any` is banned
- **Pino for logging** — use `createLogger` from `packages/logger`, never `console.log` in server code
- **Soft deletes** — `deleted_at` on all DB entities
- **Redis INCR for counters** — not DB columns (see RISK-001 in AI_HANDOFF.md)
- **`RankingEngine` interface does not change** — only the implementation (`DefaultRankingEngine` → `V4RankingEngine`)
- **`IntentParser` interface does not change** — add `LLMIntentParser` as new implementation, `RuleBasedIntentParser` as fallback
- **Do not restructure the monorepo** — keep `apps/`, `packages/`, `verticals/` layout

---

## Pass 1 — Type System + DB Schema

**Status:** `✅ DONE — 2026-07-23`

**Completion note:**
- **Изменены:** `packages/db/src/schema/companies.ts` (+4 колонки: signals, contacts, fieldProvenance, aliases), `packages/db/src/schema/hunts.ts` (+2 колонки: searchPlanSummary, rejectionFeedback), `apps/api/src/search/types.ts` (полный V4 type system), `apps/api/src/search/providers/mock/mock-data.ts` (5 тегов `'contract'` → `'contract_won'`/`'contract_active'`), `packages/db/src/migrations/meta/_journal.json` (добавлена запись 0005)
- **Создан:** `packages/db/src/migrations/0005_search_v4_types.sql`
- **Реализовано:** Все V4 типы (`Signal`, `SignalType` с 14 вариантами, `ContactCandidate`, `FieldProvenance`, `RankedCompany`, `SearchPlan`, `SearchPlanSummary`, `SearchResultV4`, `CompanyBrief`, `RejectionFeedback`, `ParsedIntent`, `WorkspaceStatus`, константы `SIGNAL_WEIGHTS`, `SOURCE_CONFIDENCE`). Миграция `0005` применена к БД. Drizzle-типы `Company` и `Hunt` автоматически расширились через `$inferSelect`.
- **Проблемы, решённые в процессе:** `SearchResult.companies` не менялся на `RankedCompany[]` — вместо этого добавлен `SearchResultV4`. Переход в Pass 2. Старый `'contract'` в mock-data заменён на `'contract_won'`/`'contract_active'`.
- **Открытых проблем нет.**
- **Следующий агент:** Начинай Pass 2. Зависимость выполнена. Используй `SearchResultV4` как возвращаемый тип оркестратора. `RankedCompany` — финальный тип результатов. `SearchCompany` и `SearchResult` оставь без изменений до окончания Pass 2.

### Goal
Lay the foundation that every other pass depends on. Pure types and schema — no business logic.

### Dependency
None. This is the first pass.

### New files to create

#### `packages/db/src/schema/companies-v4-fields.ts`
Extend the `companies` table with V4 fields. Add these columns:
- `ogrn varchar(15)` — ОГРН (13 digits for ООО, 15 for ИП)
- `aliases jsonb` — `string[]` — alternative names (from dedup merges)
- `workspace_status varchar(32)` — `'new' | 'contacted' | 'in_pipeline' | 'closed'` — default `'new'`
- `field_provenance jsonb` — `FieldProvenance` — which source provided each field
- `signals jsonb` — `Signal[]` — full V4 signal array (see type below)
- `contacts jsonb` — `ContactCandidate[]` — contact waterfall results
- Add index on `(workspace_id, inn)` for CompanyRegistry lookups

#### `packages/db/src/schema/hunts-v4-fields.ts`
Extend the `hunts` table:
- `search_plan_summary jsonb` — `SearchPlanSummary` — which sources were queried and their status
- `rejection_feedback jsonb` — `RejectionFeedback[]` — user feedback per company

#### `packages/db/src/migrations/0004_search_v4_types.sql`
SQL migration for all new columns. Add to `_journal.json` entry so `db:migrate` picks it up.

#### Update `packages/db/src/index.ts`
Export the new schema additions.

### Files to modify

#### `apps/api/src/search/types.ts`
Complete rewrite of types to V4. Keep existing exported names that routes use (`SearchResult`, `SearchCompany`), but expand them. Add:

```typescript
// Signal domain model
type SignalType =
  | 'hiring'
  | 'hiring_role_match'
  | 'contract_won'
  | 'contract_active'
  | 'expanding'
  | 'growing'
  | 'leadership_change'
  | 'new_business'
  | 'funding'
  | 'news_event'
  | 'client_fit'
  // Negative signals
  | 'financial_risk'
  | 'leadership_instability'
  | 'activity_decline'

type SignalSource = 'hhru' | '2gis' | 'gosreg' | 'dadata' | 'website' | 'news' | 'fssp' | 'kontur'

interface Signal {
  type: SignalType
  label: string               // Human-readable: "Наняли 3 водителя на этой неделе"
  source: SignalSource
  eventDate: Date | null      // When the event happened (not when we detected it)
  detectedAt: Date
  weight: number              // 0–100
  confidence: number          // 0–100
  metadata: Record<string, unknown> | null
}

// Signal weights by type (use these constants, don't hardcode)
const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  hiring: 70,
  hiring_role_match: 85,
  contract_won: 80,
  contract_active: 60,
  expanding: 75,
  growing: 50,
  leadership_change: 65,
  new_business: 45,
  funding: 90,
  news_event: 40,
  client_fit: 70,
  financial_risk: 80,      // negative — reduces icpScore
  leadership_instability: 65,
  activity_decline: 55,
}

// Confidence by source
const SOURCE_CONFIDENCE: Record<SignalSource, number> = {
  dadata: 95,
  gosreg: 95,
  hhru: 85,
  '2gis': 70,
  kontur: 90,
  website: 60,
  news: 50,
  fssp: 95,
}

// Contact discovery
interface ContactCandidate {
  name: string | null
  role: string | null
  email: string
  emailVerified: boolean
  phone: string | null
  source: string              // 'dadata' | 'website' | 'hhru' | 'hunter' | 'snov' | 'pattern' | 'generic'
  confidence: number          // 0–100 (see confidence table in spec section 10)
}

// Field-level provenance
interface FieldProvenance {
  legalName?: string
  tradeName?: string
  inn?: string
  phone?: string
  website?: string
  email?: string
  description?: string
  size?: string
  // Each value is the source name: 'dadata' | '2gis' | 'hhru' | 'hunter' | 'website'
}

// Ranked company (what routes return)
interface RankedCompany extends SearchCompany {
  icpScore: number
  timingScore: number
  finalScore: number
  signals: Signal[]
  contacts: ContactCandidate[]
  sources: FieldProvenance
  brief?: CompanyBrief             // only if AI Context was requested
  existsInWorkspace: boolean
  workspaceStatus: 'new' | 'contacted' | 'in_pipeline' | 'closed'
}

// Search plan
interface ProviderPlanEntry {
  providerId: string
  tier: 1 | 2 | 3
  query: Record<string, unknown>
}

interface SearchPlan {
  tier1: ProviderPlanEntry[]
  tier2: ProviderPlanEntry[]
  tier3: ProviderPlanEntry[]     // async, after response
}

interface SearchPlanSummary {
  providersQueried: string[]
  providersSucceeded: string[]
  providersFailed: string[]
  totalRaw: number
  afterDedup: number
  afterFilter: number
  processingMs: number
}

// Company brief for AI email generation
interface CompanyBrief {
  company: {
    name: string
    legalName: string | null
    industry: string
    region: string
    size: string | null
    description: string
    website: string | null
    foundedYear: number | null
  }
  contact: {
    name: string | null
    role: string | null
    email: string
    confidence: number
  }
  whyThisCompany: string[]       // concrete facts, not templates
  triggerEvent: {
    type: SignalType
    label: string
    eventDate: Date | null
    weight: number
  } | null
  financialContext: {
    revenueGrowthPct: number | null
    riskScore: number | null
    lastReportYear: number | null
  } | null
  industryContext: {
    currentTrends: string[]
    seasonality: string | null
  } | null
  senderContext: {
    productDescription: string
    targetRole: string
    usp: string
    previousWins: string[]
  }
  previousContact: {
    contacted: boolean
    lastDate: Date | null
    outcome: 'no_reply' | 'replied' | 'not_interested' | null
  }
}

// Rejection feedback
interface RejectionFeedback {
  companyId: string
  reason: 'wrong_region' | 'wrong_size' | 'already_client' | 'liquidated' | 'other'
  huntId: string
  createdAt: Date
}

// Updated SearchResult
interface SearchResult {
  companies: RankedCompany[]
  totalFound: number
  query: SearchParams
  plan: SearchPlanSummary
  processingMs: number
}
```

### How to run after this pass
```bash
cd packages/db && pnpm db:migrate
pnpm turbo run build --filter='./packages/*'
# Both workflows should still start cleanly
```

### Done looks like
- `pnpm turbo run build --filter='./packages/*'` succeeds with zero errors
- Migration applied without errors
- No other functionality broken (existing search still works)

---

## Pass 2 — Search Orchestration V4

**Status:** `[ ] NOT STARTED`
**Completion note:** _(fill in when done)_

### Goal
Implement the full pipeline for stages 1–9 of V4 spec: tiered discovery, Signal Engine, ICP/Timing scoring, V4 Ranking, dedup v2, CompanyRegistry, Redis cache, company persistence.

### Dependency
Pass 1 must be complete and migrations applied.

### Environment variables needed
- `REDIS_URL` — ✅ already set
- `DATABASE_URL` — ✅ already set
- No new secrets needed for this pass

### New files to create

#### `apps/api/src/search/search-plan-builder.ts`
`SearchPlanBuilder.build(intent: ParsedIntent): SearchPlan`
- Maps industry → 2GIS rubrics (use existing `INDUSTRY_MAP` logic as base)
- Maps region → city codes for each provider
- Generates tier1 entries for 2GIS + HH.ru
- Generates tier2 entries for Dadata + (Госзакупки placeholder — skip if provider not registered)
- Returns typed `SearchPlan`

#### `apps/api/src/search/signal-engine.ts`
`SignalEngine.extractSignals(rawCompany: RawCompany): Signal[]`
- HH.ru vacancies → `hiring` signal (eventDate = vacancy publish date)
- 2GIS date_added < 6 months → `new_business` signal
- Dadata registration date < 1 year → `new_business` signal
- Dadata director change detected → `leadership_change` signal
- Госзакупки contracts → `contract_won` / `contract_active` signals
- Use `SIGNAL_WEIGHTS` constants from types.ts
- Use `SOURCE_CONFIDENCE` constants from types.ts

#### `apps/api/src/search/scoring/timing-score.ts`
`TimingScoreCalculator.calculate(signals: Signal[], senderContext?: { productCategory: string }): number`
- `timingScore = max(signal.weight * recencyMultiplier)` across all signals
- recencyMultiplier: 0-3 days=1.0, 4-7=0.8, 8-14=0.6, 15-30=0.4, 31-90=0.2
- No signals in last 90 days → 0
- Result: 0–100

#### `apps/api/src/search/scoring/icp-score.ts`
`ICPScoreCalculator.calculate(company: MergedCompany, intent: ParsedIntent): number`
- Industry match: 30 pts
- Region match: 20 pts
- Size in range: 20 pts
- INN verified (not null): 10 pts
- No FSSP flag: 10 pts
- Is active (has vacancies OR contracts): 10 pts
- Penalty: negative signals reduce score (financial_risk=-20, leadership_instability=-10, activity_decline=-10)
- Result clamped to 0–100

#### `apps/api/src/search/scoring/completeness-score.ts`
`CompletenessCalculator.calculate(company: MergedCompany): number`
- email verified: 25 pts
- phone exists: 20 pts
- website exists: 15 pts
- INN exists: 20 pts
- contact found (name + role): 20 pts
- Result: 0–100

#### `apps/api/src/search/v4-ranking-engine.ts`
`V4RankingEngine implements RankingEngine`
- `rank(companies: MergedCompany[], intent: ParsedIntent): RankedCompany[]`
- `finalScore = icpScore * 0.60 + timingScore * 0.30 + completeness * 0.10`
- Sort by `finalScore DESC`
- Strip `finalScore` from API response (keep in internal type, not in returned JSON)
- Implements existing `RankingEngine` interface — no interface changes

#### `apps/api/src/search/filter-stage.ts`
`PreRankingFilter.filter(companies: MergedCompany[]): MergedCompany[]`
- Remove companies with status `'liquidated'` (from Dadata)
- Remove companies with `icpScore < 20`
- Remove companies with active FSSP flag (if user enabled FSSP filter)
- Remove remaining duplicates after fuzzy dedup
- Log filter stats for `SearchPlanSummary`

#### `apps/api/src/search/dedup/dedup-engine.ts`
`DedupEngine.dedup(companies: RawCompany[]): MergedCompany[]`
Priority order (strict):
1. INN (10 digits normalized, trim, no spaces) — absolute match
2. ОГРН (13 or 15 digits) — if no INN from any source
3. Domain (no protocol, no www, no trailing slash, lowercase) — if no INN/ОГРН
4. Name + city fuzzy — Jaro-Winkler threshold 0.88 — **conservative**: flag as `potential_duplicate`, do NOT auto-merge

Field merge strategy on conflict (from spec section 5):
- Legal name → Dadata wins
- Trade name → 2GIS wins
- INN → Dadata > Госзакупки > 2GIS
- Phone → 2GIS > website > HH
- Website → direct > 2GIS > HH
- Email → website > Hunter > pattern
- Size → Контур > HH > 2GIS

On anomaly (one INN, two names): log as `dedup_anomaly`, Dadata name wins, both saved in `aliases[]`
On two INNs + one domain (holding): keep as separate companies, mark `related_domain: true`

#### `apps/api/src/search/company-registry.ts`
`CompanyRegistry` — workspace-level persistent dedup
- `findByInn(workspaceId, inn): Promise<Company | null>`
- `findByOgrn(workspaceId, ogrn): Promise<Company | null>`
- `findByDomain(workspaceId, domain): Promise<Company | null>`
- `register(workspaceId, company): Promise<Company>` — upsert
- Returns `existsInWorkspace: boolean` and `workspaceStatus` for each company in results
- Queries the `companies` table (already exists in DB)

#### `apps/api/src/search/persistence/company-persister.ts`
`CompanyPersister.persist(huntId, workspaceId, companies: RankedCompany[]): Promise<void>`
- Upsert companies into `companies` table (keyed on `workspace_id + inn` or `workspace_id + domain`)
- Link to hunt via `hunt_id`
- Store `signals`, `contacts`, `field_provenance` as JSONB
- Called async after ranking (do not block the HTTP response)

### Files to modify

#### `apps/api/src/search/search-orchestrator.ts`
Replace the current sequential flow with V4 tiered execution:

```
1. SearchPlanBuilder.build(intent) → SearchPlan
2. Tier1 + Tier2 launched simultaneously with Promise.all
   - Tier1: 2GIS, HH.ru (parallel)
   - Tier2: Dadata, Госзакупки, ФССП (parallel, results stream in as ready)
3. Redis cache check BEFORE each provider call:
   cacheKey = `search:${providerId}:${hash(query)}`
   TTL: Tier1 = 6h, Tier2 = 24h
4. DedupEngine.dedup(allRawResults)
5. SignalEngine.extractSignals() for each company
6. ICPScoreCalculator.calculate() for each company
7. TimingScoreCalculator.calculate() for each company
8. PreRankingFilter.filter()
9. CompletenessCalculator.calculate() for each company
10. V4RankingEngine.rank()
11. CompanyRegistry — check existsInWorkspace for each result
12. CompanyPersister.persist() — async, do not await
13. Return SearchResult with SearchPlanSummary
```

#### `apps/api/src/search/setup.ts`
Wire all new services as singletons. Inject Redis client for cache.

#### `apps/api/src/search/provider-registry.ts`
Add `tier: 1 | 2 | 3` to provider registration metadata.

#### `apps/api/src/routes/hunts.ts`
- Add `PATCH /api/v1/hunts/:id/rejection-feedback` — accepts `{ companyId, reason }`, appends to `hunts.rejection_feedback`
- Include `plan: SearchPlanSummary` in `POST /hunts/:id/search` response

### Done looks like
- `POST /api/v1/hunts/:id/search` returns `RankedCompany[]` with `icpScore`, `timingScore`, `finalScore`, `signals[]`, `existsInWorkspace`, `workspaceStatus`
- Repeated search for same region/rubric is served from Redis cache
- Companies are written to `companies` table after each search
- All TypeScript compiles, both workflows start cleanly

---

## Pass 3 — Contact Discovery V4

**Status:** `[ ] NOT STARTED`
**Completion note:** _(fill in when done)_

### Goal
Implement `ContactDiscoveryService` with 7-step waterfall, `ContactRanker`, top-10 synchronous / 11–50 async via BullMQ. Wire `senderProfile` into `GENERATE_EMAIL` job.

### Dependency
Pass 2 must be complete (`RankedCompany` structure exists).

### Environment variables needed
- `HUNTER_API_KEY` — request from user if not set
- `SNOV_API_KEY` — request from user if not set
- OpenAI key needed for website LLM extraction (Pass 3 can skip the LLM part and leave a stub; full website extraction is Pass 5)

### New files to create

#### `apps/api/src/contact-discovery/contact-discovery.service.ts`
`ContactDiscoveryService.findForCompany(company: RankedCompany, verticalContext: string): Promise<ContactCandidate[]>`

**Waterfall rules:**
- Run ALL 7 steps, don't stop at first result
- Stop early ONLY if: `confidence >= 80` AND `emailVerified === true`
- Collect all `ContactCandidate[]` from all steps
- Pass to `ContactRanker`

Steps (run in parallel where independent):
1. `DadataStep` — director from ЕГРЮЛ (confidence: 70)
2. `WebsiteStep` — team page scraping (confidence: 80 if role matches, 50 otherwise) — **stub for now**, full LLM in Pass 5
3. `HhruStep` — email regex in vacancy text + contact person field (confidence: 60)
4. `HunterStep` — domain + role filter CEO/General/Commercial, verify email (confidence: 75 verified, 40 unverified)
5. `SnovStep` — fallback to Hunter's database (confidence: 65 verified)
6. `PatternStep` — use existing `pattern-email-finder.ts` (confidence: 30)
7. `GenericFallbackStep` — info@, sales@, hello@ + verify (confidence: 20)

#### `apps/api/src/contact-discovery/contact-ranker.ts`
`ContactRanker.rank(candidates: ContactCandidate[]): ContactCandidate[]`
- Sort by `confidence DESC`
- Return max 3 (best + 2 alternatives)
- Best candidate = primary contact

Confidence table (hard-code these values):
| Role | Confidence |
|------|-----------|
| CEO / Генеральный директор | 90 |
| Коммерческий директор | 85 |
| Директор профильного отдела | 80 |
| Менеджер по продажам | 60 |
| HR / неизвестная роль | 30 |
| info@ без роли | 20 |

#### `apps/api/src/contact-discovery/steps/dadata-step.ts`
Use existing `dadata.provider.ts` from `packages/plugins`. Extract director name + role. Return `ContactCandidate`.

#### `apps/api/src/contact-discovery/steps/hhru-step.ts`
Use existing `hhru.provider.ts`. Regex email from vacancy text. Extract "Контактное лицо" field. Return `ContactCandidate[]`.

#### `apps/api/src/contact-discovery/steps/hunter-step.ts`
Use existing `hunter.provider.ts`. Query by domain + role filter. Verify emails. Return `ContactCandidate[]`.

#### `apps/api/src/contact-discovery/steps/snov-step.ts`
Use existing `snov.provider.ts`. Return `ContactCandidate[]`.

#### `apps/api/src/contact-discovery/steps/pattern-step.ts`
Use existing `pattern-email-finder.ts`. Return `ContactCandidate[]`.

#### `apps/api/src/contact-discovery/steps/generic-fallback-step.ts`
Generate info@, sales@, hello@ for company domain. Verify via SMTP check or 3rd party. Return `ContactCandidate[]`.

#### `apps/api/src/contact-discovery/steps/website-step.ts`
**Stub for Pass 3** — return empty array. Full LLM extraction implemented in Pass 5.

#### `packages/queue/src/jobs/contact-discovery.job.ts`
Add `CONTACT_DISCOVERY` job type: `{ companyIds: string[], huntId: string, workspaceId: string, verticalContext: string }`

### Files to modify

#### `apps/api/src/search/search-orchestrator.ts`
After `V4RankingEngine.rank()`:
1. Run `ContactDiscoveryService.findForCompany()` for top 10 companies — `await Promise.all(top10.map(...))`
2. Dispatch `CONTACT_DISCOVERY` BullMQ job for companies 11–50 (do not await)
3. Attach `contacts` to `RankedCompany` before returning

#### `apps/workers/src/` — add contact discovery worker
`apps/workers/src/contact-discovery/contact-discovery.worker.ts`
- Processes `CONTACT_DISCOVERY` job
- Calls `ContactDiscoveryService` for each company
- Updates `companies.contacts` in DB via Drizzle
- Uses existing BullMQ worker pattern from `enrichment.worker.ts`

#### `apps/workers/src/ai/ai.worker.ts`
In `GENERATE_EMAIL` handler:
- Load `senderProfile` from `workspaces` table using `workspaceId` from job payload
- Add `senderProfile: { productDescription, targetRole, usp, tone }` to LLM prompt
- If `senderProfile` is null/empty, proceed with generic prompt (do not block email generation)

### Done looks like
- Top-10 companies in search results have `contacts: ContactCandidate[]` populated
- `ContactCandidate` includes `name`, `role`, `email`, `emailVerified`, `confidence`, `source`
- `GENERATE_EMAIL` LLM prompt includes sender's product description and target role
- Contact discovery for companies 11–50 runs asynchronously without blocking the HTTP response

---

## Pass 4 — Госзакупки + ФССП + LLM Intent

**Status:** `[ ] NOT STARTED`
**Completion note:** _(fill in when done)_

### Goal
Add P0 data sources (Госзакупки as Tier2 discovery, ФССП as filter), upgrade Intent Parser to LLM with `signals_wanted`/`exclude_signals` fields.

### Dependency
Pass 2 must be complete (tiered orchestrator, provider registry with tier metadata).

### Environment variables needed
- `OPENAI_API_KEY` — required for LLM Intent Parser. Request from user via `requestSecrets` if not set.
- No API keys for Госзакупки (open API, free)
- No API keys for ФССП (open API, free)

### New files to create

#### `packages/plugins/src/implementations/lead-sources/goszakupki.provider.ts`
`GoszakupkiProvider implements ILeadSourcePlugin`
- API: `https://api.zakupki.gov.ru/` (open, free, 44-ФЗ)
- Query by ОКVED + region code
- Returns `RawCompany[]` with: INN, name, region, contract amounts, customer names, OKVED, participation dates
- Generates signals: `contract_won` (if won), `contract_active` (if current contracts)
- Rate limit: conservative (API is slow, set timeout to 5000ms, tier2 so runs in parallel)
- Register as `tier: 2` in provider registry

#### `packages/plugins/src/implementations/filters/fssp.filter.ts`
`FsspFilter`
- API: `https://api.fssp.gov.ru/` (open, free)
- Input: INN
- Output: `{ hasDebt: boolean, totalAmount: number | null }`
- If `hasDebt === true`: add `financial_risk` signal to company's signals
- Does not remove company — only signals and lets `ICPScoreCalculator` apply penalty
- Run as part of Tier2 (parallel with Dadata and Госзакупки)

#### `apps/api/src/services/llm-intent-parser.ts`
`LLMIntentParser implements IntentParser`
- Model: `gpt-4o-mini` (cheapest, fastest)
- System prompt (Russian): explain the task is to extract structured search intent from a Russian B2B sales query
- Extract: `industry`, `region`, `companySize`, `signals_wanted`, `exclude_signals`, `clarifyingQuestion`
- `signals_wanted` examples: `['hiring', 'contract_won', 'new_business']`
- `exclude_signals` examples: `['financial_risk', 'activity_decline']`
- `clarifyingQuestion`: `{ text: string, options: string[] } | null` — return when query is ambiguous
- Timeout: 3000ms. On timeout/error → fall back to `RuleBasedIntentParser`
- Do NOT throw — always return a `ParsedIntent` (use fallback if LLM fails)

**Updated `ParsedIntent` type** (add to `types.ts` in search or intent module):
```typescript
interface ParsedIntent {
  industry: string | null
  region: string | null
  companySize: string | null
  signals_wanted: SignalType[]          // NEW
  exclude_signals: SignalType[]         // NEW
  clarifyingQuestion: {
    text: string
    options: string[]
  } | null                             // NEW
  raw: string                          // original query
}
```

### Files to modify

#### `apps/api/src/services/intent.service.ts`
- Primary: `LLMIntentParser`
- Fallback: `RuleBasedIntentParser`
- If `clarifyingQuestion` is non-null, return it in the route response without running search

#### `apps/api/src/search/setup.ts`
- Register `GoszakupkiProvider` in provider registry as `tier: 2`
- Wire `FsspFilter` into the orchestrator pipeline (runs in Tier2 parallel block)

#### `apps/api/src/search/search-orchestrator.ts`
- Pass `intent.signals_wanted` and `intent.exclude_signals` to `SignalEngine` and `ICPScoreCalculator`
- If `signals_wanted` is non-empty: boost `timingScore` for matching signal types
- If `exclude_signals` is non-empty: add penalty to `icpScore` for companies with those signal types

#### `apps/api/src/routes/intent.ts`
- If `clarifyingQuestion` is present in parsed intent: return it to client without triggering search
- Client can re-submit with the chosen option appended to query

### Done looks like
- Query "Логистические компании Екатеринбурга с контрактами с РЖД" returns companies from 2GIS + HH.ru + Госзакупки with `contract_won` signals
- ФССП-positive companies have `financial_risk` signal and lower `icpScore`
- Ambiguous query returns `clarifyingQuestion` to the client
- LLM Intent Parser is used by default; rule-based is fallback

---

## Pass 5 — AI Context Builder + Frontend V4

**Status:** `[ ] NOT STARTED`
**Completion note:** _(fill in when done)_

### Goal
Implement `AIContextBuilder` (`CompanyBrief`), update `GENERATE_EMAIL` to use it, update the frontend Discover page to display V4 data (signals with dates, contacts, workspace status, rejection feedback, timing badges).

### Dependency
Passes 2 and 3 must be complete (RankedCompany with signals and contacts populated).

### Environment variables needed
- `OPENAI_API_KEY` — required for website LLM extraction and email generation. Request if not set.

### New files to create

#### `apps/api/src/ai-context/ai-context-builder.ts`
`AIContextBuilder.buildFor(company: RankedCompany, hunt: Hunt, workspaceId: string): Promise<CompanyBrief | null>`

Rules:
- If `company.description` is null/empty AND `company.signals.length === 0` → return `null` (do not generate)
- Load `senderContext` from `workspaces` table (`productDescription`, `targetRole`, `usp`)
- Check `previousContact`: query `companies` table for prior email sends to this company in this workspace
- Select `triggerEvent`: the highest-weight signal with `eventDate` in last 14 days
- Build `whyThisCompany[]` from: signals, contract data, HH.ru vacancies, website scrape results
- If `whyThisCompany` is empty AND `triggerEvent` is null → return `null`

**When null is returned**, the route must respond with:
```json
{
  "error": "INSUFFICIENT_DATA",
  "message": "Недостаточно данных для персонализации. Добавьте API-ключ Контур.Фокус или HH.ru для этой компании."
}
```

#### `apps/api/src/contact-discovery/steps/website-step.ts` (replace stub from Pass 3)
Full LLM extraction:
- Use Playwright (already in dependencies) to load company website
- Extract: team section (names + roles), clients section, contact email, about section
- Pass extracted text to OpenAI: extract `ContactCandidate[]` for team, `clientNames[]` for social proof
- Timeout: 8000ms. On timeout → return empty array (do not throw)
- Add `client_fit` signal if known competitor found in clients list

#### `apps/web/src/components/discover/signal-badge.tsx`
Props: `signal: Signal`
- Icon by `SignalType` (🔥 hiring, 📋 contract, 📈 growing, ⚠️ financial_risk, etc.)
- Color by recency: 0-3 days = red/hot, 4-14 days = orange/warm, 15-90 days = gray/cool
- Show `signal.label` + relative date ("3 дня назад")
- Negative signals (financial_risk, leadership_instability, activity_decline) → warning style

#### `apps/web/src/components/discover/contact-card.tsx`
Props: `contact: ContactCandidate`
- Name, role, email (with verified ✓ badge if `emailVerified`)
- Confidence bar (color: green >70, yellow 40-70, gray <40)
- Source label
- Copy email button

#### `apps/web/src/components/discover/company-status-badge.tsx`
Props: `status: 'new' | 'contacted' | 'in_pipeline' | 'closed'`
- Pill badge with appropriate color

#### `apps/web/src/components/discover/rejection-feedback-menu.tsx`
Props: `huntId: string, companyId: string, onFeedback: () => void`
- Dropdown menu (shadcn/ui `DropdownMenu`)
- Options: "Не тот регион", "Не тот размер", "Уже клиент", "Ликвидирована", "Другое"
- On select: `PATCH /api/v1/hunts/:huntId/rejection-feedback` → `{ companyId, reason }`
- On success: hide company from list (optimistic update)

### Files to modify

#### `apps/api/src/routes/hunts.ts`
Add: `POST /api/v1/hunts/:huntId/companies/:companyId/brief`
- Calls `AIContextBuilder.buildFor(company, hunt, workspaceId)`
- If returns null: respond with `INSUFFICIENT_DATA` error
- If returns `CompanyBrief`: dispatch `GENERATE_EMAIL` job with brief + senderProfile

#### `apps/workers/src/ai/ai.worker.ts`
Update `GENERATE_EMAIL` handler:
- Accept `companyBrief: CompanyBrief` in payload
- Build LLM prompt from `CompanyBrief` fields:
  - Use `triggerEvent.label` as the email opening hook
  - Use `whyThisCompany[0]` as the personalization fact
  - Use `senderContext.usp` as the value proposition
  - Use `contact.name` for direct salutation if available
- If `companyBrief` is null in payload: fall back to basic company data

#### `apps/web/src/app/(dashboard)/discover/page.tsx`
- Replace current company card with V4 card:
  - Show top 3 signals with `SignalBadge`
  - Show primary contact with `ContactCard` (if available)
  - Show `CompanyStatusBadge`
  - Show timing badge if `timingScore > 60` ("🔥 Горячий момент")
  - Add rejection feedback button (kebab menu) → `RejectionFeedbackMenu`
  - Scores (`icpScore`, `timingScore`, `finalScore`) are NOT shown to user — only order and badges
- Handle streaming: results update as async enrichment completes (use polling or SSE — implement polling for MVP: re-fetch every 5 seconds if hunt status is `searching`)

#### `apps/web/src/lib/search/types.ts`
Sync with `RankedCompany` from API types.

### Done looks like
- Company cards show signals with human-readable labels and dates
- Primary contact (name, role, email, confidence) shown on card
- "Написать письмо" button triggers `AIContextBuilder` → `GENERATE_EMAIL`
- If insufficient data, user sees Russian error message (not a generic 500)
- Rejection feedback dropdown works and hides the company from results
- Workspace status badge shows `new` / `contacted` / `in_pipeline` / `closed`

---

## Known Issues / Critical Problems

> If you discover a critical problem during implementation, document it here.
> Format: **[PASS N - SHORT TITLE]** Description. Reason it's critical. Proposed solution.

_(none yet)_

---

## Quick reference: file locations

```
apps/
  api/
    src/
      search/           ← search orchestration (modify heavily in Pass 2)
      contact-discovery/← new in Pass 3
      ai-context/       ← new in Pass 5
      routes/hunts.ts   ← add endpoints in Passes 2, 3, 5
      services/         ← intent parser (modify in Pass 4)
      plugins/auth.ts   ← Better Auth (do not touch)
  web/
    src/
      app/(dashboard)/discover/page.tsx  ← main UI (modify in Pass 5)
      components/discover/               ← new V4 components in Pass 5
      lib/search/                        ← client types and hunt-service
  workers/
    src/
      enrichment/enrichment.worker.ts    ← existing, reference pattern
      ai/ai.worker.ts                    ← modify in Pass 3 and 5
      contact-discovery/                 ← new in Pass 3

packages/
  db/src/
    schema/             ← extend in Pass 1
    migrations/         ← add 0004 in Pass 1
  plugins/src/
    implementations/
      lead-sources/     ← 2gis, hhru exist; add goszakupki in Pass 4
      enrichment/       ← dadata, hunter, snov exist
      filters/          ← add fssp in Pass 4
  queue/src/jobs/       ← add contact-discovery job in Pass 3
```

---

## Running the project

```bash
# Install dependencies
pnpm install

# Build all packages (required before running apps)
pnpm turbo run build --filter='./packages/*'

# Apply DB migrations
cd packages/db && pnpm db:migrate && cd ../..

# Start API (port 3001, starts Redis automatically)
# Use "API Server" workflow in Replit

# Start Web (port 5000)
# Use "Start application" workflow in Replit
```

Test credentials: `test@example.com` / `testpass123`
