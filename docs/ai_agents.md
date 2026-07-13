# AI Multi-Agent System — AI Sales OS
> Полная спецификация всех AI-агентов системы.  
> Каждый агент: назначение, входы, выходы, память, инструменты, коммуникация, обработка ошибок.

---

## Архитектура Multi-Agent System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AI ORCHESTRATION LAYER                            │
│                        (Vercel AI SDK core)                              │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    AGENT REGISTRY                                │    │
│  │  Maps: job_type → Agent class → LLM provider → prompt template  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  DISCOVERY TIER          ENRICHMENT TIER         ENGAGEMENT TIER         │
│  ┌─────────────┐         ┌──────────────┐       ┌──────────────────┐   │
│  │ Research    │         │ Extractor    │       │ Writer           │   │
│  │ Agent       │         │ Agent        │       │ Agent            │   │
│  ├─────────────┤         ├──────────────┤       ├──────────────────┤   │
│  │ Lead        │         │ ICP Scorer   │       │ Classifier       │   │
│  │ Discovery   │         │ Agent        │       │ Agent            │   │
│  │ Agent       │         ├──────────────┤       ├──────────────────┤   │
│  └─────────────┘         │ Enrichment   │       │ Follow-up        │   │
│                          │ Agent        │       │ Agent            │   │
│  ANALYSIS TIER           └──────────────┘       ├──────────────────┤   │
│  ┌─────────────┐                               │ Objection        │   │
│  │ Dashboard   │         MEETING TIER           │ Handler Agent    │   │
│  │ Analyst     │         ┌──────────────┐       └──────────────────┘   │
│  │ Agent       │         │ Meeting Prep │                               │
│  ├─────────────┤         │ Agent        │                               │
│  │ Product     │         └──────────────┘                               │
│  │ Analyst     │                                                        │
│  │ Agent       │         META TIER                                      │
│  ├─────────────┤         ┌──────────────┐                               │
│  │ Strategy    │         │ Documentation│                               │
│  │ Agent       │         │ Agent        │                               │
│  └─────────────┘         └──────────────┘                               │
└─────────────────────────────────────────────────────────────────────────┘
                                   │ ILLMPlugin interface
                    ┌──────────────┼──────────────┐
                    ▼              ▼               ▼
              OpenAI GPT-4o  Anthropic Claude  GigaChat (future)
```

---

## Базовый интерфейс агента

```typescript
// packages/ai/agents/base-agent.ts

export interface AgentContext {
  workspaceId: string
  userId?: string
  entityId?: string          // companyId, enrollmentId, etc.
  entityType?: string
  vertical?: string          // 'transport', 'construction', etc.
}

export interface AgentResult<T = unknown> {
  success: boolean
  output?: T
  error?: string
  model: string              // Модель которая ответила
  provider: string           // openai / anthropic
  tokens: { input: number; output: number }
  costUsd: number
  latencyMs: number
  retryCount: number
}

export abstract class BaseAgent {
  abstract readonly name: AgentName
  abstract readonly description: string
  
  protected abstract execute(input: unknown, ctx: AgentContext): Promise<unknown>
  
  async run<TInput, TOutput>(input: TInput, ctx: AgentContext): Promise<AgentResult<TOutput>> {
    const startTime = Date.now()
    let retryCount = 0
    
    for (const provider of this.getProviderFallbackChain()) {
      try {
        if (isCircuitOpen(provider)) continue
        
        const output = await this.execute(input, ctx)
        const result = this.buildResult(output, provider, startTime, retryCount)
        
        await this.logToAILogs(result, ctx)
        recordSuccess(provider)
        
        return result as AgentResult<TOutput>
      } catch (error) {
        recordFailure(provider)
        retryCount++
        logger.warn({ agent: this.name, provider, error: (error as Error).message })
      }
    }
    
    return { success: false, error: 'All providers failed', ... }
  }
  
