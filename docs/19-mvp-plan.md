# MVP Plan — AI Sales OS

## Определение MVP

**MVP** — минимально жизнеспособный продукт, который позволяет:
1. Найти логистические компании в выбранном регионе автоматически
2. Обогатить их данными (email, ФИО руководителя, боли)
3. Сгенерировать AI-персонализированное письмо
4. Отправить и отследить результат (open, reply)
5. SDR видит ответы и знает следующий шаг

**Не входит в MVP**: Voice calls, LinkedIn outreach, billing/monetization, мобильное приложение, вторая вертикаль.

---

## MVP Timeline: 8 недель

```
Неделя 1–2:  Core Infrastructure + Auth
Неделя 3–4:  CRM Core + Lead Import
Неделя 5–6:  Lead Generation + Enrichment
Неделя 7:    Email Outreach
Неделя 8:    AI Layer + Polish + Deploy
```

---

## Детальный план по неделям

### Недели 1–2: Core Infrastructure

**Backend:**
- [ ] pnpm monorepo + Turborepo setup
- [ ] PostgreSQL 16 + Drizzle ORM + база миграций
- [ ] Redis 7 + BullMQ конфигурация
- [ ] Fastify server + plugin структура
- [ ] JWT auth (access 15min + refresh 30d в httpOnly cookie)
- [ ] Workspace middleware (RLS setup)
- [ ] Базовые таблицы: workspaces, users, companies, contacts

**Frontend:**
- [ ] Next.js 15 App Router setup
- [ ] shadcn/ui + Tailwind 4 theme (тёмная тема)
- [ ] Layout: sidebar + header
- [ ] Auth pages: login, register
- [ ] API client (TanStack Query)

**Infra:**
- [ ] Docker Compose dev (postgres + redis + api + web)
- [ ] GitHub Actions: lint + typecheck + test
- [ ] .env.example + secrets guide

**Критерий готовности**: разработчик делает `docker compose up` → логинится в систему → видит пустой дашборд.

---

### Недели 3–4: CRM Core

**Backend:**
- [ ] Companies API: CRUD + list (фильтры, сортировка, пагинация)
- [ ] Contacts API: CRUD + связь с Company
- [ ] Deals API: CRUD + pipeline stages
- [ ] Activities API: create + timeline query
- [ ] Tasks API: create + assign + complete
- [ ] CSV import: parse → validate → preview → bulk create
- [ ] Full-text search (PostgreSQL GIN + pg_trgm)
- [ ] ICP Scoring engine (rule-based, конфиг через YAML)

**Frontend:**
- [ ] Companies list (TanStack Table: сортировка, фильтры, пагинация)
- [ ] Company card (overview + contacts + timeline + deals)
- [ ] Contact list + card
- [ ] Deal pipeline (kanban + list view)
- [ ] Activity timeline component
- [ ] Tasks panel
- [ ] CSV import wizard (upload → map fields → preview → import)
- [ ] Global search (⌘K)

**Критерий готовности**: можно импортировать 1000 компаний из CSV, просматривать их, искать, менять статусы.

---

### Недели 5–6: Lead Generation + Enrichment

**Backend:**
- [ ] 2ГИС API client (search by rubric + city)
- [ ] HH.ru API client (employers + vacancies)
- [ ] Dadata.ru API client (party lookup by INN)
- [ ] VK Groups API client (публичные страницы)
- [ ] Lead deduplication engine (INN → domain → name+city)
- [ ] Enrichment Queue (BullMQ jobs)
- [ ] Waterfall email discovery: Hunter.io → Snov.io → pattern-based
- [ ] Email verification (MX check + SMTP check)
- [ ] ICP Score recalculation after enrichment
- [ ] Enrichment status tracking + retry с backoff

**Frontend:**
- [ ] Lead Search UI: настройка ICP фильтров, запуск поиска
- [ ] Real-time обновление статуса обогащения (WebSocket)
- [ ] Enrichment details на карточке (источники, confidence)
- [ ] ICP Score badge + объяснение (почему такой балл)
- [ ] API Keys management page (2ГИС, Hunter, etc.)

**Критерий готовности**: запускаем поиск "логистика, Москва" → система находит 200+ компаний → обогащает email и данные ЕГРЮЛ → показывает ICP Score.

---

### Неделя 7: Email Outreach

**Backend:**
- [ ] Email accounts CRUD (Mailgun credentials + SMTP)
- [ ] Sequences API (CRUD steps)
- [ ] Campaigns API (create, start, pause, stop)
- [ ] Enrollment logic (добавить companies в campaign)
- [ ] Email Queue (BullMQ) + scheduling (рабочие часы + timezone)
- [ ] Mailgun sending (REST API)
- [ ] Mailgun webhooks: delivered, opened, clicked, bounced, replied, unsubscribed
- [ ] Unsubscribe handling (global opt-out)
- [ ] Daily sending limits per email account
- [ ] Campaign stats (denormalized counters)

