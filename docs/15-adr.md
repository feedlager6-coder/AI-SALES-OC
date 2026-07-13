# Architecture Decision Records (ADR)

ADR — документация архитектурных решений. Каждая запись фиксирует: что решили, почему именно так, какие альтернативы рассматривались и какие компромиссы приняты.

Формат: [Статус] → Proposed / Accepted / Deprecated / Superseded

---

## ADR-001: Монорепозиторий vs Polyrepo

**Статус**: ✅ Accepted  
**Дата**: 2025-07

### Решение
Использовать монорепозиторий (pnpm workspaces) для всех компонентов: web, api, workers, packages.

### Контекст
На старте команда маленькая (1–3 разработчика). Нужна скорость.

### Рассматривавшиеся альтернативы
- **Polyrepo**: каждый сервис в отдельном репозитории
- **Nx monorepo**: более тяжёлый инструментарий
- **Turborepo**: легче Nx, хорошо совместим с pnpm

### Обоснование выбора монорепо
- Atomic commits: frontend + backend + shared types в одном PR
- Shared packages без npm publishing (types, db schema, prompts)
- Единый CI/CD pipeline
- Проще онбординг нового разработчика

### Компромиссы
- При росте команды конфликты в PR; решение — feature flags + trunk-based development
- Build time растёт; решение — Turborepo кэширование

---

## ADR-002: TypeScript Node.js vs Python для Backend

**Статус**: ✅ Accepted  
**Дата**: 2025-07

### Решение
Node.js + TypeScript для backend API и workers.

### Рассматривавшиеся альтернативы
- **Python (FastAPI + Celery)**: лучше для AI/ML экосистемы
- **Go**: максимальная производительность, но нет shared types с frontend
- **Bun + TypeScript**: быстрее Node, но молодая экосистема

### Обоснование
- **Unified language**: один язык на frontend + backend + workers; разработчик может работать везде
- **Async I/O**: наша нагрузка IO-heavy (HTTP calls к внешним API), Node.js оптимален
- **Ecosystem**: npm has everything (BullMQ, Drizzle, Vercel AI SDK, Playwright)
- **TypeScript shared types**: Zod schema одна на frontend validation + backend validation + DB typing

### Почему не Python
- Python AI SDK (LangChain) перегружен для наших задач; Vercel AI SDK делает то же самое проще
- Нет shared types с React frontend — дублирование
- Celery сложнее в настройке чем BullMQ для нашего use case

### Компромиссы
- Если понадобятся сложные ML модели (fine-tuning) — Python microservice с Python-only задачами; вызывается через HTTP

---

## ADR-003: Fastify vs Express vs Hono

**Статус**: ✅ Accepted  
**Дата**: 2025-07

### Решение
Fastify как основной HTTP-фреймворк.

### Рассматривавшиеся альтернативы
- **Express**: самый распространённый, огромная экосистема
- **Hono**: edge-native, минималистичный
- **NestJS**: Enterprise-grade, очень opinionated

### Обоснование выбора Fastify
- **Производительность**: в ~3x быстрее Express (benchmarks fastify.io)
- **TypeScript-first**: нативная поддержка, не надо @types/
- **JSON Schema validation**: встроенная валидация запросов без middleware
- **Plugin ecosystem**: @fastify/jwt, @fastify/cors, @fastify/helmet готовы к продакшену
- **Structured logging**: Pino из коробки (быстрее Winston в 5x)

### Почему не NestJS
NestJS добавляет большой overhead и opinionated DI-контейнер. Для нашего размера — избыточно.

---

## ADR-004: PostgreSQL + Drizzle ORM vs Prisma vs TypeORM

**Статус**: ✅ Accepted  
**Дата**: 2025-07

### Решение
PostgreSQL 16 + Drizzle ORM.

### Рассматривавшиеся альтернативы
- **Prisma**: самый популярный ORM для TypeScript
- **TypeORM**: Active Record / Data Mapper pattern
- **Kysely**: type-safe query builder (не ORM)
- **Raw SQL**: максимальный контроль

### Обоснование Drizzle
- **Type-safe SQL**: генерирует TypeScript типы из схемы; ошибки на этапе компиляции
- **Zero overhead**: Drizzle не добавляет рантайм абстракций; прямой SQL
- **Миграции как код**: `drizzle-kit generate` → SQL migration файлы; прозрачно
- **JSONB поддержка**: нативная работа с PostgreSQL JSONB (нужно для custom_fields)