  private getProviderFallbackChain(): string[] {
    return registry.getByCategory<ILLMPlugin>('llm')
      .filter(p => !isCircuitOpen(p.name))
      .map(p => p.name)
  }
}
```

---

## Agent 1: Research Agent

### Назначение
Исследует рынок и находит потенциальные сегменты для поиска лидов. Работает на уровне вертикали, не конкретных компаний.

### Когда запускается
- По расписанию (1 раз в неделю)
- При настройке новой вертикали
- По запросу владельца workspace

### Входные данные
```typescript
interface ResearchAgentInput {
  vertical: string              // 'transport' | 'construction' | etc.
  geography: string[]           // ['Москва', 'Санкт-Петербург']
  productDescription: string    // Что мы продаём
  existingCompetitors?: string[] // Конкуренты на рынке
  recentDeals?: {               // Успешные прошлые сделки для обучения
    companyName: string
    dealValue: number
    winReason: string
  }[]
}
```

### Выходные данные
```typescript
interface ResearchAgentOutput {
  marketSummary: string         // Краткий обзор сегмента
  targetSubSegments: Array<{    // Подсегменты для фокуса
    name: string
    estimatedCompanies: number
    avgDealSize: string
    painPoints: string[]
    searchKeywords: string[]    // Для 2ГИС / HH.ru
    recommendedSources: string[]
  }>
  icpRecommendations: {         // Рекомендованные ICP правила
    industries: string[]
    companySize: string
    signals: string[]
  }
  competitiveInsights: string   // Кто ещё продаёт, как
}
```

### Инструменты (Tools)
- `web_search`: Поиск новостей рынка, статистики
- `analyze_existing_deals`: Анализ прошлых успешных сделок из БД
- `competitor_analysis`: Анализ конкурентных предложений

### Память
- Кэширует результаты исследования в Redis на 7 дней
- Результаты записываются в `workspace.settings.research_cache`

### Модель
GPT-4o (требует сильного reasoning). Anthropic fallback.

### Обработка ошибок
- При ошибке → возвращает минимальный результат на основе конфигурации вертикали
- Не блокирует работу системы

---

## Agent 2: Lead Discovery Agent

### Назначение
Формирует поисковые запросы к источникам (2ГИС, HH.ru) на основе ICP конфигурации.

### Когда запускается
- По расписанию или запросу
- Формирует параметры для `ILeadSourcePlugin.search()`

### Входные данные
```typescript
interface LeadDiscoveryInput {
  vertical: string
  icpFilter: ICPFilter
  targetCount: number           // Сколько новых компаний найти
  excludeIds: string[]          // Уже известные (дедупликация)
}
```

### Выходные данные
```typescript
interface LeadDiscoveryOutput {
  searchPlans: Array<{
    plugin: string              // '2gis' | 'hhru'
    params: LeadSearchParams    // Параметры для плагина
    estimatedResults: number
    priority: number
  }>
  searchRationale: string       // Почему такие параметры
}
```

### Ключевая логика
```
1. Анализирует ICP (отрасль, регион, размер)
2. Генерирует оптимальные поисковые запросы для каждого источника
3. Приоритизирует источники (2ГИС для физических адресов, HH.ru для B2B с сотрудниками)
4. Учитывает прошлые результаты (какие запросы давали высокий ICP score)
```

### Память
- Rolling window последних 100 поисков: что нашли, какой ICP score получился
- Использует для улучшения следующих запросов

---

## Agent 3: Enrichment Agent

### Назначение
Координирует процесс обогащения данных компании. Решает, какие источники использовать и в каком порядке.

### Когда запускается
- При создании новой Company (status=NEW)
- При запросе переобогащения

### Входные данные
```typescript
interface EnrichmentAgentInput {
  companyId: string
  existingData: Partial<Company>
  fieldsNeeded: string[]        // ['email', 'director_name', 'revenue']
  vertical: string
}
```

### Логика принятия решений
```
IF inn exists → try EGRUL/Dadata first (most authoritative for RU)
IF domain exists AND email needed → Hunter.io first
IF company has HH vacancies → fetch them (growth signals)
IF website exists AND not analyzed → queue for Playwright analysis
ELSE → pattern-based email guess
```

### Выходные данные
Не возвращает данные напрямую — координирует Worker через Plugin Waterfall. Пишет результаты в `enrichment_jobs`.

---

## Agent 4: Extractor Agent

### Назначение
Извлекает структурированные данные из неструктурированных источников: сайт компании, вакансии, новости.

### Sub-agents

#### 4a: Website Extractor
```typescript
interface WebsiteExtractionInput {
  url: string
  companyName: string
  vertical: string
}

