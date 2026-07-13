# Platform Vision — AI Sales OS
> Думаем за горизонт MVP. Архитектура универсальной AI Sales Operating System.

---

## От инструмента к платформе

```
СЕЙЧАС (MVP)                    ЗАВТРА                      БУДУЩЕЕ
─────────────                   ──────────                  ───────────────
Один продукт                    Несколько вертикалей        Marketplace
(Route Optimization)            (транспорт, строительство)  (любой B2B)
                    
Один канал                      Email + Telegram            Омниканальность
(Email outreach)                + LinkedIn                   + Voice + Video
                    
Один регион (РФ)                РФ + СНГ                    Глобально
                    
Один workspace                  Multi-team                  Multi-org
                    
Фиксированные агенты            Настраиваемые агенты        User-defined agents
                    
Фиксированные плагины           Plugin marketplace          Third-party plugins
```

---

## Целевая архитектура: Universal AI Sales OS

```
╔═══════════════════════════════════════════════════════════════════════╗
║                    AI SALES OPERATING SYSTEM                          ║
║                                                                        ║
║  ┌─────────────────────────────────────────────────────────────────┐  ║
║  │                       MARKETPLACE                                │  ║
║  │  Plugins │ Verticals │ AI Agents │ Prompts │ ICP Templates       │  ║
║  │  (созданные сообществом и партнёрами)                            │  ║
║  └─────────────────────────────────────────────────────────────────┘  ║
║                              │                                         ║
║  ┌─────────────────────────────────────────────────────────────────┐  ║
║  │                    PLATFORM CORE                                  │  ║
║  │                                                                   │  ║
║  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │  ║
║  │  │ AI          │  │ Outreach     │  │ CRM                    │  │  ║
║  │  │ Orchestrator│  │ Engine       │  │ Engine                 │  │  ║
║  │  └─────────────┘  └──────────────┘  └────────────────────────┘  │  ║
║  │                                                                   │  ║
║  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │  ║
║  │  │ Enrichment  │  │ Analytics    │  │ Automation             │  │  ║
║  │  │ Engine      │  │ Engine       │  │ Engine                 │  │  ║
║  │  └─────────────┘  └──────────────┘  └────────────────────────┘  │  ║
║  │                                                                   │  ║
║  │  ┌────────────────────────────────────────────────────────────┐  │  ║
║  │  │              PLUGIN LAYER (extensible)                      │  │  ║
║  │  │  Lead Sources │ CRM Sync │ AI Providers │ Communication     │  │  ║
║  │  └────────────────────────────────────────────────────────────┘  │  ║
║  └─────────────────────────────────────────────────────────────────┘  ║
║                              │                                         ║
║  ┌─────────────────────────────────────────────────────────────────┐  ║
║  │                    MULTI-TENANT PLATFORM                          │  ║
║  │                                                                   │  ║
║  │  Organization A     Organization B     Organization C             │  ║
║  │  ├── Workspace 1    ├── Workspace 1    └── Workspace 1            │  ║
║  │  ├── Workspace 2    └── Workspace 2                               │  ║
║  │  └── Workspace N                                                  │  ║
║  └─────────────────────────────────────────────────────────────────┘  ║
╚═══════════════════════════════════════════════════════════════════════╝
```

---

## 1. Многоуровневая мультитенантность

### Текущая модель (MVP)
```
Workspace → Users, Companies, Campaigns
```

### Будущая модель
```
Organization (enterprise client)
  └── Workspace A (команда продаж РФ)
  │     └── Users, Data, Campaigns
  └── Workspace B (команда продаж СНГ)
  │     └── Users, Data, Campaigns
  └── Workspace C (продукт X)
        └── Users, Data, Campaigns

Organization-level:
  - Consolidated billing
  - Shared AI budget pool
  - Cross-workspace analytics
  - Shared contact exclusion lists
  - SSO/SAML
  - Dedicated infrastructure (for enterprise)
```

### Технические изменения (когда понадобится)
```sql
-- Добавить organizations таблицу
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  plan VARCHAR NOT NULL,         -- enterprise, agency
  settings JSONB DEFAULT '{}'
);

-- Workspaces получают organization_id
ALTER TABLE workspaces ADD COLUMN organization_id UUID REFERENCES organizations(id);
```

---

## 2. Многоканальный Outreach

### MVP: Email only
### Phase 2: Email + Telegram notifications
### Future: Full omnichannel

```
┌─────────────────────────────────────────────────────────────────┐
│                    OUTREACH ORCHESTRATOR                          │
│                                                                   │
│  Принимает решение о СЛЕДУЮЩЕМ ЛУЧШЕМ ДЕЙСТВИИ с лидом           │
│  на основе: история взаимодействий + ICP + engagement signals     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                       │
    ▼                      ▼                       ▼
┌───────┐           ┌──────────────┐        ┌──────────────┐
│ Email │           │ LinkedIn     │        │ Phone/Voice  │
│       │           │ (InMail +    │        │ (Vapi.ai     │
│ MVP ✅│           │  Connection) │        │  integration)│
└───────┘           └──────────────┘        └──────────────┘
    │                      │                       │
    ▼                      ▼                       ▼
┌───────┐           ┌──────────────┐        ┌──────────────┐
│Mailgun│           │LinkedIn API  │        │ AI Voice     │
│Brevo  │           │Sales Nav API │        │ Agent        │
│SES    │           │(future)      │        │(future)      │
└───────┘           └──────────────┘        └──────────────┘
```

