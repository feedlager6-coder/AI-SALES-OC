# Domain Model — AI Sales OS
> Канонический источник истины для всех бизнес-сущностей.  
> Если в коде или другом документе именование отличается — следуй этому файлу.

---

## Два слоя сущностей

> **Ключевое архитектурное решение**: сущности делятся на два слоя.
> - **Пользовательский слой** — то, что видит и называет пользователь: поиск, список клиентов, контакты, сообщения, следующий шаг.
> - **Системный слой** — внутренние механики: Hunt, Waterfall, ICP Score, Activity Queue, Pipeline, Sequences. Пользователь никогда не видит эти термины в UI.

## Карта сущностей (верхний уровень)

```
┌─────────────────────────────────────────────────────────────────┐
│                         WORKSPACE                                │
│  (изолированная среда одной компании-клиента)                    │
│                                                                  │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────────┐   │
│  │  USERS   │  │ COMPANIES │  │ CONTACTS │  │   CAMPAIGNS  │   │
│  └──────────┘  └─────┬─────┘  └────┬─────┘  └──────┬───────┘   │
│                      │             │                │           │
│  ┌──────────┐     ┌──▼─────────────▼──┐     ┌──────▼───────┐   │
│  │  HUNTS   │     │     DEALS         │     │  SEQUENCES   │   │
│  │(внутр.)  │     └───────────────────┘     └──────┬───────┘   │
│  └──────────┘                                      │           │
│  ┌────────────┐  ┌────────────┐    ┌───────────────▼───────┐   │
│  │ ACTIVITIES │  │   TASKS    │    │ SEQUENCE_ENROLLMENTS  │   │
│  └────────────┘  └────────────┘    └───────────────────────┘   │
│                                             │                  │
│  ┌──────────┐  ┌──────────────┐   ┌────────▼────────────┐     │
│  │ AI_LOGS  │  │ AUDIT_LOGS   │   │    EMAIL_SENDS      │     │
│  └──────────┘  └──────────────┘   └─────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Сущность 1: Workspace

### Назначение
Изолированная мультитенантная среда для одной компании-клиента. Корневой контейнер для всех данных. Всё принадлежит Workspace.

### Lifecycle
```
TRIAL (14 дней) → ACTIVE (платная подписка) → SUSPENDED (просрочка) → CLOSED (удалён)
```

### Атрибуты
| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID | Primary key |
| name | VARCHAR | Название компании |
| slug | VARCHAR UNIQUE | URL-slug (например: `acme-corp`) |
| plan | ENUM | `trial` / `starter` / `pro` / `enterprise` |
| settings | JSONB | Feature flags, лимиты, UI настройки |
| subscription_status | ENUM | `trialing` / `active` / `past_due` / `canceled` |
| trial_ends_at | TIMESTAMPTZ | Дата окончания триала |

### Инварианты
- Каждая запись любой таблицы имеет `workspace_id` (кроме системных таблиц)
- PostgreSQL RLS policy активна на всех таблицах с `workspace_id`
- Удаление Workspace → soft delete + schedule hard delete через 30 дней

### Отношения
- 1:N → Users
- 1:N → Companies
- 1:N → Campaigns
- 1:N → API Keys (внешние ключи доступа)
- 1:N → Email Accounts

---

## Сущность 2: User

### Назначение
Человек с доступом к Workspace. Один User может иметь доступ только к одному Workspace (в MVP).

### Roles (RBAC)
| Роль | Может |
|------|-------|
| `owner` | Всё, включая billing и удаление workspace |
| `admin` | Всё кроме billing |
| `manager` | Создавать/запускать кампании; видеть всё |
| `sdr` | Работать с назначенными лидами; нельзя экспортировать |

### Lifecycle
```
INVITED → ACTIVE → SUSPENDED → DELETED (soft)
```

### Атрибуты
| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID | PK |
| workspace_id | UUID FK | |
| email | VARCHAR | Уникальный в пределах workspace |
| name | VARCHAR | |
| role | ENUM | owner / admin / manager / sdr |
| avatar_url | TEXT | |
| telegram_chat_id | BIGINT | Для уведомлений |
| last_login_at | TIMESTAMPTZ | |
| invited_by | UUID FK → users | |
| status | ENUM | `active` / `suspended` / `deleted` |

---

## Сущность 3: Company

### Назначение
**Центральная сущность системы.** Представляет организацию (юридическое лицо или ИП), которая является потенциальным или текущим клиентом.

> ⚠️ **Важное соглашение об именовании**  
> В разговорном контексте "лид" = Company в статусе до QUALIFIED.  
> В коде и API это всегда **Company**, не Lead.  
> Нет отдельной таблицы `leads`.

### Lead Lifecycle (статусы Company в контексте продаж)

```
                    ┌─────────────────┐
                    │      NEW        │ ← Создана из любого источника
                    └────────┬────────┘
                             │ dispatch: enrich-queue
                    ┌────────▼────────┐
                    │   ENRICHING     │ ← Worker обогащает данные
                    └────────┬────────┘
                    ┌────────▼────────┐
                    │   ENRICHED      │ ← Данные получены
                    └────────┬────────┘
              ┌──────────────┴──────────────┐
       score≥50 & email found           score<50 OR no email
              │                              │
    ┌─────────▼─────────┐       ┌────────────▼──────────┐
    │    QUALIFIED       │       │     LOW_QUALITY        │
    └─────────┬─────────┘       └────────────────────────┘
              │ enrolled in sequence
    ┌─────────▼─────────┐
    │    CONTACTED       │ ← Первое письмо отправлено
    └─────────┬─────────┘
              │ reply received
    ┌─────────▼─────────┐
    │     REPLIED        │
    └─────────┬─────────┘
         ┌────┴────────────────────────────────┐
         │                                     │
   intent=interested                 intent=not_interested
         │                                     │