### Почему не Prisma
- Prisma Data Proxy добавляет latency
- Сложная интеграция с PostgreSQL RLS
- JSONB поддержка ограничена
- Нельзя использовать сырые SQL-фичи (PARTITION BY, CTEs) без $queryRaw

### Компромиссы
- Drizzle менее распространён; меньше StackOverflow ответов
- Нет built-in seeding; пишем сами

---

## ADR-005: BullMQ vs Temporal vs RabbitMQ для очередей

**Статус**: ✅ Accepted  
**Дата**: 2025-07

### Решение
BullMQ (Redis-based) для всех очередей.

### Рассматривавшиеся альтернативы
- **Temporal**: мощный workflow orchestrator (Uber, Netflix используют)
- **RabbitMQ**: классический message broker
- **Celery (Python)**: если бы выбрали Python
- **pg-boss**: PostgreSQL-native queues (нет Redis)

### Обоснование BullMQ
- **Простота**: добавить очередь = 10 строк кода; Temporal = отдельный сервер + DSL
- **Redis уже есть**: Redis нужен для кэша сессий; не добавляем зависимость
- **Функционал достаточен**: delay, retry с backoff, priority, rate limiting, bulk jobs
- **6.4M npm downloads/неделю**: зрелый, battle-tested
- **Хорошая документация**: dashboard (Bull Board), метрики

### Почему не Temporal
Temporal оправдан при: многоэтапных workflows с состоянием (saga pattern), compensation transactions, очень длинных процессах (недели). Наши workflows (обогащение лида = 5 шагов, 30 сек) — не требуют этой сложности. При росте — ADR-005-b рассмотрит переход.

### Компромиссы
- Redis — single point of failure; решение: Redis Sentinel для production
- BullMQ не персистирует задачи при Redis flush; решение: Redis persistence (AOF + RDB)

---

## ADR-006: shadcn/ui vs MUI vs Ant Design для UI

**Статус**: ✅ Accepted  
**Дата**: 2025-07

### Решение
shadcn/ui + Tailwind CSS.

### Рассматривавшиеся альтернативы
- **Material UI (MUI)**: Google Material Design
- **Ant Design**: Enterprise-grade, богатые компоненты
- **Mantine**: полный UI kit, хорошая документация
- **Chakra UI**: accessibility-focused

### Обоснование shadcn/ui
- **Не vendor lock-in**: компоненты копируются в проект; можно менять что угодно
- **Tailwind-native**: не CSS-in-JS; меньше runtime, легче кастомизация
- **Radix UI primitives**: accessibility из коробки (ARIA, keyboard nav)
- **Тёмная тема**: встроена с первого дня через CSS variables
- **Trendy**: лучшая developer experience в 2024–2025

### Почему не MUI
MUI — тяжёлый (emotion CSS-in-JS), сложно уйти от Material Design aesthetics. Наш продукт должен выглядеть как premium B2B tool, не Google.

### Почему не Ant Design
Chinese design system; сложно адаптировать под свой дизайн. Bundle size большой.

---

## ADR-007: Мультитенантность через RLS vs Отдельные схемы vs Отдельные БД

**Статус**: ✅ Accepted  
**Дата**: 2025-07

### Решение
Shared database, shared schema с `workspace_id` column + PostgreSQL RLS.

### Рассматривавшиеся альтернативы
- **Schema-per-tenant**: каждый тенант = отдельная PostgreSQL schema (`tenant_abc.companies`)
- **DB-per-tenant**: каждый тенант = отдельная база данных
- **Shared schema без RLS**: только application-level isolation

### Обоснование
- **Operational simplicity**: одна база данных, одни миграции; не надо деплоить 50 схем
- **RLS**: двойная изоляция без overhead schema-per-tenant
- **Масштаб MVP**: < 500 workspaces не требуют изоляции на уровне БД
- **Cost**: намного дешевле чем DB-per-tenant

### Когда пересмотреть
При > 1000 workspaces или требованиях enterprise клиента ("наши данные только на нашем сервере") — добавить schema-per-tenant как опцию (ADR-007-b).

---

## ADR-008: OpenAI vs Anthropic vs Self-hosted LLM

**Статус**: ✅ Accepted  
**Дата**: 2025-07