**Frontend:**
- [ ] Email accounts list + add account
- [ ] Sequence builder (drag-and-drop steps)
- [ ] Campaign creation wizard (4 шага)
- [ ] Campaign list + status (active, paused, stats)
- [ ] Email send history на карточке компании
- [ ] Inbox (входящие ответы + быстрые действия)
- [ ] Campaign analytics (open/reply/bounce rates)

**Критерий готовности**: создаём кампанию → зачисляем 50 лидов → письма отправляются по расписанию → видим трекинг в реальном времени.

---

### Неделя 8: AI Layer + Polish + Deploy

**AI:**
- [ ] Vercel AI SDK setup (OpenAI + Anthropic)
- [ ] Writer Agent (генерация писем по данным компании)
- [ ] Prompt templates для транспортной вертикали
- [ ] Quality Check (spam score + personalization)
- [ ] 3 варианта письма в UI + выбор/редактирование
- [ ] Reply Classifier Agent
- [ ] Auto-actions по классификации
- [ ] AI fallback (OpenAI → Anthropic)
- [ ] AI cost tracking

**Telegram:**
- [ ] Bot setup + webhook
- [ ] Уведомления SDR о новых ответах
- [ ] Inline кнопки (Позвонить / Отложить / Ответить)

**Deploy:**
- [ ] Dockerfile multi-stage для web + api + workers
- [ ] docker-compose.prod.yml
- [ ] Caddyfile (TLS + reverse proxy)
- [ ] GitHub Actions → SSH deploy
- [ ] PostgreSQL daily backup script
- [ ] Prometheus + Grafana базовый monitoring
- [ ] Healthcheck endpoints

**Polish:**
- [ ] Onboarding wizard (5 шагов)
- [ ] Empty states
- [ ] Error states
- [ ] Loading skeletons
- [ ] Basic responsive

**Критерий готовности**: полный E2E flow работает на production сервере.

---

## MVP Definition of Done

### Функциональный чеклист
- [ ] Регистрация → workspace → добавление email аккаунта за < 5 минут
- [ ] Поиск 100+ лидов по ICP за < 2 минуты
- [ ] Обогащение лида (email + ЕГРЮЛ) за < 30 секунд
- [ ] AI-генерация персонализированного письма за < 10 секунд
- [ ] Email отправлен и доставлен (delivery rate > 90%)
- [ ] Открытие письма трекается
- [ ] Входящий ответ классифицируется AI за < 5 секунд
- [ ] SDR уведомлён в Telegram

### Нефункциональный чеклист
- [ ] API p95 < 500 ms на основных endpoints
- [ ] Система работает стабильно 48 часов без рестарта
- [ ] Нет data leak между workspace A и workspace B (тест!)
- [ ] TLS настроен, HTTP редирект на HTTPS
- [ ] Secrets только в env vars, не в коде

### Бизнес-чеклист
- [ ] Один реальный пользователь (не мы) провёл onboarding самостоятельно
- [ ] Первое реальное письмо отправлено и получен ответ
- [ ] NPS первого пользователя ≥ 7

---

## Технический стек MVP (финальный список зависимостей)

```json
{
  "runtime": "Node.js 22 LTS",
  "packageManager": "pnpm 9 + Turborepo",
  "backend": {
    "framework": "Fastify 5",
    "orm": "Drizzle ORM",
    "auth": "better-auth",
    "validation": "Zod",
    "queue": "BullMQ",
    "ai": "@ai-sdk/openai + @ai-sdk/anthropic",
    "email": "mailgun.js",
    "scraping": "playwright"
  },
  "frontend": {
    "framework": "Next.js 15",
    "ui": "shadcn/ui + Tailwind CSS 4",
    "state": "Zustand + TanStack Query",
    "tables": "@tanstack/react-table",
    "forms": "React Hook Form + Zod",
    "charts": "Recharts"
  },
  "database": "PostgreSQL 16",
  "cache": "Redis 7",
  "storage": "MinIO (self-hosted S3)",
  "infra": "Docker Compose → Hetzner VPS",
  "ci": "GitHub Actions",
  "monitoring": "Prometheus + Grafana + Loki"
}
```

---

## Риски MVP

| Риск | Вероятность | Митигация |
|------|------------|----------|
| Email deliverability ниже ожидаемого | Средняя | SPF/DKIM/DMARC + прогрев с первого дня |
| 2ГИС API медленный response time | Низкая | Async + кэш + пагинация |
| OpenAI API latency для генерации | Средняя | Streaming + UI индикатор |
| 8 недель недостаточно | Средняя | Scope cut: убрать kanban view → только table |
| Email верификация дорогая | Низкая | Бесплатные MX checks + Hunter бесплатный tier |
