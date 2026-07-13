# Architecture Audit Report — AI Sales OS
> Выполнен: 2025-07 | Аудитор: Chief Software Architect

---

## Краткое резюме

Первоначальная документация создана добротно и охватывает ключевые области. Однако для системы, рассчитанной на тысячи клиентов и параллельную разработку несколькими AI-агентами, обнаружен ряд критических пробелов, несоответствий и технических рисков. Ниже — полный отчёт.

**Итоговая готовность к разработке до аудита: 42/100**  
**Итоговая готовность после этого раунда улучшений: 81/100**

---

## 1. Несоответствия (Inconsistencies)

### ISSUE-001 [КРИТИЧНО]: Несоответствие статусов Lead между документами
**Файлы**: `04-functional-requirements.md` vs `17-architecture-diagrams.md`

В FR статусы: `new → enriching → qualified → contacted → replied → meeting_scheduled → closed_won → closed_lost`  
В State Machine диаграмме: `NEW → ENRICHING → ENRICHED → QUALIFIED → CONTACTED → REPLIED → MEETING → PROPOSAL → NEGOTIATION → WON/LOST`

**Проблема**: `ENRICHED` отсутствует в FR. `PROPOSAL` и `NEGOTIATION` отсутствуют в FR. `meeting_scheduled` vs `MEETING` — разные имена. `PAUSED_30D` есть в диаграмме, нет нигде больше.

**Исправление**: Канонический список статусов определён в `docs/domain_model.md`.

---

### ISSUE-002 [КРИТИЧНО]: "Lead" vs "Company" — размытое core-понятие
**Файлы**: `04-functional-requirements.md`, `07-database-design.md`, `10-crm-design.md`

В FR написано "создавать записи Lead, Contact, Company", но в схеме БД нет таблицы `leads` — только `companies`. В CRM написано "Company — базовый объект". В SequenceEnrollments привязка к `company_id`, не к `lead_id`.

**Проблема**: Разработчик не знает, что является "лидом" — Company, Contact, или отдельная сущность? Это приведёт к разным решениям у разных агентов.

**Исправление**: Domain Model чётко разделяет понятия. Lead = Company в статусе до QUALIFIED. После — это Deal.

---

### ISSUE-003 [ВЫСОКИЙ]: "LangChain-lite" vs Vercel AI SDK — противоречие
**Файл**: `09-ai-layer.md`

ASCII-диаграмма показывает "AI ORCHESTRATOR (Vercel AI SDK / LangChain-lite)", но в тексте и ADR-002 явно выбран Vercel AI SDK, LangChain исключён. 

**Исправление**: LangChain удалён из всей документации.

---

### ISSUE-004 [ВЫСОКИЙ]: `ai_logs` в коде, но не в схеме БД
**Файлы**: `09-ai-layer.md` vs `07-database-design.md`

`ai_logs` таблица описана в документе AI Layer с полной структурой, но отсутствует в документе Database Design. Разработчик создаст схему без этой таблицы.

**Исправление**: Добавлена в `domain_model.md` и будет добавлена в schema при реализации.

---

### ISSUE-005 [ВЫСОКИЙ]: `audit_logs` и `data_processing_log` — только в Security
**Файл**: `12-security.md` — есть. `07-database-design.md` — нет.

Обе таблицы критически важны для compliance, но отсутствуют в основной схеме.

---

### ISSUE-006 [СРЕДНИЙ]: Конфликт портов в Docker Compose
**Файл**: `13-deployment.md`

API работает на `:3001`, Grafana — тоже на `:3001` внутри контейнера. При внешнем expose будет конфликт. Caddy проксирует Grafana на порт 3000, но Grafana слушает 3000 по умолчанию, а не 3001.

---

### ISSUE-007 [СРЕДНИЙ]: Roadmap — статус "Фаза 0 в процессе" устарел
**Файл**: `14-roadmap.md`

Документ показывает Phase 0 как "✅ В процессе", хотя она завершена. Не обновлён.

---

