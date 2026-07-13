# Event Flow — AI Sales OS
> Полный lifecycle лида: от первого обнаружения до закрытой сделки.  
> Каждое событие, каждый воркер, каждая очередь.

---

## Обзор: полный поток

```
[SOURCE] → DISCOVERY → DEDUP → NEW → ENRICHING → ENRICHED
                                                      │
                              ┌───────────────────────┤
                              │                       │
                          QUALIFIED               LOW_QUALITY
                              │
                         SEQUENCE ENROLLMENT
                              │
                         AI GENERATION
                              │
                         EMAIL SENDING
                              │
                         TRACKING
                              │
                 ┌────────────┴────────────┐
                 │                         │
            REPLY RECEIVED            NO REPLY
                 │                         │
           AI CLASSIFICATION        NEXT STEP
                 │                  (delay/wait)
       ┌─────────┴─────────┐
       │                   │
  INTERESTED           NOT NOW / LOST
       │
  SDR NOTIFIED → MEETING → DEAL
```

---

## Фаза 1: Lead Discovery (Поиск лидов)

### Триггеры
- Ручной запуск пользователем из UI
- Cron-расписание (ежедневно в 07:00 по workspace timezone)
- Webhook от внешнего источника
- API вызов (для интеграций)

### События и очереди

```
EVENT: discovery.requested
PRODUCER: API Server (POST /api/v1/discovery/start)
CONSUMER: discovery-queue
PAYLOAD: {
  workspaceId, userId, verticalId,
  filters: { industry, city, employeesMin, employeesMax, keywords }
  sources: ['2gis', 'hhru']    // список плагинов для запуска
}
```

### Sequence диаграмма: Discovery

```
User/Scheduler → API Server
                    │
                    ├─ Validate ICP filters
                    ├─ Check workspace limits (leads quota)
                    ├─ INSERT discovery_job (status=pending)
                    │
                    └─ dispatch → discovery-queue
                                        │
                              Discovery Worker
                                        │
                    ┌───────────────────┤
                    │                   │
              2GIS Plugin          HH.ru Plugin
               (rubric search)    (employer search)
                    │                   │
                    └─────────┬─────────┘
                              │ results merged
                              ▼
                    Deduplication Engine
                      ├─ Check: INN match → skip
                      ├─ Check: domain match → skip
                      ├─ Check: name+city fuzzy → flag for review
                      └─ New → create Company(status=NEW)
                              │
                    ┌─────────▼──────────┐
                    │  Rule-based ICP    │
                    │  Score (instant)   │
                    └─────────┬──────────┘
                    score<30  │  score≥30
                    │         │
              ARCHIVED   dispatch → enrich-queue
```

### Events emitted
| Event | When | Payload |
|-------|------|---------|
| `company.created` | Company создана | `{companyId, source, score}` |
| `company.deduplicated` | Найден дубль | `{existingId, newData}` |
| `discovery.completed` | Поиск завершён | `{discoveryJobId, found, created, skipped}` |

---

## Фаза 2: Enrichment (Обогащение)

### Очередь: `enrichment-queue`
- Concurrency: 10 параллельных jobs
- Rate limiting: 2 req/sec к каждому внешнему API
- Retry: 3 попытки с backoff 1m → 5m → 15m

### Waterfall порядок

```
Company(status=NEW, score≥30)
        │
        ▼ Job: enrich_company
        │
┌───────▼───────┐
│  Step 1:      │ ЕГРЮЛ / Dadata
│  EGRUL lookup │ → inn, ogrn, legal_name, director, registration_date
│  by INN       │ → revenue_rub (if available)
└───────┬───────┘
        │
┌───────▼───────┐
│  Step 2:      │ HH.ru
│  Vacancies    │ → open_vacancies[], salary_range
│  lookup       │ → growth_signals, tech_stack, pain_points (AI)
└───────┬───────┘
        │
┌───────▼───────┐
│  Step 3:      │ Email Discovery Waterfall
│  Email finder │ 
│               │  Hunter.io
│               │    ↓ not found
│               │  Snov.io
│               │    ↓ not found
│               │  Apollo.io
│               │    ↓ not found
│               │  Pattern-based (firstname@domain)
│               │    → confidence: 0.4, flag: unverified
└───────┬───────┘
        │ email found OR not found
┌───────▼───────┐
│  Step 4:      │ Email Verification
│  MX + SMTP    │ → syntax check
│  verification │ → MX record lookup
│               │ → SMTP handshake (catch-all detection)
│               │ → email_status: valid/invalid/catch_all
└───────┬───────┘
        │
┌───────▼───────┐
│  Step 5:      │ AI Website Analysis (Playwright)
│  Website scan │ → company products/services
│               │ → target clients
│               │ → pain_points[]
│               │ → tech_stack[]
│               │ → isRelevantToICP: bool
│               │ → relevance_score: 0-100
└───────┬───────┘
        │
┌───────▼───────┐
│  Step 6:      │ ICP Score Recalculation
│  Score update │ → rules-based (fast)
│               │ → LLM scoring if 40-60 range (edge cases)
│               │ → final icp_score, reasoning
└───────┬───────┘
        │
        ├─ score≥50 AND email found → status=QUALIFIED
        ├─ score≥50 AND no email    → status=ENRICHED (no_email queue)
        └─ score<50                 → status=LOW_QUALITY
```

