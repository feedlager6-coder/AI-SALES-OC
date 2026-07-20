/**
 * Shared AI utility functions used by both email.worker and ai.worker.
 * Provides OpenAI-powered email generation and reply classification
 * with keyword-based fallbacks when no API key is configured.
 */
import OpenAI from 'openai'
import { eq } from 'drizzle-orm'
import { getDb, companies } from '@ai-sales-os/db'
import { createLogger } from '@ai-sales-os/logger'
import { getEnv } from '@ai-sales-os/config'

const logger = createLogger({ name: 'workers:ai-helpers' })

// ─── OpenAI client (lazy singleton) ──────────────────────────────────────────

let _openai: OpenAI | null = null

export function getOpenAI(): OpenAI | null {
  if (_openai) return _openai
  const { OPENAI_API_KEY } = getEnv()
  if (!OPENAI_API_KEY) return null
  _openai = new OpenAI({ apiKey: OPENAI_API_KEY })
  return _openai
}

// ─── Template fallback ────────────────────────────────────────────────────────

/**
 * Simple {{variable}} substitution when OpenAI is unavailable.
 */
export function applyTemplateFallback(
  template: string,
  vars: Record<string, string | null | undefined>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

// ─── Company context loader ────────────────────────────────────────────────────

export interface CompanyContext {
  name: string
  city: string
  industry: string
  inn: string
  website: string
  employees: string
  [key: string]: string
}

export async function loadCompanyContext(companyId: string): Promise<CompanyContext> {
  const db = getDb()
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
    columns: {
      name: true,
      city: true,
      industry: true,
      inn: true,
      domain: true,
      website: true,
      employeesCount: true,
    },
  })

  return {
    name: company?.name ?? '',
    city: company?.city ?? '',
    industry: company?.industry ?? '',
    inn: company?.inn ?? '',
    website: company?.website ?? company?.domain ?? '',
    employees: company?.employeesCount ?? '',
  }
}

// ─── Email generation ─────────────────────────────────────────────────────────

export interface GeneratedEmail {
  subject: string
  bodyText: string
  bodyHtml: string
  usedAI: boolean
}

/**
 * Generate a personalised email for a given company using OpenAI.
 * Falls back to template variable substitution if no API key is available.
 *
 * @param companyId   - UUID of the target company
 * @param templateSubject - Raw subject template (may contain {{variables}})
 * @param templateBody    - Raw body template (may contain {{variables}})
 * @param enrollmentId    - For logging context only
 */
export async function generatePersonalisedEmail(
  companyId: string,
  templateSubject: string,
  templateBody: string,
  enrollmentId: string,
): Promise<GeneratedEmail> {
  const ctx = await loadCompanyContext(companyId)
  const openai = getOpenAI()

  if (!openai) {
    logger.debug({ event: 'ai.generate_fallback', enrollmentId })
    const subject = applyTemplateFallback(templateSubject, ctx)
    const bodyText = applyTemplateFallback(templateBody, ctx)
    return {
      subject,
      bodyText,
      bodyHtml: `<p>${bodyText.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`,
      usedAI: false,
    }
  }

  const systemPrompt = `Ты эксперт по B2B-продажам на российском рынке.
Напиши персонализированное outreach-письмо на русском языке.
Тон: профессиональный, конкретный, без клише вроде "мы рады предложить".
Первое предложение — о компании получателя, не о нас.
Заканчивай конкретным вопросом.
Не более 180 слов в теле письма.
Верни JSON: { "subject": "...", "bodyText": "...", "bodyHtml": "..." }`

  const userPrompt = `Данные о компании-получателе:
- Название: ${ctx.name}
- Город: ${ctx.city || 'не указан'}
- Отрасль: ${ctx.industry || 'не указана'}
- ИНН: ${ctx.inn || 'не указан'}
- Сайт: ${ctx.website || 'не указан'}
- Сотрудников: ${ctx.employees || 'неизвестно'}

Шаблон письма (персонализируй, сохраняя структуру):
Тема: ${templateSubject}
Тело: ${templateBody}

Верни только JSON, без пояснений.`

  try {
    const startMs = Date.now()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 900,
    })

    const latencyMs = Date.now() - startMs
    const raw = response.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw) as {
      subject?: string
      bodyText?: string
      bodyHtml?: string
    }

    logger.debug({
      event: 'ai.generate_ok',
      enrollmentId,
      latencyMs,
      tokens: response.usage?.total_tokens,
    })

    const bodyText = parsed.bodyText ?? applyTemplateFallback(templateBody, ctx)
    return {
      subject: parsed.subject ?? applyTemplateFallback(templateSubject, ctx),
      bodyText,
      bodyHtml: parsed.bodyHtml ?? `<p>${bodyText.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`,
      usedAI: true,
    }
  } catch (err) {
    // Degrade gracefully — use template fallback
    logger.warn({
      event: 'ai.generate_error',
      enrollmentId,
      error: err instanceof Error ? err.message : String(err),
    })
    const subject = applyTemplateFallback(templateSubject, ctx)
    const bodyText = applyTemplateFallback(templateBody, ctx)
    return {
      subject,
      bodyText,
      bodyHtml: `<p>${bodyText.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`,
      usedAI: false,
    }
  }
}

