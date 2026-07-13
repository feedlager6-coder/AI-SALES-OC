# System Architecture — AI Sales OS

## Архитектурный стиль

**Модульный монолит → Сервисы по необходимости**

### Почему не микросервисы сразу:
На MVP-стадии микросервисы — преждевременная оптимизация. Они добавляют: сетевые вызовы, distributed tracing, service mesh, сложный деплой, несколько БД. Модульный монолит даёт скорость разработки + возможность выделить горячие модули в отдельные сервисы при реальной нагрузке.

**Граница выделения**: если модуль потребляет > 30% CPU или требует независимого масштабирования — выделяем в отдельный сервис. Кандидат #1 — AI Worker.

---

## Высокоуровневая архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                  │
│   Web App (React/Next.js)    Telegram Bot    External API        │
└──────────────────┬──────────────────────────────────────────────┘
                   │ HTTPS / WebSocket
┌──────────────────▼──────────────────────────────────────────────┐
│                    API GATEWAY (Nginx / Caddy)                    │
│         Rate Limiting │ TLS Termination │ Auth Headers            │
└──────────────────┬──────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────────┐
│               APPLICATION SERVER (Node.js / Fastify)             │
│  ┌─────────────┐ ┌─────────────┐ ┌───────────┐ ┌────────────┐  │
│  │ Auth Module │ │  CRM Module │ │ Campaign  │ │ Analytics  │  │
│  │  (JWT/SSO)  │ │ Leads/Deals │ │  Module   │ │  Module    │  │
│  └─────────────┘ └─────────────┘ └───────────┘ └────────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌───────────┐                  │
│  │ Enrichment  │ │  Sequence   │ │Integrations│                  │
│  │  Orchestr.  │ │   Engine    │ │  Manager  │                  │
│  └─────────────┘ └─────────────┘ └───────────┘                  │
└──────────┬───────────────────────────────────────────────────────┘
           │ Job Dispatch
┌──────────▼───────────────────────────────────────────────────────┐
│                    QUEUE LAYER (BullMQ + Redis)                   │
│  enrichment-queue │ email-queue │ ai-queue │ scraping-queue       │
└──────────┬────────────────────────────────────────────────────────┘
           │
┌──────────▼────────────────────────────────────────────────────────┐
│                       WORKERS (Node.js)                            │
│  ┌──────────────┐ ┌───────────────┐ ┌──────────────────────────┐  │
│  │  Enrichment  │ │  Email Worker │ │      AI Worker           │  │
│  │    Worker    │ │  (send/track) │ │ (generate/classify/score)│  │
│  └──────────────┘ └───────────────┘ └──────────────────────────┘  │
│  ┌──────────────┐ ┌───────────────┐                                │
│  │  Scraping    │ │   Scheduler   │                                │
│  │   Worker     │ │  (cron jobs)  │                                │
│  └──────────────┘ └───────────────┘                                │
└────────────────────────────────────────────────────────────────────┘
           │
┌──────────▼────────────────────────────────────────────────────────┐
│                         DATA LAYER                                 │
│  ┌──────────────┐ ┌───────────────┐ ┌────────────────────────┐   │
│  │  PostgreSQL  │ │     Redis     │ │     S3 / MinIO         │   │
│  │  (primary)   │ │  (cache/queue)│ │  (files, attachments)  │   │
│  └──────────────┘ └───────────────┘ └────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
           │
