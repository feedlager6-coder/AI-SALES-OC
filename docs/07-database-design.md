# Database Design — AI Sales OS

## СУБД: PostgreSQL 16

**Почему PostgreSQL:**
- JSONB для гибких кастомных полей без изменения схемы
- Row-Level Security (RLS) для мультитенантной изоляции
- Full-text search без отдельного ElasticSearch
- `pg_cron` для scheduled задач прямо в БД
- Зрелость, широкий ecosystem, все хостеры поддерживают

---

## Схема мультитенантности

Все таблицы содержат `workspace_id UUID NOT NULL`. PostgreSQL RLS политика:
```sql
CREATE POLICY workspace_isolation ON leads
  USING (workspace_id = current_setting('app.current_workspace_id')::uuid);
```
Middleware на API-уровне устанавливает `app.current_workspace_id` до каждого запроса.

---

## Основные таблицы

### `workspaces` — Тенант
```sql
workspaces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(100) UNIQUE NOT NULL,  -- для URL
  plan            VARCHAR(50) DEFAULT 'trial',   -- trial, starter, pro, enterprise
  settings        JSONB DEFAULT '{}',             -- feature flags, limits, UI prefs
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
)
```

### `users` — Пользователи
```sql
users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  email           VARCHAR(255) NOT NULL,
  name            VARCHAR(255),
  role            VARCHAR(50) NOT NULL DEFAULT 'sdr',  -- owner, admin, manager, sdr
  avatar_url      TEXT,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, email)
)
```

### `companies` — Компании (основная сущность CRM)
```sql
companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id),
  
  -- Идентификаторы
  inn             VARCHAR(12),          -- ИНН (уникальный в РФ)
  ogrn            VARCHAR(15),
  domain          VARCHAR(255),
  
  -- Основные данные
  name            VARCHAR(500) NOT NULL,
  legal_name      VARCHAR(500),
  industry        VARCHAR(100),
  okved_code      VARCHAR(20),          -- код ОКВЭД
  city            VARCHAR(255),
  region          VARCHAR(255),
  address         TEXT,
  
  -- Размер
  employees_count VARCHAR(50),          -- '10-50', '50-200', '200-1000'
  revenue_rub     BIGINT,               -- выручка в рублях (из ЕГРЮЛ/оценочно)
  
  -- Контакты
  phones          TEXT[],
  emails          TEXT[],
  website         TEXT,
  
  -- Соцсети
  linkedin_url    TEXT,
  vk_url          TEXT,
  telegram_url    TEXT,
  
  -- Скоринг
  icp_score       SMALLINT DEFAULT 0,   -- 0-100
  
  -- Обогащение
  enrichment_status   VARCHAR(50) DEFAULT 'pending',  -- pending, in_progress, done, failed
  enriched_at     TIMESTAMPTZ,
  enrichment_sources  JSONB DEFAULT '[]',  -- [{source: 'egrul', fields: [...], at: '...'}]
  
  -- AI-анализ
  pain_points     TEXT[],               -- выявленные боли
  tech_stack      TEXT[],               -- технологии
  ai_summary      TEXT,                 -- краткое AI-описание компании
  
  -- Кастомные поля
  custom_fields   JSONB DEFAULT '{}',
  tags            TEXT[],
  
  -- Метаданные
  source          VARCHAR(100),         -- '2gis', 'hh', 'csv_import', 'manual', 'api'
  source_id       VARCHAR(500),         -- внешний ID источника
  
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(workspace_id, inn),
  UNIQUE(workspace_id, domain)
)

CREATE INDEX idx_companies_workspace ON companies(workspace_id);
CREATE INDEX idx_companies_icp_score ON companies(workspace_id, icp_score DESC);
CREATE INDEX idx_companies_industry ON companies(workspace_id, industry);
CREATE INDEX idx_companies_city ON companies(workspace_id, city);
CREATE INDEX idx_companies_search ON companies USING GIN(to_tsvector('russian', name || ' ' || COALESCE(legal_name, '')));
```