interface WebsiteExtractionOutput {
  mainProducts: string[]
  targetClients: string[]
  geographyServed: string[]
  companySize: string | null    // Признаки размера
  techMentions: string[]
  painPointSignals: string[]    // "Ищем решение для..."
  growthSignals: string[]       // "Открыли новый склад..."
  isRelevantToICP: boolean
  icpRelevanceScore: number     // 0-100
  summary: string               // 2-3 предложения об этой компании
}
```

**Процесс**:
1. Playwright → получить текст страниц (главная + О нас + Контакты)
2. Очистить HTML, оставить текст
3. LLM extraction с JSON schema
4. Validate через Zod

#### 4b: Vacancy Extractor
```typescript
interface VacancyExtractionInput {
  vacancies: HHVacancy[]        // Сырые данные с HH.ru
  companyName: string
  vertical: string
}

interface VacancyExtractionOutput {
  growthSignals: string[]       // "Нанимают 5 водителей → рост флота"
  techStack: string[]           // Технологии из требований
  painPoints: string[]          // "хаотичное планирование маршрутов"
  budgetIndicator: 'high' | 'medium' | 'low'
  decisionMakerLevel: string    // Кто нанимает (по уровню вакансий)
  urgencySignals: string[]      // "Срочно", много вакансий
}
```

#### 4c: News Extractor
```typescript
interface NewsExtractionInput {
  companyName: string
  domain?: string
  timeframe: '30d' | '90d' | '1y'
}

interface NewsExtractionOutput {
  recentEvents: string[]        // "Открыли склад в Казани"
  expansionSigns: string[]      // "Выходят в новый регион"
  fundingNews?: string
  painSignals: string[]         // Проблемы, упомянутые в новостях
  triggerEvents: string[]       // Лучшие "крюки" для письма
}
```

### Инструменты
- `playwright_scrape(url)` → raw text
- `google_news_search(query)` → articles
- `structured_extract(text, schema)` → JSON

### Модели
- Extraction: GPT-4o-mini (cheaper, sufficient for extraction)
- Complex reasoning: GPT-4o (fallback if extraction fails)

---

## Agent 5: ICP Scorer Agent

### Назначение
Оценивает соответствие компании Ideal Customer Profile. Гибридный подход: rules-based (fast) + LLM (для пограничных случаев).

### Входные данные
```typescript
interface ICPScorerInput {
  company: Company
  vertical: string
  icpConfig: ICPConfig          // Из verticals/{vertical}/icp.yaml
}
```

### Алгоритм
```
Phase 1: Rule-based (мгновенно, deterministic)
─────────────────────────────────────────────
  score = 0
  FOR EACH rule IN icpConfig.rules:
    IF company[rule.field] matches rule.condition:
      score += rule.weight
  
  IF score > 70 → return { score, source: 'rules', needsLLM: false }
  IF score < 30 → return { score, source: 'rules', needsLLM: false }

Phase 2: LLM scoring (только для 30-70 range, edge cases)
──────────────────────────────────────────────────────────
  Prompt: "Оцени соответствие компании ICP. Данные: {company_data}"
  Model: GPT-4o-mini (дешёвая, достаточно точная)
  Output: { score: 0-100, reasoning: "...", key_signals: [...] }
  
  Final score = weighted_average(rules_score * 0.4 + llm_score * 0.6)