┌────────▼────────┐                  ┌─────────▼─────────┐
│    MEETING       │                  │    CLOSED_LOST     │
└────────┬────────┘                  └───────────────────┘
         │
┌────────▼────────┐
│    PROPOSAL      │
└────────┬────────┘
         │
┌────────▼────────┐
│  NEGOTIATION     │
└────────┬────────┘
    ┌────┴────┐
    │         │
┌───▼──┐  ┌──▼────────┐
│ WON  │  │   LOST    │
└──────┘  └───────────┘

Специальные:
PAUSED_30D ← intent=not_now (auto-resume after 30 days)
OPTED_OUT  ← unsubscribe (never contact again)
```

### Атрибуты
```typescript
interface Company {
  // Identity
  id: UUID
  workspace_id: UUID
  inn: string | null           // ИНН (уникальный для РФ)
  ogrn: string | null
  domain: string | null        // email domain

  // Core data
  name: string                 // Название (как используется / известно)
  legal_name: string | null    // Официальное юридическое название
  industry: string | null      // Отрасль
  okved_code: string | null    // ОКВЭД
  city: string | null
  region: string | null
  address: string | null

  // Size
  employees_count: '1-10' | '10-50' | '50-200' | '200-1000' | '1000+' | null
  revenue_rub: number | null   // Годовая выручка

  // Contacts
  phones: string[]
  emails: string[]             // Корпоративные email-адреса
  website: string | null

  // Social
  linkedin_url: string | null
  vk_url: string | null
  telegram_url: string | null

  // Sales status (lead lifecycle)
  status: CompanyStatus        // см. lifecycle выше
  icp_score: number            // 0-100

  // Enrichment
  enrichment_status: 'pending' | 'in_progress' | 'done' | 'failed'
  enriched_at: Date | null
  enrichment_sources: EnrichmentSource[]  // [{source, fields, at}]

  // AI insights
  pain_points: string[]        // Выявленные боли
  tech_stack: string[]
  growth_signals: string[]     // Сигналы роста из вакансий/новостей
  ai_summary: string | null    // AI-описание компании

  // Meta
  source: CompanySource        // '2gis' | 'hhru' | 'csv' | 'manual' | 'api'
  source_id: string | null     // ID в источнике (для идемпотентности)
  custom_fields: Record<string, unknown>
  tags: string[]

