# PROJECT BIBLE — AI Sales OS
> **Единый источник истины.** Любой AI-агент или разработчик должен прочитать этот документ первым.  
> Версия: 1.0 | Дата: 2025-07 | Статус: CANONICAL

---

## 0. Быстрый старт для AI-агентов

```
1. Прочитай этот файл полностью (15 мин)
2. Прочитай docs/domain_model.md — канонические сущности
3. Прочитай docs/event_flow.md — полный lifecycle лида
4. Прочитай AI_HANDOFF.md — текущее состояние и приоритеты
5. Только потом смотри на код
```

**Золотое правило**: Если что-то в коде противоречит этому документу — СТОП. Исправь документ или код, но не игнорируй противоречие.

---

## 1. Видение проекта

**AI Sales OS** — самый простой способ найти потенциальных клиентов, независимо от профессии.

Продукт принимает намерение пользователя на естественном языке («мне нужны транспортные компании в Екатеринбурге») и превращает его в готовые контакты с минимальным участием человека. Миссия: сократить время от «мне нужны клиенты» до «я уже написал первому» — до нескольких минут.

**Философия**: Intent-First. Пользователь описывает кого ищет — система делает остальное. Системные термины (Hunt, ICP, Waterfall, Pipeline, Activity Queue) существуют только в архитектуре и API; в пользовательском интерфейсе их нет.

**Долгосрочно**: Крупнейшая карта коммерческих намерений компаний в России и СНГ. Продукт, который знает кто готов купить — ещё до того, как они сами это осознали.

---

## 2. Что этот продукт ЕСТЬ и НЕ ЕСТЬ

### ЭТО ЕСТЬ ✅
- Сервис для поиска потенциальных клиентов по намерению на естественном языке
- AI-ориентированный конвейер: намерение → поиск → обогащение → персонализация → отправка → трекинг
- Многотенантная SaaS-платформа с workspace изоляцией
- Extensible система через Plugin Architecture
- API-first платформа (каждая функция доступна через API)
- Инструмент для любого B2B-продавца — независимо от опыта, профессии и размера команды

### ЭТО НЕ ЕСТЬ ❌
- Не CRM в традиционном смысле (хотя содержит CRM-модуль)
- Не email-рассыльщик (это лишь один канал из многих)
- Не marketing automation (только B2B outbound sales)
- Не ERP (не интегрируемся с бухгалтерией нативно)
- Не инструмент спама (compliance by design)
- Не замена продавцов (Human-in-the-loop всегда)
- Не инструмент нелегального парсинга (только официальные API)
- Не Apollo для России (российские источники — усилитель, а не единственное отличие)

---

## 3. Бизнес-цели

### MVP (90 дней)
- 1 вертикаль (транспорт/логистика)
- Первые 3 платящих клиента
- MRR $3,000+
- Полный E2E flow без ошибок

### 12 месяцев
- 10+ платящих клиентов
- MRR $15,000+
- 2+ вертикали
- Churn < 5%/мес

### 18 месяцев
- 50+ клиентов
- MRR $50,000+
- 4+ вертикали
- SDR производительность x5 vs ручной процесс

---

## 4. Пользователи системы (User Personas)

> **Ключевое решение**: продукт строится для любых B2B-продавцов, не только для профессиональных sales-команд. Sales-терминология (SDR, ICP, Pipeline, Sequences) — только во внутренних документах и API. В UI — пользовательский язык.

### Михаил — владелец малого бизнеса (основной пользователь)
- 34 года, владелец транспортного агентства; продаёт логистику другим компаниям
- Пробовал CRM — бросил; ищет клиентов вручную через 2GIS и знакомых
- Боль: не знает где найти следующего клиента; не хочет учиться сложным инструментам
- Цель: «Просто дай мне список компаний, которым я могу написать прямо сейчас»

### Анна — фриланс-специалист
- 28 лет, фриланс-дизайнер; ищет корпоративных клиентов
- Никогда не работала с продажами как профессией
- Боль: не знает как начать; боится написать первым
- Цель: «Скажи мне кому написать — и помоги написать первое сообщение»

### Дмитрий — руководитель с небольшой командой
- 41 год, 3 человека занимаются продажами
- Пробовал Apollo — устал от кредитной системы и плохого качества российских данных
- Боль: нужен стек из 5 инструментов; нет нормальной базы по России
- Цель: «Нормальная база по России + не нужно собирать стек из пяти инструментов»