### Events emitted
| Event | When | Payload |
|-------|------|---------|
| `enrichment.started` | Job начат | `{companyId, jobId}` |
| `enrichment.step.completed` | Шаг завершён | `{companyId, step, fields_added}` |
| `enrichment.completed` | Всё готово | `{companyId, finalScore, emailFound}` |
| `enrichment.failed` | Ошибка | `{companyId, step, error, retryAt}` |
| `company.qualified` | Перешёл в QUALIFIED | `{companyId, score}` |
| `company.low_quality` | Низкий score | `{companyId, score, reason}` |

### WebSocket notification
```
enrichment.completed → Redis pub/sub channel: `ws:workspace:{workspaceId}`
API Server subscribes to channel → pushes to active WebSocket clients
Payload: { type: 'COMPANY_UPDATED', data: { id, status, icp_score } }
```

---

## Фаза 3: Campaign Enrollment (Зачисление в кампанию)

### Триггеры
- Автоматически: Company перешла в QUALIFIED → matcher проверяет активные Campaigns
- Вручную: SDR добавляет Company в Campaign из UI

### Matching logic
```
QUALIFIED Company
    │
    ▼
FOR EACH active Campaign in workspace:
    campaign.icp_filter matches company? → create SequenceEnrollment
    
icp_filter matching:
  - industry in campaign.icp_filter.industries? ✓
  - city in campaign.icp_filter.cities? ✓
  - icp_score >= campaign.icp_filter.min_score? ✓
  - NOT already enrolled in this campaign? ✓
  → ENROLL
```

### Очередь: `enrollment-queue`
```
Job: create_enrollment
Payload: { companyId, contactId, sequenceId, campaignId }

Worker:
1. Check: contact.email_status != 'invalid'
2. Check: contact.opted_out = false
3. Check: NOT already enrolled (UNIQUE constraint)
4. INSERT sequence_enrollments (status=active, current_step=0)
5. Schedule first email: dispatch → email-gen-queue (delay: step[0].delay_hours)
```

### Events emitted
| Event | When |
|-------|------|
| `enrollment.created` | Company зачислена |
| `enrollment.skipped` | Уже в последовательности / opted_out |

---

## Фаза 4: AI Email Generation (Генерация письма)

### Очередь: `ai-queue` (sub-queue: generate_email)
- Concurrency: 5 параллельных jobs (rate limit OpenAI)
- Timeout: 30 секунд
- Retry: 2 попытки (разные модели при retry)

### Sequence диаграмма: AI Generation

```
Scheduler / Email Scheduler
    │
    ├─ Check: enrollment.status == active?
    ├─ Check: current_step.scheduled_at <= now?
    ├─ Check: campaign.sending_settings (working hours)?
    └─ dispatch → ai-queue

AI Worker receives job
    │
    ├─ Load company data (pain_points, vacancies, news, website_data)
    ├─ Load prompt template (vertical + step_number from verticals/*.yaml)
    ├─ Build context: pick top 2-3 "hooks" (most relevant signals)
    │
    ├─ Call LLM: OpenAI GPT-4o
    │   ├─ stream: true
    │   ├─ response_format: json_object
    │   └─ output: { subject, body, hook_used }
    │
    ├─ Quality Check (GPT-4o-mini, cheap):
    │   ├─ personalization: 1-5
    │   ├─ clarity: 1-5
    │   ├─ call_to_action: 1-5
    │   └─ spam_risk: 1-5
    │
    ├─ IF spam_risk>3 OR personalization<3 → REGENERATE (max 2 attempts)
    │
    ├─ Save draft email to email_sends (status=queued)
    ├─ Log to ai_logs (tokens, cost, latency)
    └─ dispatch → email-send-queue (scheduled_at = now + respect_working_hours)
```