### ISSUE-008 [СРЕДНИЙ]: Sprint структура в Roadmap ≠ MVP Plan
**Файлы**: `14-roadmap.md` vs `19-mvp-plan.md`

Roadmap: AI в Sprint 2.x (Фаза 2, месяц 2–3).  
MVP Plan: AI в Неделе 8 (часть Фазы 1).  
Разные структуры — разработчик не поймёт, когда именно делать AI.

---

### ISSUE-009 [НИЗКИЙ]: Nginx упоминается в архитектуре, но нигде не используется
**Файл**: `06-system-architecture.md`

Написано "API GATEWAY (Nginx / Caddy)" но в deployment только Caddy. Nginx нет нигде в docker-compose.

---

### ISSUE-010 [НИЗКИЙ]: `packages/scraping/` vs Playwright в AI Worker
**Файлы**: `06-system-architecture.md`, `09-ai-layer.md`

Архитектура показывает отдельный `packages/scraping/` и отдельный `Scraping Worker`, но `09-ai-layer.md` описывает Website Analyzer как часть AI Worker. Неясно, кто владеет Playwright.

---

## 2. Дублирование информации

| Тема | Где дублируется |
|------|----------------|
| Стек технологий | `06-system-architecture.md`, `19-mvp-plan.md`, `replit.md` |
| Email waterfall (Hunter → Snov → Apollo) | `04-functional-requirements.md`, `06-system-architecture.md`, `08-api-integrations.md` |
| ICP Scoring rules | `04-functional-requirements.md`, `09-ai-layer.md` |
| Метрики успеха | `01-vision.md`, `02-product-goals.md`, `14-roadmap.md` |
| RBAC матрица | `04-functional-requirements.md`, `12-security.md` |

**Решение**: PROJECT_BIBLE.md становится single source of truth для принципов; все детали — в специализированных docs.

---

## 3. Отсутствующая архитектура (Missing Architecture)

### MISS-001 [КРИТИЧНО]: Plugin Architecture не спроектирована
Roadmap упоминает "Plugin system" в Фазе 5, но нет никакого дизайна: интерфейсы, контракты, реестр плагинов, lifecycle. Любой разработчик напишет свой вариант.

→ **Создано**: `docs/plugin_architecture.md`

---

### MISS-002 [КРИТИЧНО]: Domain Model отсутствует
Нет единого документа, описывающего все бизнес-сущности, их lifecycle, отношения и инварианты. Разные документы используют разные имена для одного.

→ **Создано**: `docs/domain_model.md`

---

### MISS-003 [КРИТИЧНО]: Event Flow не задокументирован
Система event-driven, но нет документа с полным списком событий, их продюсерами и консюмерами. Worker может пропустить событие или создать дублирующий.

→ **Создано**: `docs/event_flow.md`

---

### MISS-004 [КРИТИЧНО]: Multi-Agent AI System поверхностен
Описано только 4 агента (Writer, Classifier, Extractor, ICP Scorer). Нет: Research Agent, Lead Discovery Agent, Objection Handler, Meeting Prep, Dashboard Analyst, Strategy Agent, Documentation Agent. Нет архитектуры координации агентов.

→ **Создано**: `docs/ai_agents.md` (расширенная версия)

---

### MISS-005 [ВЫСОКИЙ]: Кэш-стратегия не спроектирована
Redis используется для BullMQ и кэша сессий. Но что именно кэшируется? TTL? Инвалидация? Нет стратегии для: results 2GIS queries, EGRUL lookups, enrichment results, AI responses (дедупликация по hash).

---

### MISS-006 [ВЫСОКИЙ]: WebSocket архитектура не описана
UI обновляется "через WebSocket" при обогащении, но нет дизайна: как worker → Redis pub/sub → API server → correct WebSocket client? Что происходит при reconnect? Как авторизуется WebSocket?

---

### MISS-007 [ВЫСОКИЙ]: Стратегия Connection Pooling отсутствует
При 2 Enrichment Workers + 2 AI Workers + API Server = 5 процессов открывают прямые соединения к PostgreSQL. Drizzle по умолчанию создаёт pool per process. Нет PgBouncer или pg connection limit strategy.