┌──────────▼────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                                │
│  OpenAI │ Anthropic │ 2GIS API │ HH.ru API │ Hunter.io            │
│  Mailgun/Brevo/SES │ Telegram Bot API │ egrul.nalog.ru            │
└────────────────────────────────────────────────────────────────────┘
```

---

## Технологический стек

### Backend
| Компонент | Технология | Обоснование |
|-----------|-----------|------------|
| Runtime | Node.js 22 (LTS) | Отличная async I/O для IO-heavy workloads; единый язык frontend+backend |
| Framework | Fastify | В 3x быстрее Express; TypeScript-first; plugin ecosystem; JSON schema validation |
| ORM | Drizzle ORM | Type-safe SQL; миграции как код; нет overhead Prisma; хорошая поддержка PostgreSQL |
| Queue | BullMQ | Redis-based; 6.4M загрузок/нед; retry, delay, priority, rate limiting из коробки |
| AI SDK | Vercel AI SDK | Unified интерфейс к OpenAI/Anthropic/Mistral; streaming; tool calls |
| Validation | Zod | Единая схема для runtime validation + TypeScript types |
| Auth | Better Auth | Современная, TypeScript-native; JWT + sessions; OAuth2 providers |

### Frontend
| Компонент | Технология | Обоснование |
|-----------|-----------|------------|
| Framework | Next.js 15 (App Router) | SSR/SSG; RSC; встроенный роутинг; deploy везде |
| UI Library | shadcn/ui + Tailwind CSS | Доступные компоненты; не vendor lock-in (копируется в проект); tailwind-native |
| State | Zustand + TanStack Query | Zustand — простой глобальный state; TanStack Query — server state, caching, refetch |
| Tables | TanStack Table | Мощные виртуализированные таблицы для больших списков лидов |
| Charts | Recharts | React-native; лёгкий; достаточно для дашборда |
| Forms | React Hook Form + Zod | Shared Zod schemas с backend |

### Инфраструктура
| Компонент | Технология | Обоснование |
|-----------|-----------|------------|
| База данных | PostgreSQL 16 | Строгая типизация; JSONB для гибких полей; Row-Level Security; full-text search |
| Кэш / Очередь | Redis 7 | BullMQ требует Redis; кэш сессий; pub/sub для real-time |
| Хранилище | MinIO (self-hosted) / S3 | S3-совместимый API; самохостинг для суверенности данных |
| Деплой | Docker + Docker Compose → Kubernetes | Compose для разработки; K8s для production scale |
| CI/CD | GitHub Actions | Бесплатно; интеграция с Docker Hub и облаками |
| Мониторинг | Grafana + Prometheus + Loki | Open-source; единый стек наблюдаемости |

---

## Модульная структура (monorepo)

```
ai-sales-os/
├── apps/
│   ├── web/                    # Next.js frontend
│   ├── api/                    # Fastify backend
│   └── workers/                # Background workers
├── packages/
│   ├── db/                     # Drizzle schema + migrations
│   ├── ai/                     # AI prompts + wrappers
│   ├── email/                  # Email templates + sending
│   ├── enrichment/             # Enrichment providers
│   ├── scraping/               # Scrapers (2GIS, HH, etc.)
│   ├── queue/                  # BullMQ job definitions
│   ├── types/                  # Shared TypeScript types
│   └── config/                 # Shared configuration
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   └── k8s/                    # Kubernetes manifests
└── docs/                       # Этот раздел
```

**Почему монорепозиторий**: shared types, единые миграции, один PR охватывает frontend + backend + workers, атомарные релизы.

---

## Потоки данных (ключевые сценарии)

### 1. Создание и обогащение лида

```
Trigger (2GIS search / CSV import / manual)
    │
    ▼
API Server: создать Lead запись (status=new)
    │
    ▼
Dispatch → enrichment-queue (job: enrich_lead, leadId)
    │
    ▼
Enrichment Worker:
  1. ЕГРЮЛ lookup (ИНН → официальные данные)
  2. HH.ru lookup (вакансии → боли)
  3. Waterfall email:
     Hunter.io → Snov.io → Apollo → pattern-based
  4. Email verify (MX + SMTP check)
  5. AI website analysis (Playwright → GPT extract)
    │
    ▼
Update Lead (status=enriched, score=75)
    │
    ▼
Notify via WebSocket → UI обновляется без перезагрузки
```

### 2. Запуск email-последовательности

```
Campaign activated (manual or auto trigger)
    │
    ▼
Sequence Engine: для каждого лида в кампании
    → создать SequenceEnrollment
    → создать SequenceStep[0] (send_email, scheduled_at = now)
    │
    ▼
Email Queue: job появляется в нужное время
    │
    ▼
Email Worker:
  1. Загрузить шаблон + данные лида
  2. AI Worker: генерация персонализированного письма
  3. Mailgun/Brevo API: отправить
  4. Записать EmailSend (status=sent)
    │
    ▼
Tracking Webhook (Mailgun → /webhooks/email):
  open → update EmailSend.opened_at
  click → update EmailSend.clicked_at
  reply → update EmailSend.replied_at
          dispatch → ai-queue (classify reply)
    │
    ▼
AI Worker: классификация ответа
    → update SequenceEnrollment.status
    → если interested → создать Task для SDR
    → уведомить через Telegram Bot
```

---

## Паттерны и решения

### Идемпотентность задач
Каждый job имеет уникальный `jobId = {type}:{entityId}:{hash}`. Повторное добавление в очередь — safe, BullMQ отдедуплицирует по ключу.

### Трейсинг лида
Каждый лид имеет `lead_id`. Все события (enrichment, emails, replies, status changes) хранятся с `lead_id` — полная аудит-цепочка.

### Мультитенантность
Каждый запрос аутентифицирован JWT с `workspace_id`. Middleware автоматически добавляет `WHERE workspace_id = ?` к каждому запросу. PostgreSQL RLS как дополнительный защитный уровень.

### Graceful degradation AI
Если OpenAI недоступен → fallback на Anthropic. Если оба недоступны → используется шаблонное письмо с предупреждением оператору.
