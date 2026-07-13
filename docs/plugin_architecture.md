# Plugin Architecture — AI Sales OS
> Любой внешний провайдер реализуется как Plugin. Ядро системы никогда не знает о конкретных провайдерах — только об интерфейсах.

---

## Философия

**"Open for extension, closed for modification"**

Добавление нового источника данных, нового email-провайдера или нового AI-провайдера НЕ требует изменения ядра системы. Достаточно:
1. Реализовать интерфейс
2. Зарегистрировать в Plugin Registry
3. Добавить конфиг (env vars / workspace settings)

---

## Архитектура Plugin System

```
┌──────────────────────────────────────────────────────────────────┐
│                        CORE (ядро системы)                        │
│                                                                    │
│  ┌──────────────────┐    ┌──────────────────┐                    │
│  │  Plugin Registry  │    │ Plugin Lifecycle  │                   │
│  │  (инвентарь)      │    │ Manager           │                   │
│  └────────┬─────────┘    └──────────────────┘                    │
│           │ resolves                                               │
│           ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                  PLUGIN INTERFACES                         │    │
│  │  ILeadSourcePlugin  IEmailFinderPlugin  IEmailSendPlugin  │    │
│  │  ILLMPlugin  IStoragePlugin  INotificationPlugin  ...     │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────────────┘
                           │ implements
┌──────────────────────────▼───────────────────────────────────────┐
│                    PLUGIN IMPLEMENTATIONS                          │
│                                                                    │
│  lead-sources/     enrichment/      email/        ai/             │
│  ├── 2gis          ├── hunter.io    ├── mailgun   ├── openai      │
│  ├── hhru          ├── snov.io      ├── brevo     ├── anthropic   │
│  ├── vk            ├── dadata       ├── ses       ├── gigachat    │
│  └── csv-import    ├── egrul        └── smtp      └── yandexgpt   │
│                    └── pattern                                     │
│                                                                    │
│  storage/          notifications/   crm-sync/                      │
│  ├── s3            ├── telegram     ├── bitrix24                  │
│  └── minio         └── slack        └── amocrm                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Категории плагинов и интерфейсы

### 1. ILeadSourcePlugin — Источники лидов

```typescript
// packages/plugins/interfaces/lead-source.interface.ts

export interface LeadSearchParams {
  workspaceId: string
  industry?: string[]
  city?: string[]
  region?: string[]
  keywords?: string[]
  employees_min?: number
  employees_max?: number
  limit?: number
  cursor?: string           // Для пагинации
}

export interface LeadSearchResult {
  companies: RawCompanyData[]
  nextCursor?: string
  totalEstimate?: number
}

export interface RawCompanyData {
  source: string            // '2gis' | 'hhru' | etc.
  sourceId: string          // Уникальный ID в источнике
  name: string
  inn?: string
  domain?: string
  city?: string
  industry?: string
  phone?: string
  website?: string
  employees_count?: string
  raw?: Record<string, unknown>  // Raw data from source
}

export interface ILeadSourcePlugin {
  readonly name: string           // '2gis' | 'hhru' | 'vk' | 'csv'
  readonly displayName: string    // Для UI
  readonly category: 'lead_source'
  
  isConfigured(workspaceId: string): Promise<boolean>
  search(params: LeadSearchParams): Promise<LeadSearchResult>
  getCompanyDetails?(sourceId: string): Promise<RawCompanyData>
}
```

### 2. IEmailFinderPlugin — Поиск email

```typescript
// packages/plugins/interfaces/email-finder.interface.ts

export interface EmailFinderParams {
  domain?: string
  companyName?: string
  firstName?: string
  lastName?: string
  title?: string
}

export interface EmailFinderResult {
  email?: string
  confidence: number        // 0.0 – 1.0
  source: string            // Провайдер который нашёл
  verificationStatus?: 'valid' | 'invalid' | 'catch_all' | 'unknown'
  allEmails?: Array<{       // Опционально: все найденные
    email: string
    confidence: number
    firstName?: string
    lastName?: string
    title?: string
  }>
}

export interface IEmailFinderPlugin {
  readonly name: string
  readonly displayName: string
  readonly category: 'email_finder'
  readonly costPerLookup?: number  // USD, для tracking
  
