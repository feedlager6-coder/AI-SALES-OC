import { Worker, type ConnectionOptions } from 'bullmq'
import OpenAI from 'openai'
import { eq, and } from 'drizzle-orm'
import { getDb, companies, sequenceEnrollments, aiLogs } from '@ai-sales-os/db'
import { createLogger } from '@ai-sales-os/logger'
import { getEnv } from '@ai-sales-os/config'
import { getRedisConnection, QUEUES, JOBS } from '@ai-sales-os/queue'
import type { GenerateEmailPayload, ClassifyReplyPayload } from '@ai-sales-os/queue'

const logger = createLogger({ name: 'workers:ai' })

// ─── OpenAI client (lazy — only initialised when key is present) ──────────────

let _openai: OpenAI | null = null

function getOpenAI(): OpenAI | null {
  if (_openai) return _openai
  const { OPENAI_API_KEY } = getEnv()
  if (!OPENAI_API_KEY) return null
  _openai = new OpenAI({ apiKey: OPENAI_API_KEY })
  return _openai
}

// ─── Email generation ──────────────────────────────────────────────────────────

/**
 * Simple template substitution fallback when no OpenAI key is configured.
 * Replaces {{name}}, {{city}}, {{industry}} placeholders.
 */
function applyTemplateFallback(
  template: string,
  vars: Record<string, string | null | undefined>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

async function generateEmail(payload: GenerateEmailPayload): Promise<{
  subject: string
  bodyText: string
  bodyHtml: string
}> {
  const db = getDb()

  // Fetch company for personalisation context
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, payload.companyId),
    columns: {
      name: true, city: true, industry: true, inn: true,
      domain: true, website: true, employeesCount: true,
    },
  })

  const ctx = {
    name: company?.name ?? '',
    city: company?.city ?? '',
    industry: company?.industry ?? '',
    inn: company?.inn ?? '',
    website: company?.website ?? company?.domain ?? '',
    employees: company?.employeesCount ?? '',
  }

  const openai = getOpenAI()

  if (!openai) {
    // No API key — apply template substitution only
    logger.debug({ event: 'ai.generate_fallback', enrollmentId: payload.enrollmentId })
    const subject = applyTemplateFallback(payload.templateSubject, ctx)
    const bodyText = applyTemplateFallback(payload.templateBody, ctx)
    return {
      subject,
      bodyText,
      bodyHtml: `<p>${bodyText.replace(/\n/g, '</p><p>')}</p>`,
    }
  }

  const systemPrompt = `Ты эксперт по B2B-продажам на российском рынке. 
Напиши персонализированное outreach-письмо на русском языке.
Тон: профессиональный, но дружелюбный. Не более 200 слов в теле письма.
Верни JSON: { "subject": "...", "bodyText": "...", "bodyHtml": "..." }`

  const userPrompt = `Данные о компании:
- Название: ${ctx.name}
- Город: ${ctx.city || 'неизвестно'}
- Отрасль: ${ctx.industry || 'неизвестно'}
- ИНН: ${ctx.inn || 'неизвестно'}
- Сайт: ${ctx.website || 'неизвестно'}
- Размер: ${ctx.employees || 'неизвестно'} сотрудников

Шаблон письма:
Тема: ${payload.templateSubject}
Тело: ${payload.templateBody}

Персонализируй письмо, сохрани структуру шаблона. Верни только JSON.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 800,
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(raw) as {
    subject?: string
    bodyText?: string
    bodyHtml?: string
  }

  return {
    subject: parsed.subject ?? payload.templateSubject,
    bodyText: parsed.bodyText ?? payload.templateBody,
    bodyHtml: parsed.bodyHtml ?? `<p>${(parsed.bodyText ?? payload.templateBody).replace(/\n/g, '</p><p>')}</p>`,
  }
}

// ─── Reply classification ──────────────────────────────────────────────────────

type ReplyClass = 'interested' | 'not_now' | 'not_interested' | 'out_of_office' | 'question' | 'other'

const KEYWORD_RULES: Array<{ class: ReplyClass; patterns: RegExp[] }> = [
  {
    class: 'out_of_office',
    patterns: [/в отпуске/i, /автоответ/i, /out of office/i, /on vacation/i, /буду недоступен/i],
  },
  {
    class: 'not_interested',
    patterns: [/не интересно/i, /не нужно/i, /отпишите/i, /unsubscribe/i, /не беспокойте/i, /спам/i],
  },
  {
    class: 'not_now',
    patterns: [/позже/i, /не сейчас/i, /сейчас не время/i, /вернитесь/i, /через/i],
  },
  {
    class: 'interested',
    patterns: [/интересно/i, /расскажите/i, /давайте/i, /согласен/i, /готов/i, /хочу узнать/i, /пришлите/i],
  },
  {
    class: 'question',
    patterns: [/\?/, /как /i, /что /i, /где /i, /когда /i, /сколько /i],
  },
]

function classifyByKeywords(text: string): ReplyClass {
  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.class
  }
  return 'other'
}

async function classifyReply(payload: ClassifyReplyPayload): Promise<ReplyClass> {
  const openai = getOpenAI()

  if (!openai) {
    return classifyByKeywords(payload.replyText)
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Классифицируй ответ на cold email как одно из:
- interested: хочет продолжить разговор
- not_now: интерес есть, но не сейчас  
- not_interested: не заинтересован
- out_of_office: автоответ/отпуск
- question: задал вопрос
- other: другое

Верни JSON: { "classification": "..." }`,
      },
      {
        role: 'user',
        content: `От: ${payload.replyFrom}\nТекст ответа:\n${payload.replyText}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 50,
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(raw) as { classification?: string }
  const cls = parsed.classification

  const valid: ReplyClass[] = ['interested', 'not_now', 'not_interested', 'out_of_office', 'question', 'other']
  return valid.includes(cls as ReplyClass) ? (cls as ReplyClass) : 'other'
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export function startAiWorker() {
  const connection = getRedisConnection() as unknown as ConnectionOptions

  const worker = new Worker<GenerateEmailPayload | ClassifyReplyPayload>(
    QUEUES.AI,
    async (job) => {
      // ── Generate Email ──────────────────────────────────────────────────────
      if (job.name === JOBS.GENERATE_EMAIL) {
        const payload = job.data as GenerateEmailPayload
        logger.info({ event: 'ai.generate_start', enrollmentId: payload.enrollmentId })

        const generated = await generateEmail(payload)

        const db = getDb()

        // Log to audit trail
        const model = getOpenAI() ? 'gpt-4o-mini' : 'template-fallback'
        await db.insert(aiLogs).values({
          workspaceId: payload.workspaceId,
          agent: 'writer',
          model,
          provider: getOpenAI() ? 'openai' : 'none',
          entityType: 'enrollment',
          entityId: payload.enrollmentId,
          outputPreview: generated.subject.slice(0, 300),
        })

        logger.info({
          event: 'ai.generate_done',
          enrollmentId: payload.enrollmentId,
          subject: generated.subject,
          model: getOpenAI() ? 'gpt-4o-mini' : 'fallback',
        })

        return generated
      }

      // ── Classify Reply ──────────────────────────────────────────────────────
      if (job.name === JOBS.CLASSIFY_REPLY) {
        const payload = job.data as ClassifyReplyPayload
        logger.info({ event: 'ai.classify_start', enrollmentId: payload.enrollmentId })

        const classification = await classifyReply(payload)

        const db = getDb()

        // Update enrollment with classification
        await db
          .update(sequenceEnrollments)
          .set({
            replyClassification: classification,
            replyAt: new Date(),
            // Stop sequence on definitive replies
            ...(classification === 'interested' || classification === 'not_interested'
              ? { status: 'replied' }
              : {}),
          })
          .where(
            and(
              eq(sequenceEnrollments.id, payload.enrollmentId),
              eq(sequenceEnrollments.workspaceId, payload.workspaceId),
            ),
          )

        // Log to audit trail
        await db.insert(aiLogs).values({
          workspaceId: payload.workspaceId,
          agent: 'classifier',
          model: getOpenAI() ? 'gpt-4o-mini' : 'keyword-fallback',
          provider: getOpenAI() ? 'openai' : 'none',
          entityType: 'enrollment',
          entityId: payload.enrollmentId,
          outputPreview: classification,
        })

        logger.info({
          event: 'ai.classify_done',
          enrollmentId: payload.enrollmentId,
          classification,
          model: getOpenAI() ? 'gpt-4o-mini' : 'keyword-fallback',
        })

        return { classification }
      }

      // Unknown job type — log and skip
      logger.warn({ event: 'ai.unknown_job', jobName: job.name })
      return null
    },
    {
      connection,
      concurrency: 3,
    },
  )

  worker.on('failed', (job, err) => {
    logger.error({ event: 'ai.job_failed', jobId: job?.id, error: err.message })
  })

  return worker
}
