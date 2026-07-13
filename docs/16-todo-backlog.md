# TODO / Backlog — AI Sales OS

> Живой документ. Обновляется по мере развития проекта.  
> Статусы: 🔲 Todo | 🔄 In Progress | ✅ Done | ❌ Cancelled | 🔜 Next Sprint

---

## 🔥 CRITICAL PATH (MVP must-have)

### Инфраструктура
- 🔲 Настройка monorepo (pnpm workspaces + Turborepo)
- 🔲 Docker Compose dev окружение (PostgreSQL + Redis + все сервисы)
- 🔲 Environment variables management (.env.example + secrets guide)
- 🔲 GitHub Actions: lint + type-check + test + build pipeline
- 🔲 Database migrations system (Drizzle Kit)
- 🔲 Seed data для разработки (тестовые компании, лиды)

### Аутентификация
- 🔲 Better Auth setup (JWT + refresh tokens)
- 🔲 Google OAuth (для удобного входа)
- 🔲 Workspace creation при регистрации
- 🔲 Invite users по email
- 🔲 Защита API routes (middleware)

### База данных
- 🔲 Схема: workspaces, users, companies, contacts, deals
- 🔲 Схема: campaigns, sequences, sequence_enrollments, email_sends
- 🔲 Схема: activities, tasks, enrichment_jobs, api_keys
- 🔲 PostgreSQL RLS политики
- 🔲 Индексы производительности (GIN для FTS, composite для частых запросов)

### CRM Core
- 🔲 Companies API (CRUD + list с фильтрами + пагинация)
- 🔲 Contacts API (CRUD + связь с Company)
- 🔲 Deals API (CRUD + pipeline management)
- 🔲 Activities API (создание + timeline)
- 🔲 Tasks API (create + assign + complete)
- 🔲 CSV import (parse + validate + preview + create)
- 🔲 Full-text search (PostgreSQL + pg_trgm для fuzzy)
- 🔲 ICP Scoring (rule-based engine)

### Lead Generation
- 🔲 2ГИС API client (поиск по категории + городу)
- 🔲 2ГИС: дедупликация по ID источника
- 🔲 HH.ru API client (работодатели + вакансии)
- 🔲 Dadata.ru API client (ЕГРЮЛ lookup по ИНН)
- 🔲 VK Groups API client (базовый)
- 🔲 Enrichment Queue (BullMQ)
- 🔲 Waterfall email discovery (Hunter → Snov → паттерн)
- 🔲 Email verification (MX + SMTP check)
- 🔲 Enrichment status tracking + retry logic

### Email Outreach
- 🔲 Email accounts CRUD (Mailgun credentials)
- 🔲 Sequence builder API (steps CRUD)
- 🔲 Campaign CRUD + enrollment logic
- 🔲 Email Queue (BullMQ) с rate limiting
- 🔲 Mailgun sending integration
- 🔲 Mailgun webhooks (delivered, opened, clicked, bounced, replied, unsubscribed)
- 🔲 Unsubscribe handling + global opt-out list
- 🔲 Sending schedule (рабочее время + timezone)

### Frontend (базовый)
- 🔲 Layout: sidebar + header + main
- 🔲 Auth pages: login, register, forgot password
- 🔲 Companies: list table + filters + карточка
- 🔲 Contacts: list + карточка
- 🔲 Deals: list + kanban pipeline
- 🔲 Activity timeline (на карточке компании)
- 🔲 Campaign builder UI (wizard 4 шага)
- 🔲 Sequence step editor
- 🔲 Email preview (rendered HTML)
- 🔲 Campaign stats (sent, opened, replied)
- 🔲 Tasks list + completion
- 🔲 Inbox (входящие ответы)
- 🔲 Global search (⌘K / Ctrl+K)

---

## 🤖 AI FEATURES

- 🔲 Vercel AI SDK setup (OpenAI + Anthropic providers)
- 🔲 Writer Agent (генерация писем)
- 🔲 Prompt templates (YAML) per vertical
- 🔲 Quality Check Agent (anti-spam + personalization score)
- 🔲 3 варианта письма + выбор в UI
- 🔲 Streaming генерации в UI
- 🔲 Reply Classifier Agent (10 классов намерения)
- 🔲 Auto-actions по классификации
- 🔲 Website Analyzer Agent (Playwright + GPT extract)
- 🔲 Vacancy Analyzer Agent (HH.ru signals)
- 🔲 AI ICP Scorer (гибридный rule + LLM)
- 🔲 AI cost tracking per workspace (token counter)
- 🔲 AI observability dashboard (cost, latency, quality)
- 🔲 Prompt versioning (audit trail изменений промптов)
- 🔲 Fallback: OpenAI down → Anthropic автоматически

---

## 📊 ANALYTICS

- 🔲 Воронка продаж (conversion by stage)
- 🔲 Email performance dashboard
- 🔲 Source attribution (откуда лид → сделка)
- 🔲 AI cost report
- 🔲 Campaign comparison (A/B результаты)
- 🔲 Export CSV/XLSX
- 🔲 Дашборд руководителя (top-5 KPI)