### Fallback strategy
```
OpenAI error/timeout (>30s)
    → retry with Anthropic Claude 3.5 Sonnet
    → if Anthropic also fails: use template (subject_template + body_template)
    → flag email_sends.generated_by = 'template' + alert operator
```

### Events emitted
| Event | When |
|-------|------|
| `email.generated` | Письмо готово | 
| `email.generation.failed` | Оба AI провайдера недоступны |
| `email.generation.template_fallback` | Использован шаблон |

---

## Фаза 5: Email Sending (Отправка)

### Очередь: `email-send-queue`
- Concurrency: 3 (rate limit Mailgun)
- Scheduled jobs (BullMQ delayed)
- Respect: working hours + daily_limit per email_account

### Pre-send checks
```
Job received
    │
    ├─ Check: enrollment.status == active? (не остановили?)
    ├─ Check: contact.opted_out == false?
    ├─ Check: email_account.sent_today < email_account.daily_limit?
    │         (атомарный Redis INCR, не SQL counter)
    ├─ Check: current time in campaign.sending_settings.time_from..time_to?
    └─ IF any check fails → reschedule for next valid time
```

### Sending sequence
```
Email Worker
    │
    ├─ Render final email (replace variables in template)
    ├─ Add tracking pixel (1x1 PNG via /track/open/{email_send_id})
    ├─ Add redirect for links (/track/click/{email_send_id}/{url_hash})
    ├─ Add unsubscribe link
    │
    ├─ Call Mailgun API (или активный провайдер)
    │
    ├─ UPDATE email_sends SET status=sent, sent_at=now, provider_id=msg_id
    ├─ INCR Redis key: email_account:{id}:sent_today (expire at midnight)
    ├─ INSERT activity (type=email_sent)
    └─ UPDATE campaigns.stats (atomic JSONB update)
```

### Events emitted
| Event | When |
|-------|------|
| `email.sent` | Письмо отправлено |
| `email.deferred` | Перенесено (working hours / limit) |
| `email.send.failed` | Ошибка отправки |

---

## Фаза 6: Email Tracking (Трекинг)

### Webhook endpoint: POST /webhooks/email/{provider}

```
Mailgun Webhook → /webhooks/email/mailgun
    │
    ├─ Verify signature (HMAC)
    ├─ Find email_send by provider_id
    │
    ├─ event = 'delivered'
    │   → UPDATE email_sends SET status=delivered
    │
    ├─ event = 'opened'
    │   → UPDATE email_sends SET opened_at = first_occurrence
    │   → INSERT activity (type=email_opened)
    │   → UPDATE campaigns.stats.opened++
    │
    ├─ event = 'clicked'
    │   → UPDATE email_sends SET clicked_at = first_occurrence
    │   → INSERT activity (type=email_clicked)
    │
    ├─ event = 'complained' (spam report)
    │   → UPDATE email_sends SET status=complained
    │   → UPDATE email_account.reputation_score -= 5
    │   → dispatch → enrollment-action-queue (action=STOP)
    │
    ├─ event = 'permanent_fail' (hard bounce)
    │   → UPDATE email_sends SET status=bounced, bounce_type=hard
    │   → UPDATE contacts SET email_status=invalid
    │   → dispatch → enrollment-action-queue (action=STOP_ENROLLMENT)
    │   → INSERT activity (type=email_bounced)
    │
    └─ event = 'temporary_fail' (soft bounce)
        → UPDATE email_sends SET status=bounced, bounce_type=soft
        → If soft_bounce_count > 2 → treat as hard
```

### Tracking pixel handler: GET /track/open/{emailSendId}
```
→ UPDATE email_sends SET opened_at = NOW() WHERE opened_at IS NULL
→ Redirect / return 1x1 transparent GIF
→ dispatch → workflow-event: email.opened (async)
```

---

## Фаза 7: Reply Processing (Обработка ответов)

### Reply ingestion
```
Method 1: Email webhook (Mailgun inbound routing)
    POST /webhooks/email/mailgun/inbound
    → Extract: From, Subject, Body
    → Match to email_send by References/In-Reply-To header
    
Method 2: IMAP polling (fallback)
    Scheduler: каждые 5 минут
    → IMAP connect → fetch unseen messages → process
```

