# AI Layer — AI Sales OS

## Философия

AI в нашей системе — это **не chatbot и не замена людей**. Это:
1. **Обработка данных**: извлечение структурированной информации из неструктурированного текста
2. **Генерация**: написание персонализированных писем на основе реальных данных
3. **Классификация**: понимание входящих ответов и намерений
4. **Рекомендации**: что делать дальше с конкретным лидом

Каждое действие AI **объяснимо и редактируемо** человеком.

---

## Архитектура AI Layer

```
┌─────────────────────────────────────────────────────────┐
│                    AI ORCHESTRATOR                       │
│           (Vercel AI SDK / LangChain-lite)               │
└──────┬──────────┬───────────────┬────────────────────────┘
       │          │               │
       ▼          ▼               ▼
┌──────────┐ ┌──────────┐ ┌───────────────┐
│  Writer  │ │Classifier│ │   Extractor   │
│  Agent   │ │  Agent   │ │    Agent      │
│(генерация│ │(ответы,  │ │(сайт компании,│
│  писем)  │ │намерения)│ │ вакансии, пр.)│
└──────────┘ └──────────┘ └───────────────┘
       │          │               │
       └──────────┴───────────────┘
                  │
         ┌────────▼────────┐
         │  LLM Providers  │
         │ OpenAI │ Claude │
         └─────────────────┘
```

---

## AI Agent 1: Writer (Генерация писем)

### Входные данные
```typescript
interface WriterInput {
  // Данные компании
  companyName: string;
  industry: string;
  city: string;
  employeesCount?: string;
  painPoints?: string[];
  techStack?: string[];
  recentNews?: string[];
  openVacancies?: string[];        // из HH.ru
  
  // Данные контакта
  contactName?: string;
  contactTitle?: string;
  
  // Контекст кампании
  vertical: string;               // 'transport', 'construction', etc.
  productValueProp: string;       // что мы предлагаем
  stepNumber: number;             // шаг в последовательности
  previousStepSummary?: string;   // что было до этого
  
  // Параметры
  tone: 'formal' | 'professional' | 'friendly';
  language: 'ru' | 'en';
  maxWords: number;
}
```

### Процесс генерации

**Шаг 1: Контекстная сборка** (не AI)
- Агрегируем все доступные данные о компании
- Выбираем 2–3 наиболее релевантных "крюка" (вакансия логиста = рост флота = наш продукт актуален)
- Определяем tone of voice по индустрии

**Шаг 2: Prompt Construction**
```
System: Ты — опытный B2B sales-менеджер в компании {our_company}.
Пиши кратко, конкретно, без общих фраз.
Никаких "мы рады предложить" и "передовые технологии".

User: Напиши персональное письмо для {contactName} из {companyName}.

Контекст компании:
- Индустрия: {industry}
- Город: {city}
- Последние вакансии: {vacancies}
- Боли: {painPoints}

Наш продукт: {productValueProp}
Это шаг {stepNumber} из серии. Не повторяй предыдущие тезисы.

Требования:
- Тема: до 8 слов, конкретная, без спам-слов
- Тело: 3–4 предложения
- Первое предложение — о КОМПАНИИ, не о нас
- Заканчивай конкретным вопросом, а не "буду рад ответить"
- Верни JSON: {subject, body, hook_used}
```

**Шаг 3: Quality Check** (второй LLM вызов, дешёвая модель)
```
Оцени это письмо по критериям (JSON с оценками 1-5):
- personalization: насколько это именно об этой компании?
- clarity: понятно ли предложение ценности?
- call_to_action: конкретен ли вопрос в конце?
- spam_risk: есть ли слова, триггерящие спам-фильтры?
```

Если `spam_risk > 3` или `personalization < 3` → регенерация.

**Шаг 4: Human Review** (опционально, по настройке кампании)
- Предлагаем 3 варианта письма
- SDR выбирает лучший или редактирует
- Система обучается на предпочтениях

### Модели и стоимость

| Задача | Модель | Стоимость за операцию |
|-------|--------|----------------------|
| Основная генерация | GPT-4o | ~$0.003–0.008 |
| Quality check | GPT-4o-mini | ~$0.0002 |
| Регенерация | GPT-4o | ~$0.003–0.008 |
| **Итого на письмо** | | ~$0.005–0.015 |

При 1,000 писем/день = $5–15/день. Существенно дешевле найма SDR.

---

## AI Agent 2: Classifier (Классификация ответов)

### Задача
Входящее письмо от лида → структурированный intent.

### Классы
```typescript
type ReplyIntent =
  | 'interested'          // Хочу узнать больше / пришлите КП
  | 'request_call'        // Давайте созвонимся
  | 'not_now'             // Сейчас не актуально, вернитесь через N
  | 'not_interested'      // Нам не нужно, не пишите
  | 'wrong_person'        // Я не принимаю такие решения, напишите X
  | 'out_of_office'       // Автоответ об отсутствии
  | 'unsubscribe'         // Отпишите / не пишите
  | 'question'            // Задали уточняющий вопрос
  | 'price_request'       // Сколько стоит?
  | 'technical_question'  // Технический вопрос о продукте
```