### `contacts` — Контакты (люди)
```sql
contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id),
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  
  -- Личные данные
  first_name      VARCHAR(255),
  last_name       VARCHAR(255),
  full_name       VARCHAR(500),
  title           VARCHAR(255),         -- должность
  seniority       VARCHAR(50),          -- c_level, vp, director, manager, individual
  department      VARCHAR(100),
  
  -- Контакты
  email           VARCHAR(255),
  email_status    VARCHAR(50),          -- valid, invalid, catch_all, unknown
  phone           VARCHAR(50),
  linkedin_url    TEXT,
  telegram        VARCHAR(100),
  
  -- Обогащение
  enrichment_status   VARCHAR(50) DEFAULT 'pending',
  enriched_at     TIMESTAMPTZ,
  
  -- Кастомные поля
  custom_fields   JSONB DEFAULT '{}',
  tags            TEXT[],
  
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(workspace_id, email)
)

CREATE INDEX idx_contacts_workspace ON contacts(workspace_id);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_email ON contacts(workspace_id, email);
```

### `deals` — Сделки
```sql
deals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id),
  company_id      UUID REFERENCES companies(id),
  contact_id      UUID REFERENCES contacts(id),
  assigned_to     UUID REFERENCES users(id),
  
  title           VARCHAR(500) NOT NULL,
  value_rub       BIGINT,               -- сумма сделки
  stage           VARCHAR(100) NOT NULL DEFAULT 'new',
  probability     SMALLINT DEFAULT 0,   -- 0-100%
  expected_close  DATE,
  
  lost_reason     TEXT,
  won_at          TIMESTAMPTZ,
  lost_at         TIMESTAMPTZ,
  
  custom_fields   JSONB DEFAULT '{}',
  tags            TEXT[],
  
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
)
```

### `activities` — Активности / Timeline
```sql
activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id),
  
  -- Привязка к объектам
  company_id      UUID REFERENCES companies(id),
  contact_id      UUID REFERENCES contacts(id),
  deal_id         UUID REFERENCES deals(id),
  
  -- Тип и данные
  type            VARCHAR(50) NOT NULL,  -- email_sent, email_opened, email_replied, call, meeting, note, status_change, enrichment
  direction       VARCHAR(20),           -- outbound, inbound
  subject         TEXT,
  body            TEXT,
  metadata        JSONB DEFAULT '{}',    -- дополнительные данные (email_id, duration, etc.)
  
  -- Источник
  performed_by    UUID REFERENCES users(id),
  automated       BOOLEAN DEFAULT false,
  
  occurred_at     TIMESTAMPTZ DEFAULT now()
)

CREATE INDEX idx_activities_company ON activities(company_id, occurred_at DESC);
CREATE INDEX idx_activities_workspace ON activities(workspace_id, occurred_at DESC);
```

### `campaigns` — Кампании аутрича
```sql
campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id),
  created_by      UUID REFERENCES users(id),
  
  name            VARCHAR(255) NOT NULL,
  status          VARCHAR(50) DEFAULT 'draft',  -- draft, active, paused, completed
  vertical        VARCHAR(100),                  -- transport, construction, etc.
  
  -- ICP-фильтр (сохранённые настройки)
  icp_filter      JSONB DEFAULT '{}',
  
  -- Настройки отправки
  sending_settings JSONB DEFAULT '{
    "days": [1,2,3,4,5],
    "time_from": "09:00",
    "time_to": "18:00",
    "timezone": "Europe/Moscow",
    "daily_limit": 100
  }',
  
  -- Метрики (денормализованные для скорости)
  stats           JSONB DEFAULT '{
    "enrolled": 0, "sent": 0, "opened": 0,
    "clicked": 0, "replied": 0, "meetings": 0
  }',
  
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
)
```

### `sequences` — Шаблоны последовательностей
```sql
sequences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id),
  campaign_id     UUID REFERENCES campaigns(id),
  name            VARCHAR(255) NOT NULL,
  steps           JSONB NOT NULL DEFAULT '[]'
  -- steps: [{
  --   order: 1, type: 'email', delay_days: 0,
  --   subject_template: '...', body_template: '...',
  --   ai_personalize: true
  -- }, ...]
)
```