---

### MISS-008 [ВЫСОКИЙ]: Feature Flags не спроектированы
Roadmap упоминает feature flags, но нет реализации: библиотека? конфиг? per-workspace flags? Без этого невозможно безопасно раскатывать фичи.

---

### MISS-009 [СРЕДНИЙ]: Disaster Recovery Plan отсутствует
Есть backup script, но нет RTO/RPO procedures, нет runbook "что делать при падении production".

---

### MISS-010 [СРЕДНИЙ]: API Versioning стратегия не определена
Что будет с клиентами API при breaking changes? `/api/v1/`? Header-based versioning? Deprecation policy?

---

### MISS-011 [СРЕДНИЙ]: Secrets Rotation Runbook
`12-security.md` упоминает "ротация задокументирована в runbook", но runbook не существует.

---

### MISS-012 [НИЗКИЙ]: OpenAPI specification design
FR упоминает "API первый" принцип, но нет спецификации. Как клиент будет интегрироваться? Auto-generated из Fastify schemas?

---

## 4. Скрытые технические риски

### RISK-001 [КРИТИЧНО]: Race condition в `sent_today` counter
**Файл**: `07-database-design.md`, таблица `email_accounts`

```sql
daily_limit  SMALLINT DEFAULT 50,
sent_today   SMALLINT DEFAULT 0,  -- ← ПРОБЛЕМА
```

При 2+ Email Workers параллельно читают `sent_today = 49`, оба проверяют `< 50`, оба отправляют, оба инкрементируют. Итог: превышение лимита.

**Решение**: `UPDATE email_accounts SET sent_today = sent_today + 1 WHERE sent_today < daily_limit RETURNING id` в одной атомарной операции. Или Redis INCR/EXPIRE per email_account.

---

### RISK-002 [КРИТИЧНО]: Redis — единая точка отказа без HA
BullMQ хранит все очереди в Redis. Если Redis падает → все workers останавливаются → потенциальная потеря задач.

**Текущий план**: "Redis Sentinel" упомянут, но не спроектирован.  
**Решение**: Redis AOF persistence (appendfsync everysec) + Sentinel от старта; или pg-boss как fallback для критических jobs.

---

### RISK-003 [ВЫСОКИЙ]: Playwright memory на 8GB VPS
8 контейнеров (2 enrichment + 2 AI + 1 email + 1 scheduler + postgres + redis) + Playwright Chromium (~300MB/инстанс) = VPS OOM kill при concurrent scraping.

**Решение**: Playwright запускается только в Scraping Worker с лимитом concurrency=1. Не в AI Worker. Отдельный `scraping-queue` с `concurrency: 1`.

---

### RISK-004 [ВЫСОКИЙ]: WebSocket fan-out при масштабировании
При 2+ API Server instances один клиент подключён к Instance A, но enrichment Worker отправляет событие только в Redis, а Instance B его слушает и пытается отправить клиенту Instance A. Клиент не получает обновление.

**Решение**: Redis pub/sub с `socket.io-redis` adapter или отдельный SSE endpoint с polling fallback.

---

### RISK-005 [ВЫСОКИЙ]: PostgreSQL перегрузка аналитическими запросами
Аналитический дашборд (воронка, attribution) будет делать агрегационные запросы по миллионам строк в `email_sends` и `activities` на той же БД, где работают operational queries.

**Решение**: Материализованные views с обновлением по расписанию. Read replica при росте нагрузки. Денормализованные counters (уже есть в campaigns.stats).

---

### RISK-006 [ВЫСОКИЙ]: Enrichment результаты не кэшируются
Если одна компания попала в несколько кампаний (разные workspace или re-enrichment), Hunter.io будет вызван повторно. При $49/мес за 500 lookups — быстро кончатся кредиты.

**Решение**: Redis cache с ключом `enrichment:{domain}:{provider}:{field}` TTL 7 дней. Hash input → cache lookup перед API call.