### Промпт классификации
```
System: Классифицируй ответ на cold email. Верни только JSON.

User: Исходное письмо: {original_email}
Ответ: {reply_text}

Верни: {
  intent: "<одна из категорий>",
  confidence: 0.0-1.0,
  extracted_info: {
    preferred_time?: "...",
    contact_reference?: "...",
    objection?: "...",
    question?: "..."
  },
  suggested_action: "...",
  pause_days?: number
}
```

### Действия по результату классификации
```typescript
const actions: Record<ReplyIntent, Action> = {
  interested:        { pauseSequence: true,  createTask: 'PREPARE_PROPOSAL',  notify: true },
  request_call:      { pauseSequence: true,  createTask: 'SCHEDULE_CALL',     notify: true },
  not_now:           { pauseSequence: true,  resumeAfterDays: 30,             notify: false },
  not_interested:    { stopSequence: true,   updateStatus: 'closed_lost',     notify: false },
  wrong_person:      { pauseSequence: true,  createTask: 'FIND_RIGHT_CONTACT',notify: true },
  out_of_office:     { pauseUntil: 'detected_return_date',                    notify: false },
  unsubscribe:       { stopSequence: true,   addToOptOut: true,               notify: false },
  question:          { pauseSequence: true,  createTask: 'ANSWER_QUESTION',   notify: true },
  price_request:     { pauseSequence: true,  createTask: 'SEND_PRICING',      notify: true },
  technical_question:{ pauseSequence: true,  createTask: 'ANSWER_TECHNICAL',  notify: true },
};
```

---

## AI Agent 3: Extractor (Анализ данных компании)

### Задача
Получить структурированные данные из неструктурированных источников.

### Sub-task A: Website Analyzer
```typescript
// Входные данные: URL сайта
// Процесс: Playwright → получить текст → LLM → структура

interface WebsiteExtraction {
  mainProducts: string[];
  targetClients: string[];
  keyBenefits: string[];
  geography: string[];
  teamSize?: string;
  techMentions: string[];
  painPointSignals: string[];    // "Ищем решение для автоматизации..."
  isRelevantToICP: boolean;
  relevanceScore: number;        // 0-100
}
```

### Sub-task B: Vacancy Analyzer (HH.ru)
```typescript
// Входные данные: список вакансий компании
// Выходные данные: сигналы роста и боли

interface VacancySignals {
  growthSignals: string[];       // "Нанимают 5 водителей" → рост флота
  techStack: string[];           // из требований к вакансиям
  painPoints: string[];          // "хаотичное планирование маршрутов"
  budgetIndicator: string;       // high/medium/low по зарплатным вилкам
  seniorityLevel: string;        // кто принимает решения (по уровню вакансий)
}
```

### Sub-task C: News Analyzer
```typescript
// Google News API или Yandex News → последние новости компании
// Цель: найти "триггерные события" для персонализации

interface CompanyNewsSignals {
  recentEvents: string[];        // "Открыли склад в Казани"
  fundingNews?: string;          // "Привлекли инвестиции"
  expansionSigns: string[];      // "Выходят в новый регион"
  painSignals: string[];         // "Жалобы на логистику в соцсетях"
}
```

---

## AI Agent 4: ICP Scorer (Скоринг лидов)

### Алгоритм
Гибридный: правила (fast, deterministic) + LLM (slow, для edge cases).

**Этап 1 — Rule-based scoring (мгновенно)**
```typescript
const rules = [
  { field: 'industry', value: 'transport', weight: 25 },
  { field: 'employees_count', value: '50-200', weight: 20 },
  { field: 'city', inList: topCities, weight: 10 },
  { field: 'has_open_vacancies', weight: 15 },
  { field: 'domain_email_found', weight: 10 },
  { field: 'revenue_rub', min: 100_000_000, weight: 20 },
];
// Score = сумма весов подходящих правил (0-100)
```

**Этап 2 — LLM scoring (для score 40–60, пограничные случаи)**
```
Оцени, насколько эта компания подходит как клиент для [продукт].
Данные компании: {company_data}
Ответ: {score: 0-100, reasoning: "...", top_signals: [...]}
```

---

## Observability AI Layer

Каждый AI-вызов пишет в `ai_logs`:
```typescript
{
  id, workspace_id, agent, model,
  prompt_tokens, completion_tokens, cost_usd,
  latency_ms, success,
  input_hash,      // для дедупликации
  output_preview,  // первые 200 символов
  entity_type, entity_id  // к чему относится
}
```

**Dashboards:**
- Стоимость AI за день/месяц по workspace
- Средняя latency по агенту
- Error rate и причины ошибок
- Quality score трендов (через human feedback)

---

## Prompt Management

Промпты хранятся **не в коде**, а в конфигурации:
```yaml
# config/prompts/writer.yaml
system: |
  Ты — опытный B2B sales-менеджер...
user_template: |
  Напиши письмо для {{contact_name}} из {{company_name}}...
version: "2.1"
model: gpt-4o
temperature: 0.7
max_tokens: 500
```

**Почему так**: промпты итерируются чаще, чем код. Версионирование промптов независимо от деплоя.

---

## Безопасность AI

- **Prompt injection**: пользовательские данные вставляются как данные (не системный промпт)
- **Output validation**: все JSON-ответы валидируются через Zod перед использованием
- **PII в промптах**: email-адреса и телефоны маскируются в логах
- **Cost limits**: максимальный бюджет AI per workspace per day ($X), при превышении — остановка и алерт