### AI Classification flow
```
Reply received
    │
    ├─ Extract text (strip quoted text)
    ├─ dispatch → ai-queue (job: classify_reply)
    │
AI Worker: classify_reply
    │
    ├─ Load: original email context, company data
    ├─ Call GPT-4o-mini (cheap, fast):
    │   Input: { original_email, reply_text }
    │   Output: {
    │     intent: ReplyIntent,
    │     confidence: 0-1,
    │     extracted_info: { preferred_time, objection, question },
    │     suggested_action: string,
    │     pause_days?: number
    │   }
    │
    ├─ UPDATE sequence_enrollments SET
    │   reply_at=now, reply_classification=intent
    │
    ├─ INSERT activity (type=email_replied, metadata={intent, confidence})
    │
    └─ dispatch → enrollment-action-queue (action based on intent)
```

### Intent → Action mapping
```
intent = 'interested'
    → PAUSE enrollment
    → CREATE task (type=PREPARE_PROPOSAL, priority=high, due_at=tomorrow)
    → NOTIFY SDR via Telegram (with quick-reply buttons)
    → UPDATE company.status = REPLIED

intent = 'request_call'  
    → PAUSE enrollment
    → CREATE task (type=SCHEDULE_CALL, priority=urgent)
    → NOTIFY SDR via Telegram (with calendar booking link)

intent = 'not_now'
    → PAUSE enrollment until now + pause_days
    → Schedule auto-resume job
    → NO notification (unless configured)

intent = 'not_interested'
    → STOP enrollment (status=stopped)
    → UPDATE company.status = CLOSED_LOST
    → NO notification

intent = 'wrong_person'
    → PAUSE enrollment
    → CREATE task (type=FIND_RIGHT_CONTACT)
    → NOTIFY SDR

intent = 'out_of_office'
    → PAUSE enrollment until detected_return_date
    → Parse return date from auto-reply text

intent = 'unsubscribe'
    → STOP enrollment (status=unsubscribed)
    → UPDATE contact.opted_out = true
    → INSERT opt_out_log
    → Never contact again from any campaign

intent = 'question' | 'price_request' | 'technical_question'
    → PAUSE enrollment
    → CREATE task (priority=high, type based on intent)
    → NOTIFY SDR
```

---

## Фаза 8: Follow-up Steps (Продолжение последовательности)

### Scheduler Logic (runs every minute)
```
Scheduler Worker
    │
    └─ Query: SELECT * FROM sequence_enrollments
       WHERE status = 'active'
       AND scheduled_next_at <= NOW()
       LIMIT 100
    
    FOR EACH enrollment:
        │
        ├─ Load sequence.steps[current_step]
        ├─ Check: working hours? (campaign.sending_settings)
        │
        ├─ step.type = 'email'
        │   → dispatch → ai-queue (generate_email)
        │   → UPDATE enrollment.current_step++
        │
        ├─ step.type = 'task'
        │   → CREATE task for SDR
        │   → UPDATE enrollment.current_step++
        │
        ├─ step.type = 'wait'
        │   → UPDATE enrollment.scheduled_next_at += step.delay_days
        │
        └─ IF current_step >= total_steps
            → UPDATE enrollment.status = 'completed'
            → INSERT activity (type=sequence_completed)
```

---

## Фаза 9: Meeting & Deal Flow

### SDR action: "Запланировать встречу"
```
SDR receives Telegram notification
    │
    ├─ Clicks "Позвонить" → opens task in browser
    ├─ Calls company → meeting scheduled
    │
SDR creates meeting activity in UI:
    INSERT activities (type=meeting, occurred_at=scheduled_time)
    UPDATE company.status = MEETING
    CREATE deal (if doesn't exist)
    CREATE task (type=PREPARE_PROPOSAL, due: before meeting)
```

### Deal progression
```
MEETING → SDR sends proposal
    → UPDATE deal.stage = 'proposal'
    → INSERT activity (type=proposal_sent)
    
Negotiation:
    → UPDATE deal.stage = 'negotiation'
    → UPDATE deal.probability
    → Track activities manually

Close:
    WON:  UPDATE deal.won_at = now()
          UPDATE company.status = WON
          INSERT activity (type=deal_won)
          
    LOST: UPDATE deal.lost_at = now(), lost_reason = ?
          UPDATE company.status = CLOSED_LOST
          INSERT activity (type=deal_lost)
```

