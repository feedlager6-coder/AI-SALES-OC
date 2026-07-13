# Architecture Diagrams — AI Sales OS

> Диаграммы в формате Mermaid. Рендеринг: GitHub, GitLab, Notion, или https://mermaid.live

---

## 1. Общая архитектура системы (C4 — Context Level)

```mermaid
C4Context
    title AI Sales OS — Контекст системы

    Person(sdr, "SDR / Sales Manager", "Управляет кампаниями, обрабатывает ответы")
    Person(ceo, "CEO / Head of Sales", "Смотрит аналитику, принимает решения")
    Person(developer, "Разработчик", "Настраивает вертикали, расширяет систему")

    System(aisalesos, "AI Sales OS", "Платформа автоматизации B2B продаж")

    System_Ext(twogis, "2ГИС API", "База компаний РФ")
    System_Ext(hhru, "HH.ru API", "Вакансии и работодатели")
    System_Ext(egrul, "ЕГРЮЛ / Dadata", "Официальные данные ЮЛ")
    System_Ext(openai, "OpenAI / Anthropic", "LLM для AI-агентов")
    System_Ext(mailgun, "Mailgun / Brevo", "Email доставка")
    System_Ext(telegram, "Telegram Bot API", "Уведомления SDR")
    System_Ext(hunter, "Hunter.io / Snov.io", "Email обогащение")

    Rel(sdr, aisalesos, "Управляет кампаниями, обрабатывает ответы", "HTTPS / Telegram")
    Rel(ceo, aisalesos, "Смотрит дашборды", "HTTPS")
    Rel(developer, aisalesos, "Конфигурирует вертикали", "API / Config files")

    Rel(aisalesos, twogis, "Поиск компаний по категории", "REST API")
    Rel(aisalesos, hhru, "Поиск работодателей и вакансий", "REST API")
    Rel(aisalesos, egrul, "Обогащение по ИНН", "REST API")
    Rel(aisalesos, openai, "Генерация писем, классификация", "REST API")
    Rel(aisalesos, mailgun, "Отправка email", "REST API")
    Rel(aisalesos, telegram, "Уведомления и команды", "Webhook + Bot API")
    Rel(aisalesos, hunter, "Email discovery", "REST API")
```

---

## 2. Контейнерная диаграмма (C4 — Container Level)

```mermaid
C4Container
    title AI Sales OS — Контейнеры

    Person(user, "Пользователь (SDR/Manager)")

    Container(web, "Web App", "Next.js 15", "React frontend, SSR, дашборды")
    Container(api, "API Server", "Node.js + Fastify", "REST API, бизнес-логика, auth")
    Container(w_enrichment, "Enrichment Worker", "Node.js + BullMQ", "Обогащение лидов из внешних API")
    Container(w_email, "Email Worker", "Node.js + BullMQ", "Отправка email, обработка webhook")
    Container(w_ai, "AI Worker", "Node.js + BullMQ", "Генерация писем, классификация, скоринг")
    Container(w_scraping, "Scraping Worker", "Node.js + Playwright", "Анализ сайтов компаний")
    Container(scheduler, "Scheduler", "Node.js + Cron", "Периодические задачи")

    ContainerDb(postgres, "PostgreSQL 16", "Database", "Основное хранилище данных")
    ContainerDb(redis, "Redis 7", "Cache + Queue", "BullMQ очереди, кэш сессий")
    ContainerDb(minio, "MinIO / S3", "Object Storage", "Файлы, вложения")

    Rel(user, web, "HTTPS")
    Rel(web, api, "REST API / WebSocket")
    Rel(api, postgres, "SQL / Drizzle ORM")
    Rel(api, redis, "Job dispatch / Cache")
    Rel(api, minio, "File upload")
    Rel(w_enrichment, redis, "Consume jobs")
    Rel(w_enrichment, postgres, "Read/write leads")
    Rel(w_email, redis, "Consume jobs")
    Rel(w_email, postgres, "Read/write sends")
    Rel(w_ai, redis, "Consume jobs")
    Rel(w_ai, postgres, "Read/write results")
    Rel(w_scraping, redis, "Consume jobs")
    Rel(scheduler, redis, "Dispatch jobs")
    Rel(scheduler, postgres, "Read scheduled sequences")
```

---

## 3. Поток данных: Lead Generation → Enrichment → Outreach