### AI-агент / разработчик (технический пользователь)
- Настраивает вертикали, расширяет систему через Plugin Interface
- Цель: добавить новую вертикаль за < 1 день без изменения ядра

---

## 5. Целевой рынок

**Первичный**: Российские компании, продающие B2B SaaS или сервисы
**Немедленный ICP для Route OS**: Логистические компании РФ с автопарком 20–500 машин
**Вторичный**: СНГ (Беларусь, Казахстан, Украина)
**Перспективный**: Международный (через локализацию источников данных)

---

## 6. Ключевые принципы продукта

| Принцип | Означает |
|---------|---------|
| **API-first** | Каждая функция через API ДО UI |
| **Vertical-agnostic core** | Ядро ≠ домен; домен = конфиг + промпты |
| **Human-in-the-loop** | AI предлагает; критичные действия требуют подтверждения |
| **Data ownership** | Клиент может экспортировать всё в любой момент |
| **Observability by default** | Каждый шаг агента логируется и объясним |
| **Legal by design** | Только официальные API; compliance встроен, не добавлен |
| **Fail loudly** | Система явно сигнализирует об ошибках, нет silent failures |

---

## 7. Инженерные принципы

### 7.1 Архитектурные

**Modular Monolith → Services by necessity**
Начинаем с модульного монолита. Выделяем сервисы только при реальной необходимости (нагрузка > 30% CPU или требование независимого масштабирования). Не преждевременная оптимизация.

**Plugin Architecture First**
Каждый внешний провайдер (источник данных, email, AI, storage) реализуется через Plugin Interface. Ядро не знает о конкретных провайдерах — только об интерфейсах. Подробности: `docs/plugin_architecture.md`.

**Event-Driven для асинхронных операций**
Обогащение, отправка писем, AI-генерация — всегда через Queue (BullMQ). Никогда не блокируем HTTP-запрос на долгие операции.

**Idempotency everywhere**
Каждая задача в очереди имеет детерминированный `jobId`. Повторный запуск = безопасно. Обогащение, отправка, классификация — всё идемпотентно.

### 7.2 Данные

**Multitenancy через workspace_id + RLS**  
Два уровня изоляции: Application layer (WHERE workspace_id = ?) + PostgreSQL RLS. Оба обязательны.

**Soft deletes для бизнес-сущностей**  
Company, Contact, Deal, Campaign — `deleted_at TIMESTAMPTZ NULL`. Hard delete запрещён для аудита.

**Append-only для логов**  
audit_logs, ai_logs, activities — только INSERT. Никаких UPDATE/DELETE.

**Schema через миграции**  
Drizzle Kit. Никакого ручного SQL в production. Rollback = новая migration.

### 7.3 API

**RESTful с предсказуемыми URL**
```
GET    /api/v1/companies
POST   /api/v1/companies
GET    /api/v1/companies/:id
PATCH  /api/v1/companies/:id
DELETE /api/v1/companies/:id
```

**Версионирование через URL prefix**: `/api/v1/`, `/api/v2/`  
Breaking changes → новая версия. Старая поддерживается 6 месяцев.

**Единый формат ответа**
```typescript
// Success
{ data: T, meta?: { page, total, ... } }
// Error
{ error: { code: string, message: string, details?: any } }
```

---

## 8. Принципы кодирования

### TypeScript
- **strict mode обязателен**: `"strict": true` в tsconfig
- **Нет `any`**: ESLint `@typescript-eslint/no-explicit-any: error`
- **Zod везде**: все входящие данные валидируются через Zod schema
- **Shared types**: `packages/types/` содержит типы для всего monorepo

### Именование
| Что | Стиль | Пример |
|-----|-------|--------|
| Файлы | kebab-case | `email-worker.ts` |
| Классы/Типы/Интерфейсы | PascalCase | `EnrichmentProvider` |
| Функции/переменные | camelCase | `enrichLead()` |
| Константы | UPPER_SNAKE | `MAX_RETRY_ATTEMPTS` |
| DB таблицы | snake_case | `sequence_enrollments` |
| DB колонки | snake_case | `workspace_id` |
| ENV переменные | UPPER_SNAKE | `OPENAI_API_KEY` |
| Queue имена | kebab-case | `enrichment-queue` |
| Events | kebab-case с namespace | `lead.enrichment.completed` |