### IOutreachPlugin interface (future)
```typescript
export interface IOutreachPlugin {
  readonly channel: 'email' | 'linkedin' | 'phone' | 'whatsapp' | 'telegram'
  
  canReach(contact: Contact): Promise<boolean>
  sendMessage(params: OutreachParams): Promise<OutreachResult>
  getEngagementMetrics?(messageId: string): Promise<EngagementMetrics>
}
```

---

## 3. Marketplace плагинов

### Концепция
Любой разработчик или партнёр может создать плагин для платформы и опубликовать его в Marketplace.

```
Developer creates plugin
    │ implements PluginInterface
    ├─ registers manifest.yaml
    ├─ submits to review
    └─ published to Marketplace

User (workspace) installs plugin
    │ one-click install
    ├─ plugin appears in Plugin Registry
    └─ user configures API keys
```

### Plugin Manifest (будущий стандарт)
```yaml
# plugin-manifest.yaml
name: linkedin-sales-navigator
displayName: "LinkedIn Sales Navigator"
version: "1.2.0"
author: "Partner Corp"
category: lead_source
description: "Find B2B prospects on LinkedIn"

pricing:
  model: per_call
  price_usd: 0.05

config_schema:
  - key: LINKEDIN_CLIENT_ID
    label: "LinkedIn Client ID"
    type: oauth_client_id
  - key: LINKEDIN_CLIENT_SECRET
    label: "LinkedIn Client Secret"
    type: secret

permissions:
  - read:contacts
  - write:companies
  
compatibility:
  platform_version: ">=2.0"
```

### Revenue sharing
- Platform: 30% от monthly plugin revenue
- Plugin developer: 70%

---

## 4. Пользовательские AI-агенты

### Phase 3: User-defined agents
Пользователи смогут создавать собственных AI-агентов без кода:

```yaml
# Custom agent definition (UI-based)
name: My Construction Prospector
description: Finds and qualifies construction companies

trigger:
  event: company.created
  condition: industry == 'construction'

steps:
  - type: ai_analysis
    prompt: |
      Проанализируй строительную компанию {{company.name}}.
      Найди признаки: активные стройки, тендеры, рост.
    output_field: construction_signals

  - type: score_update
    field: icp_score
    formula: "base_score + (construction_signals.count * 5)"

  - type: conditional
    if: icp_score > 70
    then:
      - type: enroll_in_campaign
        campaign: construction-outreach
```

---

## 5. White-label режим

### Для агентств и партнёров
```
Agency (white-label partner)
  └── Client A (powered by AI Sales OS, branded as "Agency's Tool")
  └── Client B
  └── Client N

Features:
  - Custom domain: crm.agency.com
  - Custom branding: logo, colors, name
  - Agency manages billing (reseller model)
  - Agency owns client data
  - Consolidated agency analytics
```

### Технические требования
- Per-workspace theme configuration (colors, logo, custom CSS)
- Custom email templates with agency branding
- Custom Telegram bot per agency
- Subdomain routing: `{client_slug}.{agency_domain}.com`

---

## 6. Self-hosted Edition

### Для enterprise-клиентов с требованиями суверенности данных

```
Standard (cloud, SaaS):
  → AI Sales OS manages infrastructure
  → Data on AI Sales OS servers
  → Shared Postgres cluster (RLS)

Professional (cloud, dedicated):
  → Dedicated Postgres instance
  → Dedicated Redis
  → AI Sales OS manages infra

Enterprise (self-hosted):
  → Customer installs on their infrastructure
  → License-based pricing
  → Docker Compose или K8s Helm chart
  → No data leaves customer's servers
  → AI API calls can use customer's own OpenAI account
```

### Self-hosted requirements
- Helm chart с всеми компонентами
- License server (phone-home для validation)
- Offline mode для air-gapped environments
- Migration tool: cloud → self-hosted и обратно

---

## 7. API и автоматизация

### Public API (Phase 4)
```
AI Sales OS Public API

Authentication: Bearer token (per workspace)
Rate limits: per plan

Endpoints:
  POST /api/v1/companies              Create/import company
  POST /api/v1/companies/{id}/enrich  Trigger enrichment
  GET  /api/v1/companies              List with filters
  POST /api/v1/campaigns/{id}/enroll  Add company to campaign
  GET  /api/v1/analytics/funnel       Funnel stats
  
Webhooks (outbound):
  company.qualified
  email.replied
  deal.won
  deal.lost
```

### Интеграции через API
```
Zapier app:
  Triggers: New qualified lead, Reply received, Deal won
  Actions: Add company, Start campaign, Create task

n8n node:
  Full API access
  
Make (Integromat):
  Pre-built scenarios
```