```

### Выходные данные
```typescript
interface ICPScorerOutput {
  score: number              // 0-100
  scoreSource: 'rules' | 'hybrid' | 'llm_only'
  breakdown: Array<{
    rule: string
    matched: boolean
    contribution: number
  }>
  llmReasoning?: string      // Только если LLM использовался
  keySignals: string[]       // Топ-3 сигнала (положительные)
  redFlags: string[]         // Причины низкого score
  recommendation: 'qualified' | 'low_quality' | 'needs_review'
}
```

---

## Agent 6: Writer Agent (Sales Writer)

### Назначение
Генерирует персонализированные email письма на основе реальных данных компании.

### Входные данные
```typescript
interface WriterInput {
  // Company context
  companyName: string
  industry: string
  city: string
  employeesCount?: string
  painPoints: string[]
  techStack: string[]
  growthSignals: string[]
  recentNews: string[]
  openVacancies: string[]       // Из HH.ru
  aiSummary?: string            // AI-описание компании
  websiteInsights?: WebsiteExtractionOutput
  
  // Contact context
  contactName?: string
  contactTitle?: string
  contactSeniority?: string
  
  // Campaign context
  vertical: string
  productValueProp: string      // Что мы предлагаем
  stepNumber: number            // Шаг в последовательности (1, 2, 3...)
  previousSteps?: Array<{       // Что было в предыдущих письмах
    subject: string
    hook: string
    sentAt: Date
  }>
  
  // Generation params
  tone: 'formal' | 'professional' | 'friendly'
  language: 'ru' | 'en'
  maxWords: number              // Default: 100
  generateVariants: number      // Default: 1, max: 3
}
```

### Процесс генерации (5 шагов)

**Шаг 1: Контекстная приоритизация** (без LLM)
```
Выбираем 2-3 наиболее релевантных "крюка":
  - Вакансия водителя → рост флота → оптимизация маршрутов актуальна
  - Упомянули "проблемы с доставкой" → боль очевидна
  - Недавно расширились → сейчас оптимальный момент
  
Правило: первое предложение — о КОМПАНИИ, не о нас
```

**Шаг 2: Prompt Construction**
```typescript
const systemPrompt = loadPromptTemplate(vertical, stepNumber, 'system')
const userPrompt = buildUserPrompt(input, selectedHooks)
```

**Шаг 3: LLM Generation** (GPT-4o)
```json
{
  "subject": "Рост флота в [Компания] — есть опыт оптимизации",
  "body": "Виктор, увидел что [Компания] открывает сразу 3 позиции водителей-экспедиторов. При таком росте флота планирование маршрутов вручную обходится обычно в 25-30% лишних километров. Мы помогаем логистическим компаниям сократить это на 20-35% за первый квартал. Это актуально сейчас?",
  "hook_used": "hiring_signal_fleet_growth",
  "personalization_note": "Использовал вакансии с HH.ru"
}
```

**Шаг 4: Quality Check** (GPT-4o-mini)
```typescript
interface QualityCheckResult {
  personalization: 1 | 2 | 3 | 4 | 5  // Насколько это об этой компании
  clarity: 1 | 2 | 3 | 4 | 5          // Понятно ли ценностное предложение
  callToAction: 1 | 2 | 3 | 4 | 5     // Конкретен ли вопрос в конце
  spamRisk: 1 | 2 | 3 | 4 | 5         // Наличие спам-слов
  overallScore: number                  // weighted average
  issues: string[]                     // Конкретные проблемы
}

// Thresholds:
// spamRisk > 3 → regenerate
// personalization < 3 → regenerate
// Max 2 regeneration attempts
// После 2 неудач → использовать template fallback с human review flag
```

**Шаг 5: Human Review** (опционально, по настройке кампании)
```
IF campaign.settings.require_human_review = true:
  → Сохранить 3 варианта как draft
  → CREATE task для SDR (type=REVIEW_EMAIL)
  → NOTIFY via Telegram с preview
ELSE:
  → Автоматически выбрать вариант с наивысшим overallScore
  → dispatch → email-send-queue