// ─── Reply classification ─────────────────────────────────────────────────────

export type ReplyClass =
  | 'interested'
  | 'not_now'
  | 'not_interested'
  | 'out_of_office'
  | 'question'
  | 'other'

const KEYWORD_RULES: Array<{ class: ReplyClass; patterns: RegExp[] }> = [
  {
    class: 'out_of_office',
    patterns: [/в отпуске/i, /автоответ/i, /out of office/i, /on vacation/i, /буду недоступен/i, /нахожусь в/i, /не в офисе/i],
  },
  {
    class: 'not_interested',
    patterns: [/не интересно/i, /не нужно/i, /отпишите/i, /unsubscribe/i, /не беспокойте/i, /спам/i, /не актуально/i, /нас не интересует/i],
  },
  {
    class: 'not_now',
    patterns: [/позже/i, /не сейчас/i, /сейчас не время/i, /вернитесь/i, /через \d/i, /в следующем/i, /в другой раз/i],
  },
  {
    class: 'interested',
    patterns: [/интересно/i, /расскажите/i, /давайте/i, /согласен/i, /готов/i, /хочу узнать/i, /пришлите/i, /созвонимся/i, /перезвоните/i],
  },
  {
    class: 'question',
    patterns: [/\?/, /как /i, /что /i, /где /i, /когда /i, /сколько /i, /почему /i],
  },
]

export function classifyByKeywords(text: string): ReplyClass {
  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.class
  }
  return 'other'
}

/**
 * Classify an inbound reply using OpenAI with keyword fallback.
 */
export async function classifyReplyText(
  replyText: string,
  replyFrom: string,
  enrollmentId: string,
): Promise<{ classification: ReplyClass; usedAI: boolean }> {
  const openai = getOpenAI()

  if (!openai) {
    return { classification: classifyByKeywords(replyText), usedAI: false }
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Классифицируй ответ на cold email. Верни только JSON.

Категории:
- interested: хочет продолжить, просит КП или звонок
- not_now: интерес есть, но не сейчас
- not_interested: не заинтересован, просит не писать
- out_of_office: автоответ об отсутствии
- question: задал уточняющий вопрос
- other: всё остальное

Верни: { "classification": "<категория>", "confidence": 0.0-1.0 }`,
        },
        {
          role: 'user',
          content: `От: ${replyFrom}\n\nТекст ответа:\n${replyText.slice(0, 2000)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 60,
    })

    const raw = response.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw) as { classification?: string; confidence?: number }
    const cls = parsed.classification

    const valid: ReplyClass[] = ['interested', 'not_now', 'not_interested', 'out_of_office', 'question', 'other']
    const classification = valid.includes(cls as ReplyClass) ? (cls as ReplyClass) : 'other'

    logger.debug({
      event: 'ai.classify_ok',
      enrollmentId,
      classification,
      confidence: parsed.confidence,
    })

    return { classification, usedAI: true }
  } catch (err) {
    logger.warn({
      event: 'ai.classify_error',
      enrollmentId,
      error: err instanceof Error ? err.message : String(err),
    })
    return { classification: classifyByKeywords(replyText), usedAI: false }
  }
}