```mermaid
flowchart TD
    A([Триггер: пользователь настроил ICP\nили cron-расписание]) --> B

    subgraph GENERATION["🔍 Lead Generation"]
        B[Поиск в 2ГИС\nпо категории + городу] --> C[Поиск в HH.ru\nработодатели + вакансии]
        C --> D[Дедупликация\nпо ИНН / домену / названию]
        D --> E[Создать Lead\nstatus: NEW]
    end

    E --> F{ICP Score\nRule-based}
    F -- Score < 30 --> G[Отклонить / Архивировать]
    F -- Score 30-60 --> H[Поставить в очередь\nна обогащение]
    F -- Score > 60 --> H

    subgraph ENRICHMENT["⚙️ Enrichment Pipeline"]
        H --> I[ЕГРЮЛ / Dadata\nИНН, директор, статус]
        I --> J[HH.ru вакансии\nсигналы роста и болей]
        J --> K{Email найден?}
        K -- Нет --> L[Hunter.io lookup]
        L --> M{Email найден?}
        M -- Нет --> N[Snov.io lookup]
        N --> O{Email найден?}
        O -- Нет --> P[Паттерн-based guess\n+ low confidence flag]
        O -- Да --> Q
        M -- Да --> Q
        K -- Да --> Q
        Q[Email верификация\nMX + SMTP check] --> R[AI: анализ сайта\nPlaywright + GPT]
        R --> S[Обновить Lead\nstatus: ENRICHED\nicp_score: recalculated]
    end

    S --> T{ICP Score\nrecalculated}
    T -- < 50 --> U[Статус: LOW_QUALITY\nне добавлять в кампании]
    T -- >= 50 --> V[Статус: QUALIFIED\nготов к аутричу]

    subgraph OUTREACH["📧 Email Outreach"]
        V --> W{Подходит под\nактивную кампанию?}
        W -- Нет --> X[В пул\nожидание вручную]
        W -- Да --> Y[Зачислить\nв последовательность]
        Y --> Z[AI Writer: генерация\nперсонального письма]
        Z --> AA[Quality Check\nanti-spam + personalization]
        AA --> BB{Оценка OK?}
        BB -- Нет --> Z
        BB -- Да --> CC[Email Queue\nscheduled_at по рабочему времени]
        CC --> DD[Email Worker:\nотправить через Mailgun]
        DD --> EE{Tracking Webhook}
        EE -- Открыто --> FF[Следующий шаг\nпо расписанию]
        EE -- Ответ получен --> GG[AI Classifier:\nанализ намерения]
        EE -- Жёсткий bounce --> HH[Пометить email invalid\nостановить последовательность]
        GG --> II{Intent}
        II -- interested/call --> JJ[🔔 Уведомить SDR\nСоздать задачу]
        II -- not_interested --> KK[Остановить\nstatus: CLOSED_LOST]
        II -- not_now --> LL[Пауза 30 дней\nАвто-возобновление]
        II -- unsubscribe --> MM[Global Opt-out\nНикогда не писать]
    end
```

---

## 4. Схема данных (Entity Relationship)

```mermaid
erDiagram
    WORKSPACES ||--o{ USERS : "имеет"
    WORKSPACES ||--o{ COMPANIES : "владеет"
    WORKSPACES ||--o{ CAMPAIGNS : "запускает"
    WORKSPACES ||--o{ API_KEYS : "хранит"

    COMPANIES ||--o{ CONTACTS : "имеет"
    COMPANIES ||--o{ DEALS : "связана"
    COMPANIES ||--o{ ACTIVITIES : "в timeline"
    COMPANIES ||--o{ SEQUENCE_ENROLLMENTS : "зачислена"

    CONTACTS ||--o{ ACTIVITIES : "в timeline"
    CONTACTS ||--o{ SEQUENCE_ENROLLMENTS : "зачислен"
    CONTACTS ||--o{ EMAIL_SENDS : "получает"

    CAMPAIGNS ||--o{ SEQUENCES : "включает"
    SEQUENCES ||--o{ SEQUENCE_ENROLLMENTS : "содержит"
    SEQUENCE_ENROLLMENTS ||--o{ EMAIL_SENDS : "генерирует"

    USERS ||--o{ ACTIVITIES : "выполняет"
    USERS ||--o{ TASKS : "выполняет"
    DEALS ||--o{ ACTIVITIES : "в timeline"

    COMPANIES {
        uuid id PK
        uuid workspace_id FK
        varchar inn UK
        varchar name
        varchar industry
        varchar city
        text[] phones
        text[] emails
        smallint icp_score
        varchar enrichment_status
        text[] pain_points
        jsonb custom_fields
        varchar source
        timestamptz created_at
    }

    SEQUENCE_ENROLLMENTS {
        uuid id PK
        uuid sequence_id FK
        uuid company_id FK
        uuid contact_id FK
        varchar status
        smallint current_step
        timestamptz enrolled_at
        varchar reply_classification
    }

    EMAIL_SENDS {
        uuid id PK
        uuid enrollment_id FK
        uuid contact_id FK
        smallint step_number
        text subject
        text body_html
        varchar provider
        varchar status
        timestamptz opened_at
        timestamptz replied_at
        timestamptz sent_at
    }
```