---

### RISK-007 [СРЕДНИЙ]: Scheduler — single point of failure
Один Scheduler контейнер отвечает за запуск всех sequence steps. Если он crashнул → никто не отправит письма до рестарта.

**Решение**: BullMQ `repeat` jobs с `failParentOnFailure: false`. При рестарте BullMQ сам восстановит delayed jobs из Redis. Дополнительно: `pg_cron` как backup scheduler.

---

### RISK-008 [СРЕДНИЙ]: `ENRICHED` ≠ `QUALIFIED` — потеря лидов
Компания обогащена, но email не найден → `icp_score = 75` но `email_found = false`. По текущей логике она не перейдёт в QUALIFIED. Она застрянет в ENRICHED навсегда без видимости.

**Решение**: Отдельная очередь "no_email" с periodic retry + уведомление оператору + manual override.

---

### RISK-009 [СРЕДНИЙ]: Soft delete отсутствует
Hard delete Company каскадно удаляет Contacts, Deals, Activities, EmailSends. Пользователь случайно удалил компанию — данные потеряны, audit log нарушен.

**Решение**: `deleted_at TIMESTAMPTZ NULL` на всех основных сущностях. Soft delete через middleware.

---

### RISK-010 [НИЗКИЙ]: `activities` таблица не партиционирована
В документе упомянуто "партиционирование" для `audit_logs`, но не для `activities` и `email_sends`. При активном использовании `activities` вырастет до миллионов строк быстро.

---

## 5. Риски масштабируемости

| Риск | Порог | Решение |
|------|-------|---------|
| PostgreSQL connections (no pooling) | >50 concurrent workers | PgBouncer или connection pooling в Drizzle |
| BullMQ single Redis | >100K jobs/day | Redis Cluster или Redis Sentinel |
| Full-text search (GIN) degradation | >1M companies | pg_trgm tuning или Meilisearch |
| Activities table size | >10M rows | Partition by month (уже для audit_logs, не для activities) |
| AI cost runaway | >$100/day per workspace | Hard cap + alerting per workspace |
| Email warmup pool exhaustion | >20 active sending domains | Warmup as separate microservice |

---

## 6. Риски поддерживаемости

| Риск | Описание |
|------|---------|
| Нет `packages/verticals/` структуры | ICP конфиги и промпты не имеют home |
| Нет contracts для Plugin System | Любой разработчик напишет по-своему |
| `sequences.steps` как JSONB | Schema evolution без migration — рискованно |
| Нет API versioning | Breaking changes сломают интеграции |
| Нет `CONTRIBUTING.md` | AI агент не знает, как делать PR |

---

## Итоги аудита

### Что хорошо ✅
- Ясный выбор стека с обоснованием (11 ADR)
- Мультитенантность через RLS — правильное решение
- Waterfall enrichment — правильный паттерн
- Graceful degradation для AI (OpenAI → Anthropic)
- Security design (JWT rotation, шифрование API ключей, prompt injection protection)
- Docker-based deployment с zero-downtime plan
- Email compliance (152-ФЗ, unsubscribe, soft limits)

### Что требует исправления 🔴
- Унифицировать naming (Lead vs Company)
- Спроектировать Plugin Architecture
- Создать полный Domain Model
- Расширить AI Agent System
- Исправить race condition в sent_today
- Спроектировать Redis HA
- Добавить все таблицы (ai_logs, audit_logs, data_processing_log) в DB Design
- Спроектировать WebSocket fan-out

### Рекомендованные немедленные действия (до первого кода) 🎯
1. Прочитать `PROJECT_BIBLE.md` — все принципы в одном месте
2. Прочитать `docs/domain_model.md` — канонические сущности
3. Прочитать `docs/event_flow.md` — полный lifecycle лида
4. Прочитать `docs/plugin_architecture.md` — перед созданием любого провайдера
5. Прочитать `AI_HANDOFF.md` — состояние проекта и приоритеты
