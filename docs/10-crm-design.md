# CRM Design — AI Sales OS

## Концепция

Наш CRM — не классический инструмент записей, это **AI-активная система**, где:
- Каждая запись живёт и обновляется автоматически
- Timeline — не история кликов, а осмысленная лента взаимодействий
- Пайплайн движется сам при выполнении условий
- SDR видит задачи, а не список лидов

**Референсы:** Twenty CRM (open-source, Salesforce-alternative, metadata API), Attio (relationship intelligence), Notion-style гибкость полей.

---

## Иерархия объектов

```
Workspace
└── Company (организация)
    ├── Contact (1..N сотрудников)
    ├── Deal (1..N сделок)
    └── Activity (история: emails, звонки, заметки)
        └── Task (следующие действия)

Campaign
├── Sequence (шаблон шагов)
└── SequenceEnrollment (Company+Contact enrolled)
    └── EmailSend (каждое письмо)
```

---

## Пайплайн сделок

### Этапы по умолчанию (вертикаль: транспорт)

```
[NEW] → [ENRICHED] → [QUALIFIED] → [CONTACTED] → [REPLIED] →
[MEETING] → [PROPOSAL] → [NEGOTIATION] → [WON] / [LOST]
```

| Этап | Условие перехода | Ответственный |
|------|-----------------|--------------|
| NEW | Лид создан | Авто |
| ENRICHED | Обогащение завершено | Авто |
| QUALIFIED | ICP Score > 60 + email найден | Авто |
| CONTACTED | Первое письмо отправлено | Авто |
| REPLIED | Получен ответ | Авто |
| MEETING | Звонок/встреча запланированы | SDR |
| PROPOSAL | КП отправлено | SDR |
| NEGOTIATION | Обсуждение условий | Manager |
| WON | Договор подписан | Manager |
| LOST | Явный отказ / timeout | SDR / Авто |

### Автоматические переходы
```typescript
triggers = [
  {
    from: 'contacted', to: 'replied',
    condition: 'email_replied',
    action: 'classify_reply + notify_sdr'
  },
  {
    from: 'new', to: 'lost',
    condition: 'last_activity_days > 90 AND status = new',
    action: 'mark_stale + create_task_review'
  }
]
```

---

## Карточка компании (UI-концепция)

```
┌────────────────────────────────────────────────────────────────┐
│ [Логотип] ООО «ТрансЛогистик»              ICP Score: 82/100  │
│           Транспорт · Москва · 150–200 чел  ●  QUALIFIED       │
│           🌐 translogistic.ru  📞 +7(495)...  INN: 7701234567  │
├─────────────────────┬──────────────────────────────────────────┤
│  OVERVIEW           │  TIMELINE                                │
│                     │                                          │
│  Выручка: ~₽500M    │  [Today] Email отправлен Ивану П.        │
│  Автопарк: 80 машин │  [Yesterday] Обогащение завершено         │
│  Регион: ЦФО        │  [3 дня назад] Лид добавлен из 2ГИС      │
│                     │                                          │
│  Боли:              │  [+ Добавить заметку]                    │
│  • Ручной диспетч.  │                                          │
│  • Перерасход топл. │                                          │
│  • Нет real-time    │                                          │
│    треккинга        │                                          │
│                     │                                          │
│  Вакансии (HH.ru):  │                                          │
│  • Логист (2 позиц) │                                          │
│  • Диспетчер        │                                          │
├─────────────────────┴──────────────────────────────────────────┤
│  КОНТАКТЫ                                                       │
│  [+] Иван Петров  · Директор · ivan@translog.ru  ✓ verified    │
│      Мария Сидорова · Логист · —  (email не найден)            │
├────────────────────────────────────────────────────────────────┤
│  СДЕЛКИ                                                        │
│  [+] #12 Оптимизация 80 машин · ₽480,000/год · MEETING        │
├────────────────────────────────────────────────────────────────┤
│  АКТИВНАЯ КАМПАНИЯ                                             │
│  "Транспортная B2B" · Шаг 2/5 · Следующий email: завтра 10:00 │
│  [Пауза] [Просмотр письма] [Перейти в кампанию]               │
└────────────────────────────────────────────────────────────────┘
```