```

### Выходные данные
```typescript
interface WriterOutput {
  variants: Array<{
    subject: string
    bodyText: string
    bodyHtml: string            // Конвертируется из text
    hookUsed: string
    qualityScore: QualityCheckResult
  }>
  selectedVariantIndex: number  // Лучший вариант
  regenerationCount: number
  usedTemplate: boolean         // true если AI не справился
}
```

### Промпт-шаблоны
Хранятся в `verticals/{vertical}/prompts.yaml`, не в коде:
```yaml
# verticals/transport/prompts.yaml
writer:
  step_1:
    system: |
      Ты — опытный B2B sales-менеджер в компании, продающей сервис оптимизации маршрутов.
      Пиши кратко, конкретно, без общих фраз.
      Запрещено: "мы рады предложить", "передовые технологии", "уникальное решение".
      Первое предложение — только о компании получателя, не о нас.
    user_template: |
      Напиши письмо для {{contact_name}} из {{company_name}}.
      
      Данные о компании:
      - Отрасль: {{industry}}
      - Город: {{city}}
      - Рост флота (вакансии): {{vacancies}}
      - Боли: {{pain_points}}
      
      Наш продукт: Сервис оптимизации маршрутов, экономит 20-35% топлива.
      
      Ограничения:
      - Тема: до 8 слов, конкретная
      - Тело: 3-4 предложения
      - Заканчивай конкретным вопросом
      
      Верни JSON: {subject, body, hook_used}
```

---

## Agent 7: Classifier Agent

### Назначение
Классифицирует входящие ответы на cold emails. Определяет намерение и следующее действие.

### Входные данные
```typescript
interface ClassifierInput {
  originalEmail: {
    subject: string
    body: string
    sentAt: Date
  }
  replyText: string             // Очищенный текст ответа (без цитат)
  companyContext: {
    name: string
    industry: string
  }
  language: 'ru' | 'en' | 'auto'
}
```

### Выходные данные
```typescript
interface ClassifierOutput {
  intent: ReplyIntent           // Основной интент
  confidence: number            // 0.0-1.0
  secondaryIntent?: ReplyIntent // Если смешанный
  extractedInfo: {
    preferredTime?: string      // "Лучше после 15 числа"
    contactReference?: string   // "Напишите нашему директору Иванову"
    objection?: string          // "У нас уже есть система"
    question?: string           // "Сколько стоит интеграция?"
    returnDate?: Date           // Для out_of_office
    unsubscribeExplicit: boolean
  }
  suggestedAction: string       // Текстовое описание следующего шага для SDR
  suggestedResponse?: string    // AI-черновик ответа (для question/objection)
  pauseDays?: number            // Для not_now
  urgency: 'low' | 'normal' | 'high' | 'urgent'
}
```

### Модель
GPT-4o-mini (достаточно для классификации, дешевле)

### Критические правила
- `unsubscribe` → обязательно записать в opt-out, даже если confidence низкий
- `confidence < 0.5` → создать задачу для SDR на ручную проверку
- Никогда не продолжать последовательность при `interested` / `request_call`

---

## Agent 8: Follow-up Agent

### Назначение
Определяет оптимальный следующий шаг после активностей с лидом. Корректирует стратегию на основе engagement.

### Входные данные
```typescript
interface FollowUpInput {
  enrollmentHistory: Activity[]    // История взаимодействий
  lastEmailMetrics: {
    opened: boolean
    clicked: boolean
    openCount: number
  }
  currentStep: number
  totalSteps: number
  companyContext: Partial<Company>
}
```

### Логика решений
```
IF last_email.opened_count > 3 AND not_replied:
  → High intent: send engagement-focused message
  → "Виктор, похоже вы изучали наше предложение..."

IF clicked_link AND not_replied:
  → Send case study related to clicked content

IF none_of_previous_opened:
  → Try different subject line angle
  → Try different sender (if A/B configured)

IF at final_step AND no_reply:
  → Send "break-up" message
  → "Буду рад пообщаться если актуально, закрываю переписку"