  isConfigured(workspaceId: string): Promise<boolean>
  findEmail(params: EmailFinderParams): Promise<EmailFinderResult>
  verifyEmail?(email: string): Promise<{ status: string; score: number }>
  getRemainingCredits?(): Promise<number>
}
```

### 3. ICompanyDataPlugin — Обогащение данных компании

```typescript
// packages/plugins/interfaces/company-data.interface.ts

export interface CompanyDataParams {
  inn?: string
  ogrn?: string
  companyName?: string
  workspaceId: string
}

export interface CompanyDataResult {
  inn?: string
  ogrn?: string
  legal_name?: string
  director_name?: string
  registration_date?: string
  status?: 'active' | 'liquidating' | 'liquidated'
  revenue_rub?: number
  employees_count?: string
  address?: string
  okved_code?: string
  okved_name?: string
  raw?: Record<string, unknown>
}

export interface ICompanyDataPlugin {
  readonly name: string
  readonly displayName: string
  readonly category: 'company_data'
  
  isConfigured(workspaceId: string): Promise<boolean>
  getCompanyData(params: CompanyDataParams): Promise<CompanyDataResult | null>
}
```

### 4. IEmailSendingPlugin — Отправка email

```typescript
// packages/plugins/interfaces/email-sending.interface.ts

export interface SendEmailParams {
  from: { email: string; name: string }
  to: { email: string; name?: string }
  subject: string
  htmlBody: string
  textBody?: string
  headers?: Record<string, string>
  tags?: string[]
  trackingEnabled?: boolean
  trackingDomain?: string
}

export interface SendEmailResult {
  messageId: string         // Provider's message ID
  status: 'queued' | 'sent' | 'rejected'
  rejectReason?: string
}

export interface EmailWebhookEvent {
  messageId: string
  event: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'unsubscribed'
  timestamp: Date
  metadata?: {
    bounceType?: 'hard' | 'soft'
    clickUrl?: string
    userAgent?: string
    ip?: string
  }
}

export interface IEmailSendingPlugin {
  readonly name: string
  readonly displayName: string
  readonly category: 'email_sending'
  
  isConfigured(workspaceId: string): Promise<boolean>
  send(params: SendEmailParams): Promise<SendEmailResult>
  validateWebhook(headers: Record<string, string>, body: string): boolean
  parseWebhookEvent(body: unknown): EmailWebhookEvent
  getDomainReputation?(domain: string): Promise<{ score: number; issues: string[] }>
}
```

### 5. ILLMPlugin — AI провайдер

```typescript
// packages/plugins/interfaces/llm.interface.ts

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMCallParams {
  messages: LLMMessage[]
  model?: string            // Если не указан — default для провайдера
  temperature?: number
  maxTokens?: number
  responseFormat?: 'text' | 'json_object'
  stream?: boolean
}

export interface LLMCallResult {
  content: string
  model: string             // Фактически использованная модель
  inputTokens: number
  outputTokens: number
  costUsd: number           // Расчётная стоимость
  latencyMs: number
}

export interface ILLMPlugin {
  readonly name: string           // 'openai' | 'anthropic' | 'gigachat'
  readonly displayName: string
  readonly category: 'llm'
  readonly defaultModel: string
  readonly models: string[]       // Доступные модели
  
  isConfigured(workspaceId: string): Promise<boolean>
  call(params: LLMCallParams): Promise<LLMCallResult>
  stream?(params: LLMCallParams): AsyncIterable<string>
  estimateCost(inputTokens: number, outputTokens: number, model: string): number
}
```

### 6. INotificationPlugin — Уведомления

```typescript
// packages/plugins/interfaces/notification.interface.ts

export interface NotificationPayload {
  recipientId: string         // workspaceUserId
  title: string
  message: string
  urgency: 'low' | 'normal' | 'high' | 'urgent'
  actions?: Array<{           // Кнопки (для Telegram inline keyboard)
    label: string
    action: string
    data?: string
  }>
  metadata?: Record<string, unknown>
}

export interface INotificationPlugin {
  readonly name: string
  readonly displayName: string
  readonly category: 'notification'
  
  isConfigured(workspaceId: string): Promise<boolean>
  send(workspaceId: string, payload: NotificationPayload): Promise<void>
  getRecipientId?(userId: string): Promise<string | null>  // Map user to channel ID
}
```

### 7. IStoragePlugin — Хранилище файлов

```typescript
// packages/plugins/interfaces/storage.interface.ts