### Решение
Primary: OpenAI GPT-4o. Fallback: Anthropic Claude 3.5 Sonnet. Self-hosted: не в MVP.

### Рассматривавшиеся альтернативы
- **Self-hosted Llama 3 (Ollama)**: нет API cost, но нужен GPU сервер
- **Mistral**: дешевле, но хуже для русского языка
- **Yandex YandexGPT**: нативный русский, но закрытый API, меньше возможностей
- **GigaChat (Сбер)**: русский язык, но очень ограниченный API

### Обоснование
- **GPT-4o качество**: лучшее в классе для генерации русскоязычных деловых писем
- **Vercel AI SDK**: унифицированный интерфейс — легко добавить/заменить провайдера
- **Cost достаточен**: $0.005–0.015/письмо при 1000 писем/день = $5–15/день; приемлемо
- **Claude fallback**: другая архитектура модели; если OpenAI API down — переключаемся

### Почему не self-hosted сразу
GPU сервер = $500+/мес; для MVP неоправданно. При масштабе (>100K письма/день) — пересматриваем.

---

## ADR-009: Next.js App Router vs Pages Router vs Vite SPA

**Статус**: ✅ Accepted  
**Дата**: 2025-07

### Решение
Next.js 15 с App Router.

### Рассматривавшиеся альтернативы
- **Next.js Pages Router**: старый, стабильный, больше ресурсов
- **Vite + React SPA**: максимально простой, но нет SSR
- **Remix**: хорошая форм-модель, но меньше экосистема
- **SvelteKit**: лучший DX, но маленькое сообщество

### Обоснование App Router
- **React Server Components**: страницы с данными рендерятся на сервере; лучше Time to First Byte
- **Streaming**: progressive loading UI (важно для rich dashboards)
- **Layout system**: nested layouts без re-render (sidebar остаётся при навигации)
- **API Routes**: можно делать BFF (Backend For Frontend) прямо в Next.js
- **Vercel ecosystem**: даже если деплоим не на Vercel, инструменты (next/font, next/image) полезны

### Компромиссы
App Router — относительно новый (2023), some rough edges. Документация ещё не идеальна.

---

## ADR-010: Email Sending — Mailgun vs SES vs Brevo

**Статус**: ✅ Accepted  
**Дата**: 2025-07

### Решение
Primary: Mailgun. Fallback: Brevo.

### Рассматривавшиеся альтернативы
- **Amazon SES**: дешевле ($0.10/1000 emails), но сложная настройка, нет warmup dashboard
- **SendGrid**: дорогой ($89.95/мес за 100K), Twilio-owned
- **Postmark**: transactional-focused, дорого для cold email объёмов
- **Собственный SMTP**: максимальный контроль, но operational overhead огромный

### Обоснование Mailgun
- **Deliverability**: industry-leading reputation, хороший delivery в РФ
- **Webhooks**: детальные события (opened, clicked, bounced, complained) в реальном времени
- **API**: простой REST API, хорошая документация
- **Price**: $35/мес за 50K писем — приемлемо для MVP

### Brevo как fallback
€25/мес за 20K писем; отличная доставляемость в рунете; использовать при Mailgun downtime или для определённых доменов.

---

## ADR-011: Парсинг vs Официальные API для источников данных

**Статус**: ✅ Accepted  
**Дата**: 2025-07

### Решение
Только официальные API и легальные агрегаторы. Запрет на парсинг с нарушением ToS.

### Обоснование
- **Юридические риски**: Avito/LinkedIn активно судятся за scraping (hiQ v. LinkedIn прецедент)
- **Операционные риски**: IP-баны, CAPTCHA-блокировки, нестабильные данные
- **Репутационные риски**: клиенты не хотят использовать инструмент, работающий через "серые схемы"

### Граница допустимого
- ✅ Официальный API: 2ГИС, HH.ru, VK, Telegram (публичные данные)
- ✅ Агрегаторы: Dadata.ru (официальный партнёр ФНС), Hunter.io, Apollo.io
- ✅ Публичные данные ФНС (egrul.nalog.ru) с уважительными задержками
- ❌ Парсинг Avito, LinkedIn, Yell без разрешения
- ❌ Автоматизация личных аккаунтов социальных сетей

### Компромисс
Меньше источников данных для РФ-рынка. Митигация: качество > количество; waterfall enrichment из легальных источников даёт достаточно для MVP.