```

### Выходные данные
```typescript
interface FollowUpDecision {
  action: 'continue' | 'modify_message' | 'pause' | 'stop' | 'escalate'
  reasoning: string
  modificationHints?: string[]   // Для Writer Agent
  pauseDays?: number
  escalationNote?: string        // Для SDR
}
```

---

## Agent 9: Objection Handler Agent

### Назначение
Помогает SDR ответить на возражения лидов. Генерирует черновики ответов.

### Входные данные
```typescript
interface ObjectionHandlerInput {
  objection: string              // "У нас уже есть система X"
  companyContext: Partial<Company>
  vertical: string
  previousInteractions: Activity[]
}
```

### Выходные данные
```typescript
interface ObjectionHandlerOutput {
  objectionType: 'price' | 'competitor' | 'timing' | 'relevance' | 'authority' | 'other'
  analysis: string               // Почему это возражение
  reframingStrategy: string      // Как переформулировать
  suggestedResponse: string      // Черновик ответа (для SDR редактирования)
  talkingPoints: string[]        // Ключевые аргументы
  riskLevel: 'low' | 'medium' | 'high'   // Вероятность потери лида
}
```

### Использование
- Запускается при `intent = 'question'` или `intent = 'technical_question'`
- Результат → Task для SDR с pre-filled текстом
- SDR редактирует и отправляет вручную (не автоматически)

---

## Agent 10: Meeting Preparation Agent

### Назначение
Готовит "боевой лист" для SDR перед звонком или встречей с лидом.

### Когда запускается
- При создании Task типа `SCHEDULE_CALL` или `PREPARE_MEETING`
- За 24 часа до запланированной встречи

### Входные данные
```typescript
interface MeetingPrepInput {
  companyId: string
  contactId: string
  meetingType: 'call' | 'video' | 'in_person'
  scheduledAt: Date
  vertical: string
  dealId?: string
}
```

### Выходные данные (Meeting Brief)
```typescript
interface MeetingBrief {
  executiveSummary: string       // 3-4 предложения о компании

  keyFacts: {
    companySize: string
    revenue: string
    mainProducts: string
    currentChallenges: string[]
    recentNews: string[]
  }
  
  contactProfile: {
    name: string
    title: string
    seniorityContext: string     // Что важно для этой роли
    linkedInInsights?: string   // Если доступно
    communicationStyle: string  // Formal/informal на основе переписки
  }
  
  conversationGuide: {
    openingQuestion: string     // Сильный первый вопрос
    discoveryQuestions: string[]
    painPointsToExplore: string[]
    objectionHandlingTips: string[]
    closingApproach: string
  }
  
  competitiveContext: {
    likelyAlternatives: string[] // Что ещё они рассматривают
    ourAdvantages: string[]
    potentialWeaknesses: string[]
  }
  