---

## Фаза 10: Analytics (Аналитика)

### Materialized Views (обновляются каждые 15 минут)
```sql
-- Воронка конверсии по workspace
CREATE MATERIALIZED VIEW mv_funnel_stats AS
SELECT 
  workspace_id,
  COUNT(*) FILTER (WHERE status = 'NEW') as new_count,
  COUNT(*) FILTER (WHERE status = 'QUALIFIED') as qualified_count,
  COUNT(*) FILTER (WHERE status = 'CONTACTED') as contacted_count,
  COUNT(*) FILTER (WHERE status = 'REPLIED') as replied_count,
  COUNT(*) FILTER (WHERE status IN ('MEETING', 'PROPOSAL')) as meeting_count,
  COUNT(*) FILTER (WHERE status = 'WON') as won_count
FROM companies
WHERE deleted_at IS NULL
GROUP BY workspace_id;

-- Email performance по кампании
CREATE MATERIALIZED VIEW mv_campaign_performance AS
SELECT 
  campaign_id,
  COUNT(es.id) as sent,
  COUNT(es.opened_at) as opened,
  COUNT(es.clicked_at) as clicked,
  COUNT(es.replied_at) as replied,
  AVG(EXTRACT(EPOCH FROM (es.replied_at - es.sent_at))/3600) as avg_reply_hours
FROM email_sends es
JOIN sequence_enrollments se ON es.enrollment_id = se.id
GROUP BY campaign_id;
```

---

## Очереди (полная карта)

| Queue | Consumer | Concurrency | Priority | Retry |
|-------|----------|-------------|----------|-------|
| `discovery-queue` | Discovery Worker | 3 | normal | 2x |
| `enrichment-queue` | Enrichment Worker | 10 | normal | 3x backoff |
| `email-gen-queue` | AI Worker | 5 | high | 2x |
| `email-send-queue` | Email Worker | 3 | high | 3x |
| `ai-classify-queue` | AI Worker | 10 | urgent | 2x |
| `enrollment-action-queue` | Enrollment Worker | 20 | urgent | 3x |
| `notification-queue` | Notification Worker | 10 | high | 3x |
| `scraping-queue` | Scraping Worker | 1 | low | 2x |

### Dead Letter Queue (DLQ)
Все jobs после исчерпания retry → `dlq:{original-queue}`. Оператор получает алерт. Возможен ручной retry из Bull Board UI.

---

## Полная карта событий системы

### Company Events
| Event | Producer | Consumer |
|-------|----------|---------|
| `company.created` | Discovery Worker | Analytics, Audit Log |
| `company.enrichment.started` | Enrichment Worker | WebSocket notifier |
| `company.enrichment.completed` | Enrichment Worker | Campaign Matcher, WebSocket |
| `company.status.changed` | Various | Audit Log, Analytics, WebSocket |
| `company.qualified` | Enrichment Worker | Campaign Matcher |
| `company.opted_out` | Email Worker | Global opt-out list |

### Email Events
| Event | Producer | Consumer |
|-------|----------|---------|
| `email.generated` | AI Worker | Email Send Queue |
| `email.sent` | Email Worker | Activity Log, Campaign Stats |
| `email.opened` | Webhook Handler | Activity Log, Campaign Stats |
| `email.clicked` | Webhook Handler | Activity Log |
| `email.replied` | Webhook/IMAP | AI Classifier |
| `email.bounced.hard` | Webhook Handler | Contact update, Enrollment stop |
| `email.complained` | Webhook Handler | Account reputation, Enrollment stop |

### AI Events
| Event | Producer | Consumer |
|-------|----------|---------|
| `ai.email.generated` | AI Worker | Email Queue |
| `ai.reply.classified` | AI Worker | Enrollment Actions |
| `ai.website.analyzed` | AI Worker | Company update |
| `ai.icp.scored` | AI Worker | Company status update |

### User/SDR Events
| Event | Producer | Consumer |
|-------|----------|---------|
| `task.created` | Various Workers | Notification Worker, UI |
| `notification.sent` | Notification Worker | Audit Log |
| `user.login` | API Server | Audit Log |
| `campaign.started` | API Server | Enrollment Worker |
| `campaign.paused` | API Server | Enrollment Worker |
