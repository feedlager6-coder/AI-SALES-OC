# AI Handoff Document — AI Sales OS
> Для нового AI-агента или разработчика, который продолжает работу.  
> Прочитай этот файл ПОСЛЕ `PROJECT_BIBLE.md`.  
> Версия: 1.0 | Последнее обновление: 2025-07

---

## 0. Критическое: прочти это первым

```
СОСТОЯНИЕ ПРОЕКТА: ФАЗА 0 ЗАВЕРШЕНА → ГОТОВ К ФАЗЕ 1 (разработка)

Что сделано: ДОКУМЕНТАЦИЯ и АРХИТЕКТУРА
Что НЕ сделано: КОД (кроме базовой структуры проекта на Replit)

Первая задача: настроить monorepo и запустить dev окружение
Подробности: docs/19-mvp-plan.md (Sprint 1.1)
```

---

## 1. Что уже готово

### Документация (Phase 0 — 100%)
| Документ | Статус | Описание |
|----------|--------|---------|
| `PROJECT_BIBLE.md` | ✅ Ready | Единый источник истины |
| `docs/01-vision.md` | ✅ Ready | Миссия и видение |
| `docs/04-functional-requirements.md` | ✅ Ready | Функциональные требования |
| `docs/06-system-architecture.md` | ✅ Ready | Архитектура системы |
| `docs/07-database-design.md` | ✅ Ready | Схема базы данных |
| `docs/09-ai-layer.md` | ✅ Ready | AI Layer |
| `docs/12-security.md` | ✅ Ready | Безопасность |
| `docs/13-deployment.md` | ✅ Ready | Деплой |
| `docs/14-roadmap.md` | ✅ Ready | Roadmap |
| `docs/15-adr.md` | ✅ Ready | 11 архитектурных решений |
| `docs/17-architecture-diagrams.md` | ✅ Ready | Mermaid диаграммы |
| `docs/19-mvp-plan.md` | ✅ Ready | Детальный план MVP |
| `docs/00-audit-report.md` | ✅ NEW | Архитектурный аудит |
| `docs/domain_model.md` | ✅ NEW | Канонические сущности |
| `docs/event_flow.md` | ✅ NEW | Полный event lifecycle |
| `docs/plugin_architecture.md` | ✅ NEW | Plugin system design |
| `docs/ai_agents.md` | ✅ NEW | 13 AI-агентов |
| `docs/platform_vision.md` | ✅ NEW | Long-term vision |
| `AI_HANDOFF.md` | ✅ NEW | Этот файл |

### Среда (Replit)
- Replit проект создан
- `SESSION_SECRET` — секрет уже добавлен в Replit Secrets

---

## 2. Текущее состояние кода

```
⚠️  ВАЖНО: Кода ещё НЕТ. Только документация.
    Следующий шаг: настроить monorepo с нуля.
```

### Что нужно создать в первую очередь (Sprint 1.1)

```
□ pnpm monorepo + Turborepo setup
  └─ apps/api, apps/web, apps/workers
  └─ packages/db, packages/types, packages/config, packages/logger, packages/errors

□ Docker Compose для разработки
  └─ PostgreSQL 16, Redis 7

□ Fastify API server (boilerplate)
  └─ Health endpoint, auth plugin, workspace middleware

□ Drizzle ORM setup
  └─ Базовые таблицы: workspaces, users, companies, contacts

□ Next.js 15 frontend (boilerplate)
  └─ Auth pages, layout, sidebar

□ BullMQ + Redis setup
  └─ Базовые очереди: enrichment-queue, ai-queue

□ JWT auth (Better Auth)
  └─ Login, register, refresh token
```

Детали: `docs/19-mvp-plan.md` → Недели 1-2.

---

## 3. Критические решения, принятые до написания кода

### Именование сущностей
> В системе НЕТ таблицы `leads`. "Лид" разговорно = Company в статусе до QUALIFIED.

Правильно: `companies`, `contacts`, `deals`  
Неправильно: `leads`, `prospects`, `accounts` (не используй эти имена)