---

## Представления списков

### 1. Таблица (default)
- Виртуализированная (TanStack Table + virtual rows)
- Колонки: компания, город, ICP score, этап, последняя активность, назначен
- Сортировка по любому полю
- Фильтры: отрасль, регион, ICP score range, этап, дата создания

### 2. Kanban-доска
- Колонки = этапы пайплайна
- Карточки перетаскиваются drag-and-drop
- Счётчики и суммы сделок в заголовке каждой колонки

### 3. Карта (Map view)
- Яндекс Карты или 2ГИС iframe
- Пины = компании; цвет = ICP score
- Кластеризация при зуме

### 4. Входящие ответы (Inbox)
- Все email-ответы, требующие реакции SDR
- Отсортированы по приоритету: interested > question > not_now
- Inline: просмотр оригинального письма + ответ лида
- Кнопки быстрых действий

---

## Задачи (Tasks)

SDR видит список задач вместо необработанных лидов:

```typescript
interface Task {
  id: string;
  type: TaskType;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  title: string;                    // "Позвонить Ивану Петрову (ТрансЛогистик)"
  description?: string;             // "Хочет уточнить по цене"
  companyId: string;
  contactId?: string;
  dueAt: Date;
  assignedTo: string;               // userId
  aiSuggestion?: string;            // Что AI рекомендует сделать
}

type TaskType =
  | 'SCHEDULE_CALL'
  | 'SEND_PROPOSAL'
  | 'ANSWER_QUESTION'
  | 'FIND_RIGHT_CONTACT'
  | 'REVIEW_STALE_LEAD'
  | 'APPROVE_EMAIL'
  | 'PREPARE_DEMO';
```

---

## Сегментация и фильтры

Система поддерживает сохранённые фильтры (Saved Views):

```typescript
const savedViews = [
  {
    name: "Горячие лиды Москва",
    filter: {
      icp_score: { gte: 70 },
      city: "Москва",
      stage: ['qualified', 'contacted'],
      has_open_vacancies: true
    },
    sort: { field: 'icp_score', dir: 'desc' }
  },
  {
    name: "Ждут ответа > 3 дней",
    filter: {
      stage: 'contacted',
      last_email_sent_days_ago: { gte: 3 },
      no_reply: true
    }
  }
];
```

---

## Кастомные поля

Без разработки, через UI:

```typescript
type FieldType = 
  | 'text' | 'number' | 'boolean' | 'date'
  | 'select' | 'multi_select' | 'url' | 'currency';

interface CustomField {
  entity: 'company' | 'contact' | 'deal';
  name: string;
  type: FieldType;
  options?: string[];      // для select
  required: boolean;
  showInCard: boolean;
  showInList: boolean;
}
```

Значения хранятся в `companies.custom_fields JSONB`.

---

## Автоматизация (Rules Engine)

UI-конфигурируемые автоматические правила:

```
WHEN  [email_opened] AND [step = 1] AND [company.icp_score > 80]
THEN  [move_to_step 2] AND [notify sdr via telegram]

WHEN  [deal.stage = negotiation] AND [last_activity > 7 days]
THEN  [create task: FOLLOW_UP] AND [assign to deal.owner]

WHEN  [company created] AND [source = '2gis']
THEN  [start enrichment] AND [add to campaign "Транспортная авто"]
```

---

## Поиск

**Глобальный поиск** (⌘K / Ctrl+K):
- Полнотекстовый поиск по company.name, contact.full_name, contact.email
- PostgreSQL `to_tsvector('russian', ...)` для кириллицы
- Дополнительный индекс по ИНН, домену, телефону
- Результаты: сначала exact match, затем fuzzy по pg_trgm

**Почему не ElasticSearch**: на MVP-объёмах (< 1M компаний) PostgreSQL GIN-индекс достаточен. Переход на ES — ADR-пункт при необходимости.
