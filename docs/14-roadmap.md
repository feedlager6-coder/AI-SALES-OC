# Roadmap — AI Sales OS

## Принципы приоритизации

1. **Ценность для пользователя > техническая красота**
2. **Revenue-generating features** идут раньше infrastructure improvements
3. **Вертикальный срез**: лучше иметь один полный рабочий флоу, чем 10 наполовину готовых
4. **Учиться у реальных клиентов**: Ship → Measure → Learn → Iterate

---

## Фаза 0: Исследование и проектирование (Текущая)
**Длительность**: 2–3 недели  
**Статус**: ✅ В процессе

- [x] Vision документ
- [x] Market Research
- [x] System Architecture
- [x] Database Design
- [x] API Integrations
- [x] AI Layer Design
- [x] Security
- [x] Deployment Plan
- [ ] Валидация ICP с 10 потенциальными клиентами (custdev)
- [ ] Финальное подтверждение стека

---

## Фаза 1: MVP Foundation (Месяц 1–2)
**Цель**: Работающая система, которая может найти лидов и отправить им персонализированное письмо.

### Sprint 1.1 (недели 1–2): Core Infrastructure
```
□ Monorepo setup (pnpm workspaces)
□ PostgreSQL + Drizzle ORM + migrations
□ Redis + BullMQ
□ Fastify API boilerplate
□ Next.js frontend boilerplate
□ Authentication (JWT + refresh tokens)
□ Workspace model (multi-tenancy)
□ Docker Compose development setup
□ CI/CD pipeline (GitHub Actions)
□ Basic monitoring (Prometheus + Grafana)
```

### Sprint 1.2 (недели 3–4): CRM Core
```
□ Company CRUD (create, read, update, delete)
□ Contact CRUD
□ Deal CRUD
□ Activity timeline
□ Full-text search (PostgreSQL)
□ CSV import с маппингом полей
□ Базовый UI: список компаний, карточка, форма
□ ICP Scoring (rule-based, без AI)
```

### Sprint 1.3 (недели 5–6): Lead Generation
```
□ 2ГИС API интеграция (поиск по категории + городу)
□ HH.ru API интеграция (работодатели + вакансии)
□ ЕГРЮЛ через Dadata.ru
□ Enrichment queue (BullMQ)
□ Email discovery (Hunter.io waterfall)
□ Email verification
□ UI: настройка ICP фильтра, запуск поиска
```

### Sprint 1.4 (недели 7–8): Email Outreach
```
□ Email accounts управление
□ Sequence builder (многошаговые последовательности)
□ Email sending (Mailgun)
□ Webhook tracking (open, click, bounce, reply)
□ Campaign management (create, start, pause, stop)
□ Unsubscribe handling
□ Basic A/B тест (subject line)
```

**MVP Milestone**: Система находит логистические компании в 2ГИС → обогащает → генерирует письмо → отправляет → трекает ответ.

---

## Фаза 2: AI Integration (Месяц 2–3)
**Цель**: AI-персонализация писем, классификация ответов, умный скоринг.

### Sprint 2.1: AI Writer
```
□ Vercel AI SDK integration (OpenAI + Anthropic)
□ Writer Agent: генерация писем с контекстом компании
□ Quality Check Agent: автоматическая проверка перед отправкой
□ 3 варианта письма на выбор SDR
□ Streaming в UI (как ChatGPT)
□ Prompt management (YAML-конфиги)
□ AI cost tracking per workspace
```

### Sprint 2.2: AI Classifier + Extractor
```
□ Reply Classifier Agent
□ Auto-actions по классификации (pause, task create, notify)
□ Website Analyzer Agent (Playwright + GPT)
□ Vacancy Analyzer Agent (HH.ru сигналы)
□ AI ICP Scoring (гибридный: rules + LLM для edge cases)
□ AI observability dashboard
```

### Sprint 2.3: Telegram Integration
```
□ Telegram Bot (уведомления SDR)
□ Inline-кнопки в уведомлениях
□ Команды: /stats, /pause, /reply
□ Алерты мониторинга через Telegram
```

---

## Фаза 3: Product Polish & First Customers (Месяц 3–4)
**Цель**: Привести первых 3–5 платящих клиентов.

### Sprint 3.1: Email Deliverability
```
□ Inbox warming module
□ SPF/DKIM/DMARC validation UI
□ Domain health monitoring
□ Sending schedule optimization (best time by industry)
□ Spam score check перед отправкой
```

### Sprint 3.2: Analytics Dashboard
```
□ Воронка продаж (конверсия по этапам)
□ Email performance (open/reply/meeting rate)
□ AI cost report
□ Source attribution (откуда лид → откуда деньги)
□ Export в CSV/XLSX
```

### Sprint 3.3: Onboarding & UX
```
□ Onboarding wizard (5 шагов до первого письма)
□ Empty states с action prompts
□ Keyboard shortcuts (⌘K глобальный поиск)
□ Mobile responsive (basic)
□ Help documentation (Notion-based или в-app)
```

### Sprint 3.4: Billing (Монетизация)
```
□ Stripe интеграция (или ЮКасса для РФ)
□ 3 тарифных плана (Starter, Pro, Enterprise)
□ Trial период (14 дней)
□ Usage-based ограничения (лиды, emails, seats)
□ Upgrade prompts в UI
```

---

## Фаза 4: Scale & Second Vertical (Месяц 4–8)
**Цель**: 10+ клиентов, стабильная система, первая дополнительная вертикаль.

### Q2 Priorities
```
□ Multi-channel outreach: LinkedIn (через Sales Navigator API)
□ Voice AI: интеграция Vapi.ai для холодных звонков
□ Vertical #2 config (строительство / девелопмент)
□ API для внешних интеграций (Webhook-out, REST API)
□ Роль Marketplace: готовые ICP-шаблоны по индустриям
□ Team collaboration: комментарии, @mentions, shared views
□ Audit log UI
□ SSO (Google Workspace)
```

---

## Фаза 5: Platform Vision (Месяц 9–18)
**Цель**: Платформа для любых B2B SaaS продаж.

```
□ Plugin system: новые источники данных через API
□ Custom AI agents: пользователь пишет свои промпты
□ Multi-language (English UI)
□ White-label mode для агентств
□ Self-hosted edition
□ Marketplace интеграций (Zapier, n8n, Make)
□ Advanced analytics: revenue forecasting, churn prediction
□ Mobile app (iOS/Android — React Native)
```

---

## Зависимости и риски

| Риск | Вероятность | Влияние | Митигация |
|------|------------|---------|----------|
| 2ГИС API изменит условия | Низкая | Высокое | Второй источник (HH.ru) покрывает задачу |
| OpenAI поднимет цены | Средняя | Среднее | Anthropic fallback; бюджетный лимит на workspace |
| Email deliverability ухудшится | Средняя | Высокое | Прогрев + мультидоменность + monitoring |
| Regulatory: ужесточение 152-ФЗ | Низкая | Высокое | Архитектура готова к локализации данных |
| Конкурент скопирует идею | Высокая | Среднее | Фокус на РФ-специфику и скорость |

---

## Метрики успеха по фазам

| Фаза | Ключевые метрики |
|------|----------------|
| MVP (Ф1) | Работающий E2E флоу; 100 лидов обработано |
| AI (Ф2) | Reply rate > 8%; email personalization score > 4/5 |
| Клиенты (Ф3) | 3 платящих клиента; MRR $3,000+ |
| Scale (Ф4) | 10 клиентов; MRR $15,000; churn < 5% |
| Платформа (Ф5) | MRR $50,000; 50 клиентов; 2+ вертикали |