  // Soft delete
  deleted_at: Date | null
  created_at: Date
  updated_at: Date
}
```

### Инварианты
- `UNIQUE(workspace_id, inn)` — ИНН уникален в рамках workspace
- `UNIQUE(workspace_id, domain)` — домен уникален в рамках workspace
- При создании всегда проверяется дедупликация: ИНН → домен → (название + город)
- Переход в OPTED_OUT необратим (только Owner может отменить)
- Soft delete: `deleted_at IS NOT NULL`, никогда не hard delete

### Отношения
- 1:N → Contacts
- 1:N → Deals
- 1:N → Activities (timeline)
- 1:N → SequenceEnrollments
- 1:N → EnrichmentJobs

---

## Сущность 4: Contact

### Назначение
Физическое лицо — сотрудник или представитель Company. Получатель писем.

### Lifecycle
```
DISCOVERED → ENRICHED → CONTACTED → REPLIED → (следует lifecycle Company)
```

### Атрибуты
| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID | PK |
| workspace_id | UUID FK | |
| company_id | UUID FK | Может быть NULL если компания неизвестна |
| first_name | VARCHAR | |
| last_name | VARCHAR | |
| full_name | VARCHAR | Нормализованное полное имя |
| title | VARCHAR | Должность |
| seniority | ENUM | `c_level` / `vp` / `director` / `manager` / `individual` |
| department | VARCHAR | Отдел |
| email | VARCHAR | |
| email_status | ENUM | `valid` / `invalid` / `catch_all` / `unknown` |
| email_confidence | DECIMAL(3,2) | 0.00–1.00 (от провайдера) |
| email_source | VARCHAR | `hunter` / `snov` / `manual` / `pattern` |
| phone | VARCHAR | |
| linkedin_url | TEXT | |
| telegram | VARCHAR | |
| opted_out | BOOLEAN | Global unsubscribe |
| opted_out_at | TIMESTAMPTZ | |
| custom_fields | JSONB | |
| tags | TEXT[] | |
| deleted_at | TIMESTAMPTZ | Soft delete |

### Инварианты
- `UNIQUE(workspace_id, email)` — email уникален в workspace
- Если `opted_out = true` → никогда не включать в email рассылку (система блокирует)
- Email со статусом `invalid` не может быть добавлен в sequence

---

## Сущность 5: Deal

### Назначение
Конкретная торговая возможность, привязанная к Company и Contact. Отражает финансовую ценность.

### Pipeline stages (настраиваемые per workspace)
```
DEFAULT: new → qualified → proposal → negotiation → won | lost
```

### Атрибуты
| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID | PK |
| workspace_id | UUID FK | |
| company_id | UUID FK | |
| contact_id | UUID FK | Основной контакт |
| assigned_to | UUID FK → users | |
| title | VARCHAR | Название сделки |
| value_rub | BIGINT | Сумма в рублях |
| stage | VARCHAR | Текущий этап pipeline |
| probability | SMALLINT | 0–100% |
| expected_close | DATE | |
| lost_reason | TEXT | |
| won_at | TIMESTAMPTZ | |
| lost_at | TIMESTAMPTZ | |
| custom_fields | JSONB | |
| tags | TEXT[] | |
| deleted_at | TIMESTAMPTZ | |

---

## Сущность 6: Campaign

### Назначение
Организационная единица outreach-активности. Содержит ICP-фильтр, Sequences и настройки отправки.

### Lifecycle
```
DRAFT → ACTIVE → PAUSED → COMPLETED | ARCHIVED
```

### Атрибуты
| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID | PK |
| workspace_id | UUID FK | |
| created_by | UUID FK → users | |
| name | VARCHAR | |
| status | ENUM | draft / active / paused / completed / archived |
| vertical | VARCHAR | transport / construction / it / etc. |
| icp_filter | JSONB | Сохранённые ICP параметры (отрасль, регион, размер) |
| sending_settings | JSONB | Дни, время, timezone, daily_limit |
| stats | JSONB | Денормализованные счётчики (enrolled, sent, opened, replied...) |
| started_at | TIMESTAMPTZ | |
| ended_at | TIMESTAMPTZ | |

### Инварианты
- Campaign ACTIVE → все новые Companies, соответствующие ICP, автоматически зачисляются
- Campaign PAUSED → новые enrollments не создаются, существующие письма не отправляются
- `stats` обновляется атомарно через `UPDATE campaigns SET stats = stats || jsonb_build_object(...)` или denormalized counter columns

---

## Сущность 7: Sequence

### Назначение
Шаблон многошаговой email-последовательности. Принадлежит Campaign.

### Атрибуты
| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID | PK |
| workspace_id | UUID FK | |
| campaign_id | UUID FK | |
| name | VARCHAR | |
| steps | JSONB | Массив шагов (см. ниже) |

### Структура Step
```typescript
interface SequenceStep {
  order: number           // 1, 2, 3...
  type: 'email' | 'task' | 'wait'
  delay_days: number      // Задержка от предыдущего шага
  delay_hours?: number    // Для более точной настройки
  condition?: {           // Условная логика
    if: 'opened' | 'not_opened' | 'clicked'
    then: 'continue' | 'skip' | 'stop'
  }
  // Для type='email':
  subject_template?: string     // Шаблон темы (может содержать {{переменные}})
  body_template?: string        // Шаблон тела
  ai_personalize?: boolean      // Генерировать через AI Writer
  from_account_id?: UUID        // Конкретный email account (или rotation)
}
```

### Инварианты
- Максимум 10 шагов на Sequence
- Шаги выполняются строго по порядку
- При `condition` несоответствии — шаг пропускается, не последовательность

---

## Сущность 8: SequenceEnrollment

### Назначение
Факт зачисления конкретной Company+Contact в конкретную Sequence. Хранит текущий прогресс.

### Lifecycle
```
ACTIVE → COMPLETED (все шаги выполнены)
       → REPLIED (получен ответ)
       → PAUSED (pause_until = future date)
       → UNSUBSCRIBED (global opt-out)
       → BOUNCED (hard bounce)
       → STOPPED (manual or intent=not_interested)