### Структура файлов (модуль)
```
packages/enrichment/
├── src/
│   ├── providers/          # Plugin implementations
│   │   ├── hunter.provider.ts
│   │   └── snov.provider.ts
│   ├── interfaces/         # Plugin contracts
│   │   └── email-finder.interface.ts
│   ├── waterfall.ts        # Core orchestration
│   └── index.ts            # Public exports only
├── tests/
│   ├── unit/
│   └── integration/
└── package.json
```

### Запрещено ❌
- `console.log` в production коде → используй Pino logger
- `process.env.X` напрямую в business logic → используй `packages/config/`
- Raw SQL строки с user input → Drizzle ORM prepared statements
- `any` тип → типизируй или используй `unknown` с проверкой
- Secrets в коде или `.env` в репозитории → только через secrets manager
- `setTimeout` для задержек → используй BullMQ `delay`
- Прямой вызов внешнего API из API Handler → только через Worker/Queue

---

## 9. Обработка ошибок

### Философия: Fail loudly, recover gracefully

**Уровень 1: Validation errors (4xx)**
- Всегда возвращать конкретную причину
- Никогда не раскрывать внутренние детали
```typescript
throw new ValidationError('INVALID_INN', 'ИНН должен содержать 10 или 12 цифр')
```

**Уровень 2: Business logic errors**
- Typed errors с кодами: `LEAD_ALREADY_EXISTS`, `CAMPAIGN_LIMIT_REACHED`
- Логировать с контекстом (leadId, workspaceId, userId)

**Уровень 3: Worker failures**
- Retry с exponential backoff: 1min → 5min → 15min → 1h
- После 4 попыток: job в `failed` state + alert оператору
- Никогда не терять job — только помечать как failed

**Уровень 4: External API failures**
- Timeout: 10 секунд для enrichment APIs, 30 секунд для Playwright
- Fallback: следующий провайдер в waterfall
- Circuit breaker: если провайдер возвращает 5xx 5 раз подряд — skip на 30 минут

**Уровень 5: AI failures**
- OpenAI timeout/error → Anthropic
- Оба недоступны → template-based fallback + уведомление
- Cost limit exceeded → stop + уведомление owner

### Logging format (Pino)
```typescript
logger.info({
  event: 'lead.enrichment.completed',
  workspaceId: ctx.workspaceId,
  leadId: lead.id,
  duration_ms: 1240,
  providers_used: ['egrul', 'hunter'],
  email_found: true
})
```
**Всегда включать**: event name, workspaceId, entityId, duration_ms  
**Никогда не логировать**: пароли, API ключи, PII без маскировки

---

## 10. Философия безопасности

**Defense in depth**: несколько независимых слоёв защиты.

1. **Аутентификация**: JWT 15min + httpOnly refresh 30d
2. **Авторизация**: RBAC middleware + PostgreSQL RLS (двойной контроль)
3. **Изоляция тенантов**: workspace_id в каждом запросе + RLS policy
4. **Шифрование**: API ключи шифруются AES-256-GCM перед записью в БД
5. **Input validation**: Zod на всех endpoints
6. **Prompt injection**: user data только в role:user, никогда в system prompt
7. **Rate limiting**: на всех публичных endpoints
8. **Audit trail**: все изменения данных пишутся в audit_logs

**Правило секретов**: Ни одного секрета в коде, конфигах, логах. Только через environment variables из secrets manager.

---

## 11. Философия производительности

**Premature optimization — враг**. Оптимизируем только измеренные bottlenecks.

**Целевые показатели (p95)**:
- API endpoints: < 300ms
- Dashboard load: < 1.5s
- AI email generation: < 10s (streaming)
- Enrichment pipeline: < 30s/лид

**Стратегия**:
1. Async все длинные операции → Queue
2. Cache enrichment results (Redis, TTL 7 дней)
3. Materialized views для аналитики
4. Pagination везде (no unbounded queries)
5. Индексы по access patterns, не "на всякий случай"
6. Connection pooling (Drizzle built-in + PgBouncer при >20 workers)

---

## 12. Правила для AI-агентов

Этот репозиторий разрабатывается несколькими AI-агентами (Replit, Claude Code, Cursor, OpenHands, Codex). Следующие правила обязательны:

### DO ✅
- Читай PROJECT_BIBLE.md перед любой работой
- Следуй Plugin Interface при добавлении провайдера
- Пиши tests для business logic
- Используй Drizzle migrations для schema changes
- Логируй через Pino, не console.log
- Коммить атомарные изменения (feature + tests + docs)
- Обновляй CHANGELOG.md при значимых изменениях
- Если не уверен → добавь TODO с вопросом, не угадывай

### DON'T ❌
- Не добавляй зависимости без обоснования в PR description
- Не меняй Plugin Interface без ADR
- Не добавляй raw SQL с user input
- Не пиши бизнес-логику в HTTP handlers (только в services/modules)
- Не hardcode workspace_id или любые данные конкретного тенанта
- Не удаляй soft-delete сущности hard delete
- Не обходи RLS (не отключай политики)
- Не логируй API ключи, токены, PII
- Не добавляй новых внешних API без проверки ToS (см. ADR-011)

### Структура PR/Commit
```
feat(enrichment): add Snov.io provider plugin

- Implement IEmailFinderProvider interface
- Add SnovProvider class with waterfall integration
- Add unit tests with mocked HTTP responses
- Update plugin registry configuration
- Add SNOV_API_KEY to .env.example

Refs: MISS-004, docs/plugin_architecture.md
```

---

## 13. Структура папок (canonical)

```
ai-sales-os/
├── PROJECT_BIBLE.md          ← ВЫ ЗДЕСЬ
├── AI_HANDOFF.md             ← Текущее состояние для нового агента
├── CHANGELOG.md              ← Значимые изменения
├── CONTRIBUTING.md           ← Как делать PR
│
├── apps/
│   ├── web/                  # Next.js 15 App Router
│   │   ├── app/              # Pages и layouts
│   │   ├── components/       # UI компоненты (shadcn/ui based)
│   │   └── lib/              # Утилиты, API клиент
│   │
│   ├── api/                  # Fastify backend
│   │   ├── src/
│   │   │   ├── modules/      # Бизнес-модули (CRM, Campaigns, etc.)
│   │   │   ├── plugins/      # Fastify plugins (auth, db, queue)
│   │   │   ├── middleware/   # Auth, workspace, rate-limit
│   │   │   └── routes/       # HTTP route definitions
│   │   └── tests/
│   │
│   └── workers/              # Background workers
│       ├── src/
│       │   ├── enrichment/   # Enrichment worker
│       │   ├── email/        # Email sending worker
│       │   ├── ai/           # AI generation worker
│       │   ├── scraping/     # Web scraping worker (Playwright)
│       │   └── scheduler/    # Cron-based sequence scheduler
│       └── tests/
│
├── packages/
│   ├── db/                   # Drizzle schema + migrations
│   │   ├── schema/           # Table definitions
│   │   ├── migrations/       # Generated migration files
│   │   └── seed/             # Dev seed data
│   │
│   ├── plugins/              # Plugin system
│   │   ├── interfaces/       # Все plugin contracts (TypeScript interfaces)
│   │   ├── registry/         # Plugin registration & discovery
│   │   └── implementations/  # Конкретные провайдеры
│   │       ├── lead-sources/ # 2gis, hhru, vk, csv
│   │       ├── enrichment/   # hunter, snov, dadata, egrul
│   │       ├── email/        # mailgun, brevo, ses
│   │       ├── ai/           # openai, anthropic, gigachat
│   │       ├── storage/      # s3, minio
│   │       └── notifications/ # telegram, slack
│   │
│   ├── ai/                   # AI agent definitions + prompts
│   │   ├── agents/           # Agent implementations
│   │   ├── prompts/          # YAML prompt templates by vertical
│   │   └── tools/            # AI tool definitions
│   │
│   ├── queue/                # BullMQ job definitions
│   │   ├── jobs/             # Job type definitions & processors
│   │   └── queues.ts         # Queue registry
│   │
│   ├── types/                # Shared TypeScript types (no logic)
│   ├── config/               # Config loading & validation
│   ├── logger/               # Pino logger factory
│   └── errors/               # Typed error classes
│
├── verticals/                # Vertical configurations
│   ├── transport/            # Транспорт и логистика
│   │   ├── icp.yaml          # ICP scoring rules
│   │   ├── prompts.yaml      # AI prompt templates
│   │   └── sources.yaml      # Data source priorities
│   └── construction/         # Строительство (future)
│
├── infra/
│   ├── docker-compose.yml       # Development
│   ├── docker-compose.prod.yml  # Production
│   ├── monitoring/              # Prometheus, Grafana configs
│   └── k8s/                     # Kubernetes manifests (future)
│
└── docs/
    ├── 00-audit-report.md       ← Architecture audit
    ├── 01-vision.md
    ├── 02-product-goals.md
    ├── 03-market-research.md
    ├── 04-functional-requirements.md
    ├── 05-non-functional-requirements.md
    ├── 06-system-architecture.md
    ├── 07-database-design.md
    ├── 08-api-integrations.md
    ├── 09-ai-layer.md
    ├── 10-crm-design.md
    ├── 11-ui-ux.md
    ├── 12-security.md
    ├── 13-deployment.md
    ├── 14-roadmap.md
    ├── 15-adr.md
    ├── 16-todo-backlog.md
    ├── 17-architecture-diagrams.md
    ├── 18-user-scenarios.md
    ├── 19-mvp-plan.md
    ├── domain_model.md          ← Canonical business entities
    ├── event_flow.md            ← Complete lead lifecycle & events
    ├── plugin_architecture.md   ← Plugin system design
    ├── ai_agents.md             ← Full multi-agent system
    └── platform_vision.md      ← Long-term scaling vision
```

