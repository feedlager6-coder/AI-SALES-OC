# AI Sales OS

## Обзор проекта

**AI Sales OS** — масштабируемая платформа автоматизации B2B-продаж. Первый продукт: автоматизированные продажи SaaS-сервиса оптимизации маршрутов транспорта. Архитектура универсальна для любых B2B SaaS вертикалей.

### Что делает система:
1. Автоматически находит потенциальных клиентов (2ГИС, HH.ru, ЕГРЮЛ)
2. Обогащает лиды данными (email, ФИО руководителя, боли компании)
3. Генерирует персонализированные письма через AI (GPT-4o / Claude)
4. Ведёт многошаговые email-последовательности
5. Классифицирует ответы и уведомляет SDR через Telegram
6. CRM с полным lifecycle лида

---

## Технологический стек

| Слой | Технология |
|------|-----------|
| Frontend | Next.js 15 (App Router), shadcn/ui, Tailwind CSS 4 |
| Backend | Node.js 22, Fastify 5, Zod |
| ORM | Drizzle ORM |
| Queue | BullMQ (Redis) |
| AI | Vercel AI SDK (OpenAI GPT-4o + Anthropic Claude) |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Storage | MinIO / S3 |
| Deploy | Docker Compose → Hetzner VPS |
| CI/CD | GitHub Actions |

---

## Состояние проекта

**Текущая фаза**: Phase 0 завершена (документация и архитектура)  
**Следующий шаг**: Phase 1, Sprint 1.1 — настройка monorepo и инфраструктуры  
**Готовность к разработке**: 81/100

---

## Ключевые документы (читать в таком порядке)

1. **`PROJECT_BIBLE.md`** — единый источник истины: принципы, соглашения, folder structure
2. **`AI_HANDOFF.md`** — текущее состояние проекта и следующие шаги
3. **`docs/domain_model.md`** — все бизнес-сущности (Company, Contact, Deal...)
4. **`docs/event_flow.md`** — полный lifecycle лида от поиска до сделки
5. **`docs/plugin_architecture.md`** — как добавлять провайдеров (2GIS, Hunter, Mailgun...)
6. **`docs/ai_agents.md`** — 13 AI-агентов системы
7. **`docs/15-adr.md`** — 11 архитектурных решений с обоснованием
8. **`docs/00-audit-report.md`** — архитектурный аудит: риски и несоответствия

---

## Критические соглашения

### Именование
- Основная сущность = **Company** (не Lead, не Prospect)
- "Лид" разговорно = Company в статусе до QUALIFIED
- В коде нет таблицы `leads`

### Безопасность
- `workspace_id` обязателен в КАЖДОМ запросе к данным
- PostgreSQL RLS + application-level check = двойная защита
- Soft delete везде: `deleted_at TIMESTAMPTZ NULL`

### Архитектура
- Plugin Interface для КАЖДОГО внешнего провайдера
- Все async операции — через BullMQ Queue (не HTTP sync)
- Все AI вызовы — через `BaseAgent` с fallback chain

---

## Folder Structure

```
ai-sales-os/
├── PROJECT_BIBLE.md      ← Читать первым
├── AI_HANDOFF.md         ← Текущее состояние
├── CONTRIBUTING.md       ← Как делать PR
├── apps/
│   ├── web/              # Next.js 15
│   ├── api/              # Fastify backend
│   └── workers/          # BullMQ workers
├── packages/
│   ├── db/               # Drizzle schema + migrations
│   ├── plugins/          # Plugin system (interfaces + implementations)
│   ├── ai/               # AI agents + prompts
│   ├── queue/            # Job definitions
│   ├── types/            # Shared TypeScript types
│   ├── config/           # Config loading
│   ├── logger/           # Pino factory
│   └── errors/           # Typed error classes
├── verticals/
│   ├── transport/        # ICP rules, prompts, source config
│   └── construction/     # (future)
├── infra/                # Docker, K8s
└── docs/                 # Полная документация
```

---

## User Preferences

- Документация на русском языке
- Код на TypeScript (strict mode)
- Архитектурные решения — через ADR в `docs/15-adr.md`
- Принцип: API-first, Plugin-first, Human-in-the-loop для критичных AI действий
- Мультитенантность: workspace_id + PostgreSQL RLS (двойная защита)