export interface IStoragePlugin {
  readonly name: string
  readonly category: 'storage'
  
  upload(key: string, data: Buffer, mimeType: string): Promise<{ url: string }>
  download(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  getSignedUrl(key: string, expiresIn: number): Promise<string>
}
```

---

## Plugin Registry

```typescript
// packages/plugins/registry/plugin-registry.ts

import type { ILeadSourcePlugin, IEmailFinderPlugin, IEmailSendingPlugin, ILLMPlugin } from '../interfaces'

type PluginCategory =
  | 'lead_source'
  | 'email_finder'
  | 'company_data'
  | 'email_sending'
  | 'llm'
  | 'notification'
  | 'storage'
  | 'crm_sync'

type AnyPlugin = ILeadSourcePlugin | IEmailFinderPlugin | IEmailSendingPlugin | ILLMPlugin

interface PluginEntry {
  plugin: AnyPlugin
  category: PluginCategory
  priority: number              // Для waterfall: меньше = выше приоритет
  enabled: boolean
}

class PluginRegistry {
  private plugins = new Map<string, PluginEntry>()

  register(entry: PluginEntry): void {
    this.plugins.set(entry.plugin.name, entry)
  }

  getByCategory<T extends AnyPlugin>(category: PluginCategory): T[] {
    return Array.from(this.plugins.values())
      .filter(e => e.category === category && e.enabled)
      .sort((a, b) => a.priority - b.priority)
      .map(e => e.plugin as T)
  }

  get<T extends AnyPlugin>(name: string): T {
    const entry = this.plugins.get(name)
    if (!entry) throw new Error(`Plugin '${name}' not registered`)
    return entry.plugin as T
  }
  
  isRegistered(name: string): boolean {
    return this.plugins.has(name)
  }
}

export const registry = new PluginRegistry()
```

---

## Plugin Registration (точка входа)

```typescript
// packages/plugins/registry/register-all.ts
// Вызывается при старте приложения

import { registry } from './plugin-registry'

// Lead Sources
import { TwoGISPlugin } from '../implementations/lead-sources/2gis'
import { HHRuPlugin } from '../implementations/lead-sources/hhru'
import { CSVImportPlugin } from '../implementations/lead-sources/csv-import'

// Email Finders
import { HunterPlugin } from '../implementations/enrichment/hunter'
import { SnovPlugin } from '../implementations/enrichment/snov'

// Company Data
import { DadataPlugin } from '../implementations/enrichment/dadata'
import { EgrulPlugin } from '../implementations/enrichment/egrul'

// Email Sending
import { MailgunPlugin } from '../implementations/email/mailgun'
import { BrevoPlugin } from '../implementations/email/brevo'

// LLM Providers
import { OpenAIPlugin } from '../implementations/ai/openai'
import { AnthropicPlugin } from '../implementations/ai/anthropic'

// Notifications
import { TelegramPlugin } from '../implementations/notifications/telegram'

// Storage
import { MinIOPlugin } from '../implementations/storage/minio'

export function registerAllPlugins() {
  // Lead Sources
  registry.register({ plugin: new TwoGISPlugin(), category: 'lead_source', priority: 1, enabled: !!process.env.TWOGIS_API_KEY })
  registry.register({ plugin: new HHRuPlugin(), category: 'lead_source', priority: 2, enabled: true })
  registry.register({ plugin: new CSVImportPlugin(), category: 'lead_source', priority: 99, enabled: true })

  // Email Finders (waterfall order: priority = пробуем в таком порядке)
  registry.register({ plugin: new HunterPlugin(), category: 'email_finder', priority: 1, enabled: !!process.env.HUNTER_API_KEY })
  registry.register({ plugin: new SnovPlugin(), category: 'email_finder', priority: 2, enabled: !!process.env.SNOV_API_KEY })

  // Company Data
  registry.register({ plugin: new DadataPlugin(), category: 'company_data', priority: 1, enabled: !!process.env.DADATA_API_KEY })
  registry.register({ plugin: new EgrulPlugin(), category: 'company_data', priority: 2, enabled: true })

  // Email Sending
  registry.register({ plugin: new MailgunPlugin(), category: 'email_sending', priority: 1, enabled: !!process.env.MAILGUN_API_KEY })
  registry.register({ plugin: new BrevoPlugin(), category: 'email_sending', priority: 2, enabled: !!process.env.BREVO_API_KEY })

  // LLM (waterfall для fallback)
  registry.register({ plugin: new OpenAIPlugin(), category: 'llm', priority: 1, enabled: !!process.env.OPENAI_API_KEY })
  registry.register({ plugin: new AnthropicPlugin(), category: 'llm', priority: 2, enabled: !!process.env.ANTHROPIC_API_KEY })

  // Notifications
  registry.register({ plugin: new TelegramPlugin(), category: 'notification', priority: 1, enabled: !!process.env.TELEGRAM_BOT_TOKEN })

  // Storage
  registry.register({ plugin: new MinIOPlugin(), category: 'storage', priority: 1, enabled: true })
}
```

---

## Как реализовать новый плагин

### Пошаговая инструкция (пример: добавление Clearbit как enrichment)

**Шаг 1: Создать файл плагина**
```typescript
// packages/plugins/implementations/enrichment/clearbit.ts

import type { IEmailFinderPlugin, EmailFinderParams, EmailFinderResult } from '../../interfaces'

export class ClearbitPlugin implements IEmailFinderPlugin {
  readonly name = 'clearbit'
  readonly displayName = 'Clearbit'
  readonly category = 'email_finder' as const
  readonly costPerLookup = 0.04  // USD