---

## 5. Состояния Lead (State Machine)

```mermaid
stateDiagram-v2
    [*] --> NEW : Создан (2ГИС/CSV/ручной)
    NEW --> ENRICHING : Запущено обогащение
    ENRICHING --> ENRICHED : Обогащение завершено
    ENRICHED --> QUALIFIED : ICP Score ≥ 60 + email найден
    ENRICHED --> LOW_QUALITY : ICP Score < 50
    QUALIFIED --> CONTACTED : Первое письмо отправлено
    CONTACTED --> REPLIED : Получен ответ
    REPLIED --> MEETING : Встреча запланирована
    MEETING --> PROPOSAL : КП отправлено
    PROPOSAL --> NEGOTIATION : Обсуждение условий
    NEGOTIATION --> WON : Договор подписан
    NEGOTIATION --> LOST : Отказ
    CONTACTED --> LOST : Нет ответа 90+ дней
    REPLIED --> LOST : intent = not_interested
    REPLIED --> PAUSED_30D : intent = not_now
    PAUSED_30D --> CONTACTED : Авто-возобновление
    LOW_QUALITY --> QUALIFIED : Ручная ревалидация
```

---

## 6. AI Worker — внутренняя архитектура

```mermaid
sequenceDiagram
    participant SE as Sequence Engine
    participant Q as AI Queue (BullMQ)
    participant AW as AI Worker
    participant PM as Prompt Manager
    participant OAI as OpenAI API
    participant ANT as Anthropic API
    participant DB as PostgreSQL

    SE->>Q: dispatch job {type: generate_email, enrollmentId, step: 1}
    Q->>AW: job received
    AW->>DB: load company + contact data
    AW->>PM: get prompt template (vertical: transport, step: 1)
    PM-->>AW: {system_prompt, user_template, model: gpt-4o}
    AW->>AW: build context (pain_points + vacancies + news)
    AW->>OAI: POST /chat/completions (stream: true)
    
    alt OpenAI OK
        OAI-->>AW: streaming response
        AW->>AW: quality_check (spam score, personalization)
        alt Quality OK
            AW->>DB: save generated email (draft)
            AW->>Q: dispatch email_send job
        else Quality too low
            AW->>OAI: regenerate (max 2 attempts)
        end
    else OpenAI Error/Timeout
        AW->>ANT: fallback to Claude 3.5 Sonnet
        ANT-->>AW: response
        AW->>DB: save + flag "generated_by: anthropic"
    end
    
    AW->>DB: log AI call (tokens, cost, latency)
```

---

## 7. Деплой-диаграмма (Production)

```mermaid
graph TB
    Internet[🌐 Internet] --> Caddy

    subgraph VPS["Hetzner VPS (Ubuntu 22.04)"]
        Caddy["Caddy\n(TLS + Reverse Proxy)"]

        subgraph Docker["Docker Compose"]
            Web["Web\n(Next.js :3000)"]
            API["API\n(Fastify :3001)"]
            WE["Enrichment\nWorker x2"]
            WEM["Email\nWorker x1"]
            WAI["AI\nWorker x2"]
            PG["PostgreSQL 16\n(:5432)"]
            Redis["Redis 7\n(:6379)"]
            Prom["Prometheus\n(:9090)"]
            Grafana["Grafana\n(:3001)"]
        end

        Caddy --> Web
        Caddy --> API
        Caddy --> Grafana

        API --> PG
        API --> Redis

        WE --> PG
        WE --> Redis
        WEM --> PG
        WEM --> Redis
        WAI --> PG
        WAI --> Redis
    end

    API -->|REST| TwoGIS[2ГИС API]
    API -->|REST| HH[HH.ru API]
    WE -->|REST| Hunter[Hunter.io]
    WE -->|REST| Dadata[Dadata.ru]
    WEM -->|REST| Mailgun[Mailgun]
    WAI -->|REST| OpenAI[OpenAI API]
    API -->|Bot API| Telegram[Telegram]

    subgraph CI["GitHub Actions"]
        GHA["Build → Test → Push GHCR → SSH Deploy"]
    end

    GHA -->|docker pull + compose up| Docker
```