---

## 8. AI Orchestration Platform (долгосрочно)

### Концепция: AI Sales Brain
Не просто инструмент — операционный мозг для B2B продаж, который:

```
┌─────────────────────────────────────────────────────────────────┐
│                    STRATEGIC INTELLIGENCE                         │
│                                                                   │
│  "Ты теряешь 30% лидов на этапе ENRICHED→QUALIFIED.             │
│   Причина: в строительной вертикали email не находится           │
│   у 60% компаний. Рекомендация: добавить LinkedIn outreach       │
│   как альтернативный канал для этой вертикали."                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    PREDICTIVE MODELS                              │
│                                                                   │
│  Churn prediction: "Клиент X вероятно отпишется через 2 месяца   │
│  (паттерн: снижение активности на дашборде, не отвечает SDR)"   │
│                                                                   │
│  Deal scoring: "Эта сделка с вероятностью 78% закроется           │
│  в течение 30 дней (паттерн: 3+ активности, демо проведено)"     │
│                                                                   │
│  Best time to send: ML-модель на основе миллионов писем          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    AUTONOMOUS CAMPAIGNS                           │
│                                                                   │
│  AI сам:                                                          │
│  - Ищет лидов по описанию ("найди 100 логистических компаний     │
│    в Сибири с автопарком 50+ машин")                              │
│  - Строит кампанию под вертикаль                                  │
│  - Итерирует промпты на основе reply rates                       │
│  - Масштабирует успешные шаблоны                                  │
│  - Останавливает неэффективные                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Эволюция без полного переписывания

### Ключевые архитектурные решения, которые делают это возможным

| Решение | Почему позволяет масштабироваться |
|---------|----------------------------------|
| **Plugin Interface** | Любой новый провайдер без изменения ядра |
| **Event-Driven через Queue** | Workers могут масштабироваться независимо |
| **JSONB для гибких полей** | Схема данных не ограничивает |
| **Vertical configs (YAML)** | Новая вертикаль за 1 день без кода |
| **Modular Monolith** | Любой модуль → отдельный сервис без переписывания API |
| **workspace_id everywhere** | Organization layer добавляется как новый уровень |
| **Soft deletes** | Данные сохраняются, аудит работает |
| **Versioned API** | Breaking changes не ломают клиентов |

### Roadmap перехода
```
Phase 1 (сейчас): Modular Monolith on Docker Compose
    ↓
Phase 2 (500+ workspaces): 
    - Workers → separate services
    - Managed PostgreSQL + Redis
    ↓
Phase 3 (5000+ workspaces):
    - Kubernetes + HPA (Horizontal Pod Autoscaler)
    - PostgreSQL read replica
    - CDN
    ↓
Phase 4 (multi-region):
    - Active-passive failover regions
    - Data residency per region (EU, RU, APAC)
    - Global load balancer
    ↓
Phase 5 (Platform):
    - Marketplace infrastructure
    - Multi-organization support
    - White-label infrastructure
    - Self-hosted edition
```

---

## 10. Метрики, которые изменятся при масштабировании

| Метрика | MVP | 500 WS | 5000 WS | Platform |
|---------|-----|--------|---------|---------|
| Companies per WS | 10K | 100K | 1M | 10M+ |
| Emails/day total | 1K | 100K | 1M | 10M+ |
| AI calls/day | 500 | 50K | 500K | 5M+ |
| Concurrent workers | 5 | 50 | 500 | 5000+ |
| DB size | 10GB | 1TB | 10TB | 100TB+ |
| Tech change needed | None | Read replica | K8s | Sharding |

---

## 11. Риски долгосрочного масштабирования

| Риск | Порог | Митигация |
|------|-------|-----------|
| PostgreSQL sharding | 100M+ companies | Vitess или CockroachDB |
| AI cost runaway | >$50K/month | Fine-tuned smaller models |
| Email reputation pooling | 10M+ emails/day | Dedicated IP pool rotation |
| LLM качество устаревает | GPT-5/6 появится | Vercel AI SDK unified interface |
| Regulatory (GDPR, 152-ФЗ) | Всегда | Data residency architecture уже готова |
| Конкуренты копируют | Всегда | Speed + vertical depth + data network effects |

---

## 12. Моат (Competitive Moat)

**Что сложно скопировать конкурентам:**

1. **Data network effects**: Чем больше компаний обогащено — тем лучше ICP scoring. База из 1M обогащённых РФ-компаний — это актив.

2. **Vertical depth**: Глубокое знание конкретных вертикалей (какие вакансии = какие боли, какие триггерные события = когда покупают) накапливается со временем.

3. **Prompt engineering at scale**: Тысячи итераций промптов на реальных данных = лучший writer agent. Конкурент с нуля потратит месяцы.

4. **Russian market specificity**: 2ГИС + ЕГРЮЛ + HH.ru + Dadata интеграции + русскоязычные промпты — барьер для западных конкурентов.

5. **Plugin ecosystem**: При наличии Marketplace — switching cost растёт с каждым установленным плагином.