  async isConfigured(workspaceId: string): Promise<boolean> {
    // Check: does this workspace have Clearbit API key configured?
    const apiKey = await getWorkspaceApiKey(workspaceId, 'clearbit')
    return !!apiKey
  }

  async findEmail(params: EmailFinderParams): Promise<EmailFinderResult> {
    const apiKey = await getWorkspaceApiKey(params.workspaceId!, 'clearbit')
    
    const response = await fetch(`https://person.clearbit.com/v2/combined/find?domain=${params.domain}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000)   // 10s timeout
    })
    
    if (!response.ok) {
      if (response.status === 404) return { confidence: 0, source: 'clearbit' }
      throw new Error(`Clearbit API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    return {
      email: data.person?.email,
      confidence: data.person?.email ? 0.9 : 0,
      source: 'clearbit',
      verificationStatus: data.person?.email ? 'valid' : 'unknown'
    }
  }
}
```

**Шаг 2: Зарегистрировать**
```typescript
// В packages/plugins/registry/register-all.ts — добавить:
import { ClearbitPlugin } from '../implementations/enrichment/clearbit'

registry.register({
  plugin: new ClearbitPlugin(),
  category: 'email_finder',
  priority: 3,    // После Hunter (1) и Snov (2)
  enabled: !!process.env.CLEARBIT_API_KEY
})
```

**Шаг 3: Добавить env var**
```bash
# .env.example
CLEARBIT_API_KEY=<your_clearbit_api_key>
```

**Шаг 4: Написать тест**
```typescript
// packages/plugins/implementations/enrichment/__tests__/clearbit.test.ts

import { ClearbitPlugin } from '../clearbit'
import { vi, describe, it, expect } from 'vitest'

vi.mock('fetch') // Mock fetch

describe('ClearbitPlugin', () => {
  it('returns email when found', async () => {
    // ... test implementation
  })
  
  it('returns empty result on 404', async () => {
    // ... test implementation
  })
  
  it('throws on API error', async () => {
    // ... test implementation
  })
})
```

**ВСЁ.** Ядро системы не изменяется.

---

## Waterfall Orchestrator

```typescript
// packages/plugins/waterfall.ts

import { registry } from './registry'
import type { IEmailFinderPlugin, EmailFinderParams } from './interfaces'
import { logger } from '../logger'

export async function waterfallEmailFind(
  params: EmailFinderParams,
  workspaceId: string
): Promise<{ email: string; source: string; confidence: number } | null> {
  
  const finders = registry.getByCategory<IEmailFinderPlugin>('email_finder')
  
  for (const finder of finders) {
    // Skip if not configured for this workspace
    if (!await finder.isConfigured(workspaceId)) continue
    
    try {
      const result = await finder.findEmail({ ...params, workspaceId })
      
      if (result.email && result.confidence >= 0.3) {
        logger.info({
          event: 'email.found',
          provider: finder.name,
          confidence: result.confidence,
          workspaceId
        })
        return { email: result.email, source: finder.name, confidence: result.confidence }
      }
    } catch (error) {
      logger.warn({
        event: 'email_finder.error',
        provider: finder.name,
        error: (error as Error).message,
        workspaceId
      })
      // Continue to next provider
    }
  }
  
  // Pattern-based fallback
  if (params.firstName && params.domain) {
    const guessedEmail = `${params.firstName.toLowerCase()}@${params.domain}`
    return { email: guessedEmail, source: 'pattern', confidence: 0.2 }
  }
  
  return null
}
```

---

## Workspace-level Plugin Configuration

Каждый workspace может иметь свои API ключи для плагинов:

```typescript
// Workspace может переопределить системные ключи своими
// (например, Enterprise клиент со своим OpenAI аккаунтом)

async function getWorkspaceApiKey(workspaceId: string, service: string): Promise<string | null> {
  // 1. Check workspace-specific key
  const workspaceKey = await db.query.api_keys.findFirst({
    where: and(
      eq(api_keys.workspace_id, workspaceId),
      eq(api_keys.service, service),
      eq(api_keys.is_active, true)
    )
  })
  
  if (workspaceKey) {
    return decryptApiKey(workspaceKey.key_encrypted)
  }
  
  // 2. Fall back to system-wide key (from env vars)
  const envKey = process.env[`${service.toUpperCase()}_API_KEY`]
  return envKey || null
}
```

---

## Маршрутизация плагинов per-vertical

```yaml
# verticals/transport/sources.yaml
# Приоритет источников для вертикали "транспорт"

lead_sources:
  - plugin: 2gis
    priority: 1
    search_params:
      rubrics: [transport, logistics, courier, cargo]
  - plugin: hhru
    priority: 2
    search_params:
      industries: [transport, supply_chain]

enrichment:
  email_finder:
    - plugin: hunter
      priority: 1
    - plugin: snov
      priority: 2
  company_data:
    - plugin: dadata    # ЕГРЮЛ/Dadata для РФ
      priority: 1
```

---

## Добавление плагина без кода (конфигурационный плагин)

Для простых HTTP API без бизнес-логики — достаточно YAML:

```yaml
# packages/plugins/implementations/enrichment/custom-api.yaml
# Generic HTTP API plugin (для быстрых интеграций)

name: my_custom_data
displayName: "My Custom Data API"
category: company_data
type: http_generic

config:
  base_url: https://api.mycustomdata.com/v1
  auth:
    type: bearer
    env_key: MY_CUSTOM_API_KEY
  
endpoints:
  getCompanyData:
    method: GET
    path: /companies/lookup
    params:
      inn: "{{inn}}"
    response_mapping:
      legal_name: data.official_name
      director: data.ceo_name
      revenue: data.annual_revenue
```

---

## Plugin Health & Circuit Breaker

```typescript
// packages/plugins/circuit-breaker.ts

interface CircuitState {
  failures: number
  lastFailureAt: Date | null
  openUntil: Date | null
}

const states = new Map<string, CircuitState>()

export function isCircuitOpen(pluginName: string): boolean {
  const state = states.get(pluginName)
  if (!state || !state.openUntil) return false
  if (new Date() > state.openUntil) {
    // Half-open: allow one request through
    state.openUntil = null
    return false
  }
  return true
}

export function recordSuccess(pluginName: string): void {
  states.set(pluginName, { failures: 0, lastFailureAt: null, openUntil: null })
}

export function recordFailure(pluginName: string): void {
  const state = states.get(pluginName) ?? { failures: 0, lastFailureAt: null, openUntil: null }
  state.failures++
  state.lastFailureAt = new Date()
  
  if (state.failures >= 5) {
    // Open circuit for 30 minutes
    state.openUntil = new Date(Date.now() + 30 * 60 * 1000)
    logger.warn({ event: 'circuit_breaker.opened', plugin: pluginName })
  }
  
  states.set(pluginName, state)
}
```

---

## Checklist для нового плагина

Перед тем как считать плагин готовым:

- [ ] Реализует соответствующий Interface полностью
- [ ] `isConfigured()` корректно проверяет наличие API ключа
- [ ] Timeout настроен (AbortSignal.timeout)
- [ ] Ошибки не проглатываются (throw, не return null при API error)
- [ ] Unit тесты с mock HTTP responses
- [ ] Зарегистрирован в `register-all.ts`
- [ ] `env_key` добавлен в `.env.example`
- [ ] ADR создан если выбор провайдера нетривиален
- [ ] `costPerLookup` указан для платных API (для cost tracking)