```

### Атрибуты
| Поле | Тип | |
|------|-----|-|
| id | UUID | PK |
| workspace_id | UUID FK | |
| sequence_id | UUID FK | |
| company_id | UUID FK | |
| contact_id | UUID FK | |
| status | ENUM | |
| current_step | SMALLINT | Индекс текущего шага |
| enrolled_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |
| reply_at | TIMESTAMPTZ | |
| reply_classification | ENUM | interested / not_now / not_interested / ... |
| pause_until | TIMESTAMPTZ | Для временной паузы |

### Инварианты
- Company может быть зачислена в одну и ту же Sequence только один раз (UNIQUE constraint)
- При `opted_out = true` у Contact → enrollment принудительно UNSUBSCRIBED

---

## Сущность 9: EmailSend

### Назначение
Запись каждого фактически отправленного (или поставленного в очередь) письма. Immutable после отправки (только tracking поля обновляются).

### Lifecycle
```
QUEUED → SENT → DELIVERED → [OPENED] → [CLICKED] → [REPLIED]
              → BOUNCED (hard / soft)
              → COMPLAINED (spam report)
```

### Атрибуты
| Поле | Тип | |
|------|-----|-|
| id | UUID | PK |
| workspace_id | UUID | |
| enrollment_id | UUID FK | |
| contact_id | UUID FK | |
| step_number | SMALLINT | |
| subject | TEXT | Финальный subject (после personalization) |
| body_html | TEXT | |
| body_text | TEXT | |
| from_email | VARCHAR | |
| to_email | VARCHAR | |
| provider | ENUM | mailgun / brevo / ses |
| provider_id | TEXT | Message-ID от провайдера |
| status | ENUM | queued / sent / delivered / bounced / complained |
| bounce_type | ENUM | hard / soft / null |
| opened_at | TIMESTAMPTZ | Первое открытие |
| clicked_at | TIMESTAMPTZ | Первый клик |
| replied_at | TIMESTAMPTZ | |
| unsubscribed_at | TIMESTAMPTZ | |
| sent_at | TIMESTAMPTZ | |

### Инварианты
- Append-mostly: только tracking поля обновляются после отправки
- `provider_id` уникален — защита от двойной отправки при webhook retry
- Hard bounce → мгновенно `STOPPED` enrollment + `email_status = invalid` у Contact

---

## Сущность 10: Activity

### Назначение
Иммутабельная запись любого взаимодействия с Company/Contact/Deal. Формирует Timeline.

### Типы активностей
| type | Описание |
|------|---------|
| `email_sent` | Письмо отправлено |
| `email_opened` | Письмо открыто |
| `email_clicked` | Клик по ссылке |
| `email_replied` | Получен ответ |
| `email_bounced` | Письмо не доставлено |
| `call` | Звонок (ручной) |
| `meeting` | Встреча |
| `note` | Заметка от SDR |
| `status_change` | Изменение статуса Company |
| `enrichment_completed` | Обогащение завершено |
| `ai_classified` | AI классифицировал ответ |
| `task_created` | Задача создана |
| `deal_created` | Сделка создана |
| `deal_stage_changed` | Этап сделки изменился |

### Атрибуты
| Поле | Тип | |
|------|-----|-|
| id | UUID | PK |
| workspace_id | UUID FK | |
| company_id | UUID FK | NULL если не связано с компанией |
| contact_id | UUID FK | NULL |
| deal_id | UUID FK | NULL |
| type | VARCHAR | Тип активности |
| direction | ENUM | outbound / inbound / internal |
| subject | TEXT | Краткое описание |
| body | TEXT | Детали (текст письма, заметки) |
| metadata | JSONB | Дополнительные данные |
| performed_by | UUID FK → users | NULL если автоматически |
| automated | BOOLEAN | true если сделано системой |
| occurred_at | TIMESTAMPTZ | |

### Инварианты
- **Append-only**: никогда не UPDATE, никогда не DELETE
- Партиционировать по `occurred_at` (по месяцам) при >10M строк

---

## Сущность 11: Task

### Назначение
Задача для SDR с дедлайном и приоритетом. Создаётся автоматически системой или вручную.

### Lifecycle
```
PENDING → IN_PROGRESS → COMPLETED | SNOOZED | CANCELLED
```

| Поле | Тип | |
|------|-----|-|
| id | UUID | PK |
| workspace_id | UUID FK | |
| assigned_to | UUID FK → users | |
| created_by | UUID FK → users | NULL если автоматически |
| company_id | UUID FK | |
| contact_id | UUID FK | |
| type | ENUM | `call` / `email` / `meeting` / `proposal` / `follow_up` / `custom` |
| title | TEXT | |
| description | TEXT | |
| priority | ENUM | low / medium / high / urgent |
| status | ENUM | pending / in_progress / completed / snoozed / cancelled |
| due_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |
| snoozed_until | TIMESTAMPTZ | |

---

## Сущность 12: Hunt (системный слой — в UI не отображается)

### Назначение
Единица поиска клиентов. Создаётся автоматически системой при получении намерения пользователя. **Пользователь никогда не видит слово «Hunt»** — он видит «поиск» и «список клиентов».

### Как создаётся
```
Пользователь: «Мне нужны транспортные компании в Екатеринбурге»
      ↓