---

## 📱 INTEGRATIONS & NOTIFICATIONS

- 🔲 Telegram Bot setup (bot token + webhook)
- 🔲 Уведомления SDR: reply received, meeting requested
- 🔲 Telegram inline кнопки (быстрые действия)
- 🔲 Команды: /stats, /pause, /help
- 🔲 Мониторинг-алерты через Telegram
- 🔲 Slack integration (альтернатива Telegram) — P3

---

## 🔐 БЕЗОПАСНОСТЬ

- 🔲 Helmet.js security headers
- 🔲 Rate limiting (Fastify rate-limit)
- 🔲 AES-256 шифрование API ключей
- 🔲 Audit log (append-only таблица)
- 🔲 CSRF protection
- 🔲 Input sanitization (all endpoints)
- 🔲 RLS политики (все таблицы с workspace_id)
- 🔲 Security scan в CI (npm audit)
- 🔲 Penetration test перед production (basic)

---

## 🚀 ДЕПЛОЙ И ИНФРАСТРУКТУРА

- 🔲 Dockerfile для web (multi-stage build)
- 🔲 Dockerfile для api
- 🔲 Dockerfile для workers
- 🔲 docker-compose.prod.yml
- 🔲 Caddyfile (reverse proxy + TLS)
- 🔲 GitHub Actions: build + push GHCR + deploy via SSH
- 🔲 PostgreSQL backup script (daily)
- 🔲 Prometheus metrics endpoints
- 🔲 Grafana dashboards
- 🔲 Alertmanager → Telegram алерты
- 🔲 Healthcheck endpoints
- 🔲 Zero-downtime deployment (rolling update)

---

## 💰 МОНЕТИЗАЦИЯ

- 🔲 Тарифные планы (Starter/Pro/Enterprise)
- 🔲 Stripe / ЮКасса интеграция
- 🔲 Usage limits enforcement (лиды, emails, seats)
- 🔲 Trial период (14 дней)
- 🔲 Upgrade prompts в UI
- 🔲 Billing portal (invoices, plan change)

---

## 🎨 ONBOARDING & UX

- 🔲 Onboarding wizard (5 шагов)
- 🔲 Empty states с иллюстрациями и action buttons
- 🔲 Tooltips + product tours (первый визит)
- 🔲 Help documentation (Notion или in-app)
- 🔲 Error states с конкретными описаниями
- 🔲 Skeleton loading states

---

## 🧪 ТЕСТИРОВАНИЕ

- 🔲 Unit tests: enrichment waterfall logic
- 🔲 Unit tests: ICP scoring engine
- 🔲 Unit tests: sequence engine
- 🔲 Unit tests: AI prompt builders
- 🔲 Integration tests: API endpoints (Fastify inject)
- 🔲 Integration tests: database queries
- 🔲 Mock external APIs (Hunter, Mailgun, OpenAI)
- 🔲 E2E tests: onboarding flow (Playwright)
- 🔲 E2E tests: campaign creation + send
- 🔲 Load tests: 10K leads enrichment (k6)

---

## 📋 БУДУЩИЕ ВЕРТИКАЛИ (Post-MVP)

- 🔲 Vertical config system (ICP + prompts + sources через YAML)
- 🔲 Vertical #2: Строительство и девелопмент
- 🔲 Vertical #3: B2B IT услуги
- 🔲 Vertical #4: Производство и дистрибуция

---

## 🌐 РАСШИРЕННЫЕ КАНАЛЫ (v2+)

- 🔲 LinkedIn outreach (Sales Navigator API)
- 🔲 Voice AI cold calling (Vapi.ai интеграция)
- 🔲 WhatsApp Business API
- 🔲 SMS outreach (SMS.ru или подобный)

---

## 🔧 ТЕХНИЧЕСКИЙ ДОЛГ (отложено)

- 🔲 Перейти на Redis Sentinel (HA) при > 50 workspaces
- 🔲 Разделить workers на отдельные Docker сервисы (при росте нагрузки)
- 🔲 ElasticSearch для поиска (при > 1M компаний)
- 🔲 CDN для статики (Cloudflare)
- 🔲 Database read replica (при высокой нагрузке на чтение)
- 🔲 Schema-per-tenant режим для Enterprise клиентов

---

## ✅ ЗАВЕРШЕНО

- ✅ Vision документ
- ✅ Product Goals
- ✅ Market Research (РФ + глобальный)
- ✅ Functional Requirements
- ✅ Non-functional Requirements  
- ✅ System Architecture
- ✅ Database Design
- ✅ API Integrations (все провайдеры)
- ✅ AI Layer Design
- ✅ CRM Design
- ✅ UI/UX Design
- ✅ Security
- ✅ Deployment Plan
- ✅ Roadmap
- ✅ Architecture Decision Records (11 ADR)
