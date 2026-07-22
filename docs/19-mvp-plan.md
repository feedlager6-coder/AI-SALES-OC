# MVP Plan — AI Sales OS

## Определение MVP

**MVP** — минимально жизнеспособный продукт, который позволяет:
1. Описать кого ищешь на естественном языке → получить подтверждение как система поняла запрос
2. Получить список компаний с контактами (email, ФИО руководителя, сигналы)
3. Прочитать готовый черновик первого сообщения от AI
4. Отправить и отследить результат (открытие, ответ)
5. Увидеть «что делать сегодня» при следующем входе

**North Star Metric MVP**: пользователь нашёл релевантного клиента и отправил ему первое персонализированное сообщение менее чем за 10 минут после регистрации.

**Не входит в MVP**: Voice calls, LinkedIn outreach, billing/monetization, мобильное приложение, вторая вертикаль, конфигуратор источников данных, настройка ICP через UI.

---

## MVP Timeline: 9 недель

```
Неделя 1–2:  Core Infrastructure + Auth
Неделя 3–4:  CRM Core (Company, Contact, Deal)
Неделя 5:    Intent Interpreter + Hunt Orchestration
Неделя 5–6:  Lead Generation + Enrichment Pipeline
Неделя 7:    Email Outreach (Рассылки)
Неделя 8:    AI Layer + «Сегодня» экран
Неделя 9:    Онбординг v2 + Polish + Deploy
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

### Неделя 5: Intent Interpreter + Hunt Orchestration

**Backend:**
- [ ] Intent Interpreter: NLP-парсинг намерения → структурированные параметры Hunt
- [ ] Interactive Intent API: принять запрос → вернуть интерпретацию + уточняющий вопрос (max 1)
- [ ] Hunt Orchestrator: создать Hunt по параметрам, запустить поиск по источникам
- [ ] Hunt сущность в БД (только системный слой, не отображается в UI напрямую)

**Frontend:**
- [ ] Экран «Поиск»: одно поле «Кого вы ищете?» + подсказка с примером
- [ ] Interactive Intent UI: карточка подтверждения → «Всё верно, искать» / «Уточнить»
- [ ] Состояние загрузки результатов (skeleton + прогресс-индикатор)

**Критерий готовности**: вводим «транспортные компании Екатеринбург» → система показывает интерпретацию → после подтверждения запускает Hunt.

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
- [ ] ICP Score расчёт после обогащения (внутренний; порядок в результатах, не цифра в UI)
- [ ] Enrichment status tracking + retry с backoff

**Frontend:**
- [ ] Результаты поиска: список компаний с контактами и сигналами («открыли 3 вакансии»)
- [ ] Real-time обновление статуса обогащения (WebSocket)
- [ ] Карточка компании: данные, история, следующий шаг
- [ ] Настройки: API Keys management (2ГИС, Hunter, etc.)

**Критерий готовности**: описываем поиск «логистика, Москва» → система находит 200+ компаний → обогащает email и данные ЕГРЮЛ → показывает отсортированный список.

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

### Неделя 8: AI Layer + «Сегодня»

**AI:**
- [ ] Vercel AI SDK setup (OpenAI + Anthropic)
- [ ] Writer Agent (генерация черновика первого сообщения по данным компании)
- [ ] Prompt templates для транспортной вертикали
- [ ] Quality Check (spam score + personalization)
- [ ] Черновик в UI: пользователь читает → [Отправить] или [Изменить]
- [ ] Reply Classifier Agent (interested / not_now / not_interested / request_call / out_of_office)
- [ ] Post-action AI: после взаимодействия — предложить заметку и следующий шаг
- [ ] AI fallback (OpenAI → Anthropic)
- [ ] AI cost tracking

**«Сегодня» экран:**
- [ ] Activity Queue API: приоритизированный список «кому написать и почему»
- [ ] Сигналы активности: новые вакансии, новости, прошёл срок паузы
- [ ] UI экрана «Сегодня» (только для вернувшихся пользователей с данными)

**Telegram:**
- [ ] Bot setup + webhook
- [ ] Уведомления о новых ответах
- [ ] Inline кнопки (Позвонить / Отложить / Ответить)

**Deploy:**
- [ ] Dockerfile multi-stage для web + api + workers
- [ ] docker-compose.prod.yml
- [ ] Caddyfile (TLS + reverse proxy)
- [ ] GitHub Actions → SSH deploy
- [ ] PostgreSQL daily backup script
- [ ] Prometheus + Grafana базовый monitoring
- [ ] Healthcheck endpoints

**Критерий готовности**: полный E2E flow работает на production сервере.

---

### Неделя 9: Онбординг v2 + Polish

**Онбординг:**
- [ ] Регистрация: только email + пароль (30 сек), никаких вопросов о команде
- [ ] Первый экран после регистрации: поле «Кого вы ищете?» (не пустая очередь)
- [ ] Empty states во всех разделах: всегда предлагают «начать поиск»

**Polish:**
- [ ] Error states
- [ ] Loading skeletons
- [ ] Basic responsive

**Критерий готовности**: новый пользователь находит клиента и отправляет первое сообщение за < 10 минут.

---

## MVP Definition of Done

### Функциональный чеклист
- [ ] Регистрация (email + пароль) → первый экран поиска за < 30 секунд
- [ ] Описал намерение → система показала интерпретацию → запустила поиск
- [ ] Получил 100+ компаний с контактами за < 2 минуты
- [ ] Обогащение компании (email + ЕГРЮЛ) за < 30 секунд
- [ ] AI подготовил черновик первого сообщения за < 10 секунд
- [ ] Email отправлен и доставлен (delivery rate > 90%)
- [ ] Открытие письма трекается
- [ ] Входящий ответ классифицируется AI за < 5 секунд
- [ ] Пользователь уведомлён в Telegram
- [ ] North Star: новый пользователь нашёл клиента и написал ему за < 10 минут

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