Intent Interpreter → разбирает намерение
      ↓
Создаётся Hunt с параметрами { industry: transport, city: Екатеринбург }
      ↓
Hunt Orchestrator → запускает поиск по источникам (2GIS, HH.ru, ...)
      ↓
Результаты → Company записи → пользователь видит список
```

### Атрибуты
| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID | PK |
| workspace_id | UUID FK | |
| created_by | UUID FK → users | |
| raw_intent | TEXT | Исходный текст намерения пользователя |
| interpreted_params | JSONB | Результат Intent Interpreter: {industry, city, size, signals, ...} |
| status | ENUM | `pending` / `running` / `done` / `failed` |
| sources_used | TEXT[] | Источники данных, использованные при поиске |
| companies_found | INTEGER | Количество найденных компаний |
| started_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |

### Инварианты
- Слово `hunt` используется в: таблице `hunts`, API `/api/v1/hunts`, классе `HuntOrchestrator`, внутренней документации
- В пользовательском интерфейсе — **никогда**; пользователь видит «поиск», «список клиентов»
- Один Hunt может породить много Company записей (через source_id для идемпотентности)

---

## Сущность 13: Provider (Plugin)

### Назначение
Любой внешний провайдер данных или сервиса, реализующий Plugin Interface.

### Типы провайдеров
| Category | Типы | Примеры |
|----------|------|---------|
| lead_source | CompanySearchProvider | 2GIS, HH.ru, VK, CSV |
| enrichment | EmailFinderProvider, CompanyDataProvider | Hunter.io, Snov.io, Dadata |
| email | EmailSendingProvider | Mailgun, Brevo, SES |
| ai | LLMProvider | OpenAI, Anthropic, GigaChat |
| storage | StorageProvider | S3, MinIO |
| notification | NotificationProvider | Telegram, Slack |
| crm_sync | CRMProvider | Bitrix24, AmoCRM (future) |

Подробная спецификация: `docs/plugin_architecture.md`

---

## Сущность 13: EnrichmentJob

### Назначение
Трекинг прогресса и истории обогащения для Company или Contact.

| Поле | Тип | |
|------|-----|-|
| id | UUID | PK |
| workspace_id | UUID FK | |
| company_id | UUID FK | |
| contact_id | UUID FK | NULL если для компании |
| status | ENUM | pending / in_progress / done / failed |
| providers_tried | JSONB | [{provider, status, fields_found, at}] |
| results | JSONB | Найденные данные |
| error | TEXT | Последняя ошибка |
| retry_count | SMALLINT | |
| started_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |

---

## Сущность 14: AILog

### Назначение
Иммутабельная запись каждого LLM-вызова. Нужна для cost tracking, quality monitoring, debugging.

| Поле | Тип | |
|------|-----|-|
| id | UUID | PK |
| workspace_id | UUID FK | |
| agent | ENUM | writer / classifier / extractor / icp_scorer / custom |
| model | VARCHAR | gpt-4o / claude-3-5-sonnet / etc. |
| provider | VARCHAR | openai / anthropic |
| prompt_tokens | INTEGER | |
| completion_tokens | INTEGER | |
| total_tokens | INTEGER | |
| cost_usd | DECIMAL(10,6) | Расчётная стоимость |
| latency_ms | INTEGER | |
| success | BOOLEAN | |
| error_code | VARCHAR | NULL если success |
| input_hash | CHAR(64) | SHA-256 prompt → для дедупликации |
| output_preview | TEXT | Первые 300 символов ответа |
| entity_type | VARCHAR | company / contact / enrollment |
| entity_id | UUID | |
| occurred_at | TIMESTAMPTZ | |

### Инварианты
- Append-only
- PII маскируется перед логированием
- Партиционировать по месяцам при >5M строк

---

## Сущность 15: AuditLog

### Назначение
Полная история всех изменений данных. Compliance requirement (152-ФЗ, GDPR).

| Поле | Тип | |
|------|-----|-|
| id | UUID | PK |
| workspace_id | UUID FK | |
| user_id | UUID FK → users | NULL если системное действие |
| action | VARCHAR | `company.create` / `campaign.start` / `user.login` / etc. |
| entity_type | VARCHAR | |
| entity_id | UUID | |
| old_value | JSONB | NULL для create actions |
| new_value | JSONB | NULL для delete actions |
| ip_address | INET | |
| user_agent | TEXT | |
| occurred_at | TIMESTAMPTZ | |

### Инварианты
- Append-only: никогда не UPDATE/DELETE через приложение
- Партиционировать по месяцам (`PARTITION BY RANGE(occurred_at)`)
- Retention policy: 12 месяцев online, затем архив

---

## Сущность 16: EmailAccount

### Назначение
Почтовый ящик (или API аккаунт) для отправки писем. Имеет лимиты и warmup state.

| Поле | Тип | |
|------|-----|-|
| id | UUID | PK |
| workspace_id | UUID FK | |
| email | VARCHAR | Адрес отправителя |
| display_name | VARCHAR | Имя отправителя |
| provider | ENUM | mailgun / brevo / ses / smtp |
| credentials_encrypted | TEXT | AES-256-GCM |
| warmup_enabled | BOOLEAN | |
| warmup_status | ENUM | not_started / in_progress / completed |
| reputation_score | SMALLINT | 0–100 |
| daily_limit | SMALLINT | Макс. писем в день |
| is_active | BOOLEAN | |

### Инварианты
- `credentials_encrypted` → только через `encryptApiKey()` / `decryptApiKey()`
- `daily_limit` соблюдается атомарно (Redis INCR, не поле в БД) — см. RISK-001 в audit report

---

## Сущность 17: ICPRule (конфигурация)

### Назначение
Набор весовых правил для расчёта ICP Score. Хранится в YAML, не в БД.

```yaml
# verticals/transport/icp.yaml
vertical: transport
version: "1.2"