  successCriteria: string       // Что считать успехом этого звонка
  nextStepTemplates: string[]   // Варианты next steps предложить
}
```

---

## Agent 11: Dashboard Analyst Agent

### Назначение
Анализирует операционные данные и генерирует insights для SDR и руководства.

### Когда запускается
- Ежедневно в 08:00 (morning briefing)
- По запросу из UI
- При значительном изменении метрик

### Входные данные
```typescript
interface AnalystInput {
  workspaceId: string
  period: '7d' | '30d' | '90d'
  metrics: {
    campaigns: CampaignStats[]
    funnelData: FunnelStats
    aiCostData: AILogStats
    emailDeliverability: DeliverabilityStats
  }
}
```

### Выходные данные
```typescript
interface AnalystOutput {
  headline: string               // Одно ключевое наблюдение
  positiveInsights: string[]     // Что работает хорошо
  concerns: string[]             // Что требует внимания
  recommendations: Array<{
    action: string
    priority: 'high' | 'medium' | 'low'
    expectedImpact: string
    effort: 'easy' | 'medium' | 'hard'
  }>
  anomalies: string[]            // Нетипичные паттерны
  forecastNote: string           // Прогноз на следующий период
}
```

---

## Agent 12: Strategy Agent

### Назначение
Высокоуровневый анализ для CEO/Head of Sales. Рекомендует изменения в стратегии продаж.

### Когда запускается
- Еженедельно
- При запросе от owner/admin
- При достижении или провале ключевых метрик

### Входные данные
Весь агрегированный контекст workspace:
- История сделок (won/lost + reasons)
- Метрики кампаний
- ICP score distribution
- Reply rates по вертикалям
- AI cost vs revenue

### Выходные данные
```typescript
interface StrategyOutput {
  executiveSummary: string
  icpAccuracy: {
    assessment: string
    suggestedAdjustments: string[]
  }
  channelEffectiveness: {
    email: { score: number; recommendation: string }
    telegram?: { score: number; recommendation: string }
  }
  verticalRecommendations: string[]
  resourceAllocation: {
    topPriorityActivities: string[]
    lowROIActivities: string[]
  }
  nextQuarterPriorities: string[]
}
```

---

## Agent 13: Documentation Agent

### Назначение
Автоматически документирует изменения в системе. Обновляет CHANGELOG, генерирует release notes.

### Когда запускается
- После значимых изменений конфигурации
- При добавлении нового плагина
- По запросу разработчика

### Выходные данные
- Обновления в `CHANGELOG.md`
- Описание новых API endpoints
- Обновления в `AI_HANDOFF.md` (pending work section)

---

## Конфигурация агентов (YAML)

```yaml
# packages/ai/agents/config.yaml
agents:
  writer:
    model_primary: gpt-4o
    model_fallback: claude-3-5-sonnet-20241022
    temperature: 0.7
    max_tokens: 500
    timeout_ms: 30000
    max_retries: 2
    quality_check:
      enabled: true
      model: gpt-4o-mini
      regen_on_spam_risk: 3    # >= 3 → regenerate
      regen_on_low_personalization: 3
      
  classifier:
    model_primary: gpt-4o-mini
    model_fallback: gpt-4o
    temperature: 0.1           # Low temp for classification
    max_tokens: 300
    timeout_ms: 10000
    max_retries: 2
    
  extractor:
    website:
      model_primary: gpt-4o-mini
      max_tokens: 1000
      timeout_ms: 60000        # Playwright takes time
    vacancy:
      model_primary: gpt-4o-mini
      max_tokens: 500
    news:
      model_primary: gpt-4o-mini
      max_tokens: 500
      
  icp_scorer:
    model_primary: gpt-4o-mini
    only_for_range: [30, 70]   # LLM только для edge cases
    temperature: 0.2
    
  meeting_prep:
    model_primary: gpt-4o
    max_tokens: 2000
    temperature: 0.5
    
  analyst:
    model_primary: gpt-4o
    temperature: 0.3
    schedule: "0 8 * * 1-5"   # Weekdays at 8am
```

---

## Observability

### Каждый вызов агента записывает в ai_logs:
```typescript
{
  agent: 'writer',
  model: 'gpt-4o',
  provider: 'openai',
  prompt_tokens: 850,
  completion_tokens: 180,
  cost_usd: 0.00714,
  latency_ms: 2340,
  success: true,
  input_hash: 'sha256...',      // Для дедупликации
  output_preview: 'Виктор, увидел что...',
  entity_type: 'enrollment',
  entity_id: 'uuid...',
  occurred_at: '2025-07-01T10:30:00Z'
}
```

### Дашборд метрик AI
- Стоимость по агенту за день/неделю
- Средняя latency по агенту
- Quality score trends (на основе reply rates vs generation params)
- Error rate и fallback frequency
- Regeneration rate (сколько писем требуют повторной генерации)

### Бюджетные лимиты
```typescript
// Per workspace per day
const AI_BUDGET_LIMITS = {
  trial:      { daily_usd: 1.0,  monthly_usd: 20 },
  starter:    { daily_usd: 5.0,  monthly_usd: 100 },
  pro:        { daily_usd: 20.0, monthly_usd: 400 },
  enterprise: { daily_usd: 100,  monthly_usd: 2000 },
}

// При превышении: STOP + уведомление owner + не блокировать manual operations
```