---

## 14. Ответственности модулей

| Модуль | Ответственность | НЕ ответственен за |
|--------|----------------|-------------------|
| `apps/api` | HTTP routing, auth, validation, response formatting | Бизнес-логика, работа с внешними API |
| `apps/web` | UI, UX, state management | Бизнес-логика, прямые DB запросы |
| `apps/workers` | Job processing, orchestration | HTTP routing, UI |
| `packages/db` | Schema definition, migrations, queries | Бизнес-правила |
| `packages/plugins` | Provider implementations | Orchestration, business rules |
| `packages/ai` | Prompt templates, LLM calls, result parsing | Campaign logic, CRM |
| `packages/queue` | Job definitions, dispatch, retry config | Business logic inside jobs |
| `verticals/*` | Domain-specific config (ICP, prompts, sources) | Core logic |

---

## 15. Definition of Done

Задача считается завершённой только если:

### Код
- [ ] TypeScript strict, нет `any`
- [ ] Unit tests для business logic (>80% coverage)
- [ ] Integration test для новых API endpoints
- [ ] Нет ESLint warnings

### Безопасность
- [ ] workspace_id проверяется на каждом запросе к данным
- [ ] Входные данные валидируются через Zod schema
- [ ] Нет секретов в коде

### Наблюдаемость
- [ ] Все значимые действия логируются через Pino
- [ ] Ошибки имеют типизированные коды
- [ ] Новые метрики Prometheus для новых операций

### Документация
- [ ] ADR создан если было принято нетривиальное архитектурное решение
- [ ] `docs/16-todo-backlog.md` обновлён
- [ ] Public API задокументирован (JSDoc или OpenAPI comment)

### Деплой
- [ ] Работает в `docker compose up` локально
- [ ] Migration файл создан для schema changes
- [ ] `.env.example` обновлён для новых env vars

---

## 16. Стратегия масштабирования

### Сейчас (Phase 1, <500 workspaces)
- Single PostgreSQL + Docker Compose на VPS
- Redis на той же машине
- 2 replicas per worker type

### При росте (Phase 2, 500–5000 workspaces)
- PostgreSQL → Managed (Supabase/Neon/RDS)
- Redis → Redis Cloud или Redis Sentinel
- Workers → отдельные VPS или managed containers
- Read replica для analytics queries

### При scale (Phase 3, 5000+ workspaces)
- Kubernetes для worker horizontal scaling
- PgBouncer для connection pooling
- CDN для frontend статики
- Meilisearch для full-text search (если PostgreSQL FTS не справляется)
- Schema-per-tenant для enterprise clients (ADR-007-b)

---

## 17. Последнее слово

Этот проект строится как продукт, который будет работать с тысячами клиентов. Каждое решение должно выдержать этот масштаб — технически, юридически, операционно.

Но не оптимизируй заранее то, что не болит. Ship, measure, learn, iterate.

**Читай документацию. Следуй принципам. Задавай вопросы через TODO-комментарии.**