rules:
  - field: industry
    match: [transport, logistics, courier, freight]
    weight: 25
    
  - field: employees_count
    range: [50, 1000]
    weight: 20
    
  - field: city
    in_list: [Москва, Санкт-Петербург, Екатеринбург, Новосибирск, Казань]
    weight: 10
    
  - field: has_open_vacancies
    condition: true
    weight: 15
    
  - field: email_found
    condition: true
    weight: 10
    
  - field: revenue_rub
    min: 50_000_000
    weight: 20

thresholds:
  qualified: 50
  high_quality: 75
  reject: 30
```

---

## Глоссарий (canonical terms)

### Пользовательский слой (используется в UI)

| Пользовательский термин | Что это | Внутренний термин |
|------------------------|---------|-------------------|
| **Поиск / Найти клиентов** | Запуск поиска по намерению | Hunt |
| **Список клиентов** | Результат поиска | Hunt results → Companies |
| **Клиент / Компания** | Организация в базе | Company |
| **Контакт** | Представитель компании | Contact |
| **История** | Все взаимодействия с компанией | Timeline / Activities |
| **Следующий шаг** | Задача, созданная AI или вручную | Task |
| **Рассылка** | Email-последовательность | Sequence / Campaign |
| **Воронка** | Pipeline с этапами сделки | Pipeline (Kanban) |
| **Сегодня** | Приоритизированный список действий | Activity Queue |
| **Входящие** | Ответы, требующие внимания | Inbox / Replies |

### Системный слой (только в коде, API, документации — не в UI)

| Термин | Определение |
|--------|------------|
| **Hunt** | Единица поиска: намерение пользователя → структурированные параметры → результаты. Таблица `hunts`, API `/api/v1/hunts`. В UI пользователь видит «поиск» |
| **Intent Interpreter** | Компонент, преобразующий текст намерения в параметры Hunt |
| **ICP Score** | 0–100 балл внутренней приоритизации; пользователь видит порядок, не цифру |
| **Waterfall** | Стратегия обогащения: провайдеры по очереди, берём первый успешный |
| **Enrollment** | Факт добавления Company в Sequence (прогресс) |
| **Lead** | Неформальный термин; в коде = Company в статусе до QUALIFIED |
| **Company** | Основная CRM-сущность; всегда используй это имя в коде |
| **Enrichment** | Процесс пополнения данных Company из внешних источников |
| **Sequence** | Многошаговый email-сценарий (шаблон) |
| **Campaign** | Организационный контейнер для Sequences + ICP фильтра |
| **Vertical** | Отраслевая конфигурация (транспорт, строительство и т.д.) |
| **Plugin** | Реализация внешнего провайдера через стандартный интерфейс |
| **Workspace** | Изолированная среда одного клиента (тенанта) |
| **Opted-out** | Контакт запросил прекращение коммуникации; неприкосновен |