### Статусы Company (canonical)
```
NEW → ENRICHING → ENRICHED → QUALIFIED | LOW_QUALITY → CONTACTED →
REPLIED → MEETING → PROPOSAL → NEGOTIATION → WON | CLOSED_LOST

Специальные: PAUSED_30D, OPTED_OUT
```
Источник: `docs/domain_model.md`

### Plugin First
Перед добавлением ЛЮБОГО внешнего провайдера — реализуй Plugin Interface:
```
packages/plugins/interfaces/{category}.interface.ts
packages/plugins/implementations/{category}/{provider}.ts
packages/plugins/registry/register-all.ts
```
Источник: `docs/plugin_architecture.md`

### Soft Delete
Все бизнес-сущности имеют `deleted_at TIMESTAMPTZ NULL`. Hard delete запрещён.

### Мультитенантность
Двойной контроль: `WHERE workspace_id = ?` (application) + PostgreSQL RLS.  
Источник: `docs/07-database-design.md`, `docs/12-security.md`

### Atomic counters (RISK-001)
`sent_today` в `email_accounts` хранится в Redis (INCR/EXPIRE), не в PostgreSQL.  
Причина: race condition при параллельных workers.  
Источник: `docs/00-audit-report.md` → RISK-001

---

## 4. Открытые вопросы (нужно решение до/во время реализации)

### Технические
| Вопрос | Контекст | Приоритет |
|--------|---------|-----------|
| WebSocket: socket.io vs native WS + Redis pub/sub? | Нужен для real-time enrichment updates в UI | High |
| Feature flags: LaunchDarkly vs самодельный через workspace.settings? | Нужен для safe rollouts | Medium |
| IMAP vs Mailgun inbound для reply detection? | Mailgun Inbound Routes проще, IMAP надёжнее | High |
| PgBouncer с первого дня или только при 5+ workers? | Connection pooling | Medium |
| Email warmup: самодельный или Instantly.ai API? | Warmup сложен, Instantly API дорог | Low (Phase 2) |

### Продуктовые
| Вопрос | Контекст | Приоритет |
|--------|---------|-----------|
| Custdev с потенциальными клиентами? | Нужно для валидации ICP и UX | URGENT |
| Billing: Stripe vs ЮКасса для РФ рынка? | ЮКасса проще для РФ, Stripe для международных | Medium |
| A/B тест писем: 2 варианта достаточно или 3? | Влияет на Writer Agent | Low |

---

## 5. Известные технические долги и риски

> Полный список: `docs/00-audit-report.md`

### Критические (решить до первого клиента)
- **RISK-001**: Race condition в daily email limit counter → использовать Redis INCR
- **RISK-002**: Redis как SPOF → добавить AOF persistence и Redis Sentinel при продакшене
- **MISS-006**: WebSocket архитектура не спроектирована → нужна до Sprint с enrichment UI

### Высокие (решить до launch)
- **RISK-003**: Playwright memory на VPS → ограничить Scraping Worker concurrency=1
- **RISK-004**: WebSocket fan-out при multiple API instances → Redis pub/sub adapter
- **RISK-005**: Analytics queries на prod DB → materialized views с расписанием
- **RISK-009**: Soft delete отсутствует → добавить в базовую schema

### Средние (решить в Phase 2)
- **MISS-005**: Кэш-стратегия enrichment результатов не спроектирована
- **MISS-007**: Connection pooling (PgBouncer)
- **MISS-010**: API versioning стратегия

---

## 6. Кодовые соглашения (Quick Reference)

### TypeScript
```typescript
// ✅ Правильно
const result: EnrichmentResult = await enrichmentService.enrich(companyId, ctx)

// ❌ Неправильно
const result: any = await enrichmentService.enrich(companyId, ctx)
```

### Логирование
```typescript
// ✅ Правильно (Pino)
logger.info({ event: 'company.enriched', companyId, workspaceId, score })

// ❌ Неправильно
console.log('Company enriched', companyId)
```

