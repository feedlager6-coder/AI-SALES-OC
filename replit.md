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
| Monitoring | Prometheus + Grafana |

---

## Структура проекта (будет создана в фазе разработки)

```
ai-sales-os/
├── apps/
│   ├── web/          # Next.js frontend
│   ├── api/          # Fastify backend
│   └── workers/      # Background workers (enrichment, email, AI)
├── packages/
│   ├── db/           # Drizzle schema + migrations
│   ├── ai/           # AI prompts + wrappers
│   ├── email/        # Email templates + sending
│   ├── enrichment/   # Enrichment providers
│   ├── scraping/     # Web scrapers (2GIS, HH, etc.)
│   ├── queue/        # BullMQ job definitions
│   ├── types/        # Shared TypeScript types
│   └── config/       # Shared configuration
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   └── k8s/
└── docs/             # Вся проектная документация
```

---

## Документация

Вся проектная документация в папке `docs/`:

| Файл | Содержание |
|------|-----------|
| `01-vision.md` | Видение, миссия, долгосрочные цели |
| `02-product-goals.md` | Продуктовые цели и KPI |
| `03-market-research.md` | Анализ рынка, конкуренты, API |
| `04-functional-requirements.md` | Функциональные требования |
| `05-non-functional-requirements.md` | NFR: производительность, безопасность |
| `06-system-architecture.md` | Архитектура системы, стек, модули |
| `07-database-design.md` | Схема БД (все таблицы) |
| `08-api-integrations.md` | Внешние API (2ГИС, HH, Hunter, etc.) |
| `09-ai-layer.md` | AI агенты: Writer, Classifier, Extractor |
| `10-crm-design.md` | Дизайн CRM, пайплайн, карточки |
| `11-ui-ux.md` | UI/UX дизайн, экраны, компоненты |
| `12-security.md` | Безопасность, auth, шифрование |
| `13-deployment.md` | Деплой, Docker, CI/CD, мониторинг |
| `14-roadmap.md` | Дорожная карта по фазам |
| `15-adr.md` | Architecture Decision Records (11 ADR) |
| `16-todo-backlog.md` | Полный бэклог задач |
| `17-architecture-diagrams.md` | Mermaid диаграммы (C4, ERD, flow) |
| `18-user-scenarios.md` | Пользовательские сценарии |
| `19-mvp-plan.md` | Детальный план MVP (8 недель) |

---

## Текущий статус

**Фаза 0: Исследование и проектирование** ✅ ЗАВЕРШЕНА

Следующий шаг: подтверждение от заказчика → переход к Фазе 1 (разработка MVP).

---

## User Preferences

- Язык общения: русский
- Стиль: Principal Software Architect — объяснять архитектурные решения с обоснованием
- На данном этапе: только исследование и документация, production-код не писать
- Архитектурный принцип: Modular Monolith → Services by necessity
- Приоритет: РФ-специфика (2ГИС, HH.ru, ЕГРЮЛ, Dadata, Telegram), только легальные источники данных
- Правило: любое архитектурное решение сопровождается объяснением "почему именно так"