### `sequence_enrollments` — Зачисление лида в последовательность
```sql
sequence_enrollments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id),
  sequence_id     UUID REFERENCES sequences(id),
  company_id      UUID REFERENCES companies(id),
  contact_id      UUID REFERENCES contacts(id),
  
  status          VARCHAR(50) DEFAULT 'active',  -- active, paused, completed, replied, unsubscribed, bounced
  current_step    SMALLINT DEFAULT 0,
  
  enrolled_at     TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  reply_at        TIMESTAMPTZ,
  reply_classification  VARCHAR(50)  -- interested, not_interested, etc.
)
```

### `email_sends` — Каждое отправленное письмо
```sql
email_sends (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL,
  enrollment_id   UUID REFERENCES sequence_enrollments(id),
  contact_id      UUID REFERENCES contacts(id),
  
  step_number     SMALLINT NOT NULL,
  subject         TEXT,
  body_html       TEXT,
  body_text       TEXT,
  from_email      VARCHAR(255),
  to_email        VARCHAR(255),
  
  -- Внешний ID провайдера (Mailgun message-id)
  provider_id     TEXT,
  provider        VARCHAR(50),     -- mailgun, brevo, ses
  
  -- Статусы
  status          VARCHAR(50) DEFAULT 'queued',  -- queued, sent, delivered, bounced
  bounce_type     VARCHAR(50),    -- hard, soft
  
  -- Отслеживание
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,
  replied_at      TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
)

CREATE INDEX idx_email_sends_enrollment ON email_sends(enrollment_id);
CREATE INDEX idx_email_sends_provider_id ON email_sends(provider_id);
```

### `email_accounts` — Почтовые ящики для отправки
```sql
email_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL,
  
  email           VARCHAR(255) NOT NULL,
  name            VARCHAR(255),
  provider        VARCHAR(50),     -- mailgun, brevo, ses, smtp
  credentials     JSONB,           -- encrypted: {api_key, smtp_host, etc.}
  
  -- Прогрев
  warmup_enabled  BOOLEAN DEFAULT false,
  warmup_status   VARCHAR(50) DEFAULT 'not_started',
  reputation_score SMALLINT,
  
  -- Лимиты
  daily_limit     SMALLINT DEFAULT 50,
  sent_today      SMALLINT DEFAULT 0,
  
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
)
```

### `enrichment_jobs` — История обогащения
```sql
enrichment_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL,
  company_id      UUID REFERENCES companies(id),
  contact_id      UUID REFERENCES contacts(id),
  
  status          VARCHAR(50) DEFAULT 'pending',  -- pending, in_progress, done, failed
  providers_tried JSONB DEFAULT '[]',
  results         JSONB DEFAULT '{}',
  error           TEXT,
  
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
)
```

### `api_keys` — API-ключи клиентов к внешним сервисам
```sql
api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL,
  service         VARCHAR(100) NOT NULL,  -- '2gis', 'openai', 'hunter', etc.
  key_encrypted   TEXT NOT NULL,          -- AES-256 encrypted
  label           VARCHAR(255),
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, service)
)
```

---

## Индексы производительности

```sql
-- Полнотекстовый поиск по компаниям
CREATE INDEX idx_companies_fts ON companies
  USING GIN(to_tsvector('russian', name));

-- Поиск лидов с низким ICP score для ревью
CREATE INDEX idx_companies_needs_enrichment ON companies(workspace_id, created_at)
  WHERE enrichment_status = 'pending';

-- Активные enrollments для Sequence Engine
CREATE INDEX idx_enrollments_active ON sequence_enrollments(workspace_id, current_step)
  WHERE status = 'active';

-- Email tracking по provider_id (для webhook)
CREATE INDEX idx_email_sends_tracking ON email_sends(provider_id, provider);
```

---

## Миграции

Используем **Drizzle ORM** с `drizzle-kit`:
- Все изменения схемы — только через migration файлы
- Миграции запускаются автоматически при деплое
- Rollback = новая миграция (не `DROP TABLE`)

**Правило**: никакого ручного SQL в production. Любое изменение схемы = pull request с migration file.