### Обработка ошибок
```typescript
// ✅ Правильно — типизированная ошибка
throw new EnrichmentError('EMAIL_NOT_FOUND', { companyId, providersAttempted: ['hunter', 'snov'] })

// ❌ Неправильно — строковая ошибка
throw new Error('email not found')
```

### Database queries
```typescript
// ✅ Правильно — workspace_id ВСЕГДА
const companies = await db.query.companies.findMany({
  where: and(
    eq(companies.workspaceId, ctx.workspaceId),   // ← ОБЯЗАТЕЛЬНО
    eq(companies.status, 'QUALIFIED')
  )
})

// ❌ КРИТИЧЕСКАЯ ОШИБКА — без workspace_id
const companies = await db.query.companies.findMany({
  where: eq(companies.status, 'QUALIFIED')
})
```

### API endpoints
```typescript
// Структура route handlers
// apps/api/src/routes/companies/create.ts
export const createCompanyRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/companies', {
    schema: { body: createCompanySchema },        // Zod-based schema
    preHandler: [fastify.authenticate, fastify.requireRole(['admin', 'manager'])]
  }, async (request, reply) => {
    const result = await companiesService.create(request.body, request.workspace)
    return reply.status(201).send({ data: result })
  })
}
// Бизнес-логика → только в service, не в route handler
```

---

## 7. Структура env переменных

```bash
# .env.example — все нужные переменные
# НИКОГДА не добавляй реальные значения в этот файл

# Database
DATABASE_URL=postgresql://app:password@localhost:5432/aisalesos

# Cache & Queue
REDIS_URL=redis://:password@localhost:6379

# Auth
JWT_SECRET=<256-bit-random>
JWT_REFRESH_SECRET=<256-bit-random>
ENCRYPTION_KEY=<32-byte-hex>    # Для шифрования API ключей в БД

# AI (система)
OPENAI_API_KEY=<key>
ANTHROPIC_API_KEY=<key>

# Email
MAILGUN_API_KEY=<key>
MAILGUN_DOMAIN=mail.yourdomain.com
BREVO_API_KEY=<key>             # Fallback

# Lead Sources
TWOGIS_API_KEY=<key>

# Enrichment
HUNTER_API_KEY=<key>
SNOV_API_KEY=<key>
DADATA_API_KEY=<key>

# Notifications
TELEGRAM_BOT_TOKEN=<token>

# App
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:3001
PORT=3001

# Monitoring (optional in dev)
SENTRY_DSN=<dsn>
```

---

## 8. Дерево зависимостей (Sprint план)

```
Sprint 1.1: Core Infrastructure
    ↓ (prerequisite for everything)
Sprint 1.2: CRM Core (Companies, Contacts, Deals)
    ↓
Sprint 1.3: Lead Generation + Enrichment
    │ (parallel with 1.2 once DB is ready)
Sprint 1.4: Email Outreach (Sequences, Campaigns, Sending)
    ↓
Sprint 2.1: AI Writer
    ↓
Sprint 2.2: AI Classifier + Auto-actions
    │ (parallel with 2.1)
Sprint 2.3: Telegram Notifications
    ↓
Sprint 3.x: Analytics, Polish, Billing
```

---

## 9. Тестовые сценарии (Acceptance Criteria для MVP)

### Сценарий 1: E2E happy path
```
1. Регистрация → создание workspace
2. Добавление email аккаунта (Mailgun)
3. Настройка ICP: "логистика, Москва, 50-200 сотрудников"
4. Запуск поиска → 2ГИС возвращает 50+ компаний
5. Enrichment запускается автоматически → email найден для 30+
6. Создание кампании → зачисление 20 лидов
7. AI генерирует персонализированное письмо
8. Email отправлен → открыт → ответ получен
9. AI классифицирует: "interested"
10. SDR уведомлён в Telegram
11. Task создан для SDR
```

### Сценарий 2: Изоляция тенантов (безопасность)
```
1. Workspace A создаёт 100 компаний
2. Workspace B не должен видеть ни одной из них
3. API запрос от Workspace B → 0 результатов
4. Прямой запрос с workspaceId из Workspace A → 403
```

### Сценарий 3: Resilience
```
1. OpenAI API недоступен → система переключается на Anthropic
2. Anthropic недоступен → используется шаблон + уведомление
3. Hunter.io вернул 0 результатов → пробует Snov.io
4. Redis упал → workers фиксируют ошибку, API продолжает работать
5. Email hard bounce → контакт помечается invalid, enrollment останавливается
```

---

## 10. Приоритизированный список следующих задач

### ⚡ Немедленно (неделя 1)
1. `pnpm monorepo init` с Turborepo
2. `docker-compose.yml` (postgres + redis)
3. `packages/db` — Drizzle schema (workspaces, users, companies, contacts)
4. `apps/api` — Fastify boilerplate + health endpoint
5. JWT authentication (Better Auth)
6. Workspace middleware + RLS setup

### 🔥 Срочно (недели 2-4)
7. Companies CRUD API
8. Contacts CRUD API
9. CSV import
10. `apps/web` — Next.js + shadcn/ui + login page
11. Companies list UI (TanStack Table)

### 📅 Важно (недели 5-8)
12. Plugin Registry + interfaces
13. 2ГИС plugin implementation
14. HH.ru plugin implementation
15. ЕГРЮЛ/Dadata plugin
16. Enrichment queue (BullMQ)
17. Hunter.io email finder plugin
18. Email sequence builder
19. Mailgun plugin + sending
20. Webhook tracking
21. AI Writer Agent
22. AI Classifier Agent
23. Telegram notifications

---

## 11. Команды для запуска (когда код будет готов)

```bash
# Установка зависимостей
pnpm install

# Dev окружение
docker compose up -d        # PostgreSQL + Redis
pnpm dev                    # Все сервисы через Turborepo

# Только API
pnpm --filter @aisalesos/api dev

# Только Web
pnpm --filter @aisalesos/web dev

# Database migrations
pnpm --filter @aisalesos/db migrate

# Тесты
pnpm test                   # Все тесты
pnpm --filter @aisalesos/api test:unit
pnpm --filter @aisalesos/api test:integration

# Type check
pnpm type-check

# Линтинг
pnpm lint

# Сборка для production
pnpm build
```

---

## 12. Контакты и ресурсы

### Ключевые внешние ресурсы
| Сервис | Документация | Цены |
|--------|-------------|------|
| OpenAI API | platform.openai.com/docs | $0.005/1K tokens (gpt-4o-mini) |
| 2ГИС API | dev.2gis.com | Free tier 25K requests/day |
| HH.ru API | dev.hh.ru | Free, rate limited |
| Dadata | dadata.ru/api | Free tier 10K/day |
| Hunter.io | hunter.io/api-documentation | Free tier 25/month |
| Mailgun | documentation.mailgun.com | $35/50K emails |
| BullMQ | docs.bullmq.io | Free |
| Drizzle ORM | orm.drizzle.team | Free |
| Better Auth | better-auth.com/docs | Free |

### ADRs (почему мы используем именно эти технологии)
- Monorepo: ADR-001
- TypeScript/Node.js: ADR-002
- Fastify: ADR-003
- PostgreSQL + Drizzle: ADR-004
- BullMQ: ADR-005
- shadcn/ui: ADR-006
- Мультитенантность через RLS: ADR-007
- OpenAI primary: ADR-008
- Next.js App Router: ADR-009
- Mailgun: ADR-010
- Только легальные API: ADR-011

Полные тексты: `docs/15-adr.md`

---

## 13. Финальный чеклист перед первым коммитом

- [ ] Прочитал `PROJECT_BIBLE.md` полностью
- [ ] Прочитал `docs/domain_model.md`
- [ ] Прочитал `docs/event_flow.md`
- [ ] Прочитал `docs/plugin_architecture.md`
- [ ] Понял разницу между Company и Lead
- [ ] Понял, что workspace_id — в каждом запросе
- [ ] Знаю, какой следующий Sprint и что в нём делать
- [ ] Настроил `.env` локально по `.env.example`
- [ ] Запустил `docker compose up` и убедился что Postgres и Redis работают
