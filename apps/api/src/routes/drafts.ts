/**
 * Drafts routes — AI message generation + draft persistence for the Discover flow.
 *
 * POST /api/v1/drafts/generate  — generate an AI-personalised outreach message
 *                                  from raw company data (no DB company required)
 * POST /api/v1/drafts           — persist a draft to the activities table
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import OpenAI from 'openai'
import { getDb, activities } from '@ai-sales-os/db'
import { workspaceContextPlugin } from '../plugins/workspace-context.js'
import { getEnv } from '@ai-sales-os/config'
import { createLogger } from '@ai-sales-os/logger'

const logger = createLogger({ name: 'api:drafts' })

// ─── OpenAI singleton (lazy) ─────────────────────────────────────────────────

let _openai: OpenAI | null = null

function getOpenAIClient(): OpenAI | null {
  if (_openai) return _openai
  const { OPENAI_API_KEY } = getEnv()
  if (!OPENAI_API_KEY) return null
  _openai = new OpenAI({ apiKey: OPENAI_API_KEY })
  return _openai
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const SignalSchema = z.object({
  type: z.enum(['hiring', 'growing', 'expanding', 'contract']),
  label: z.string(),
})

const ContactSchema = z.object({
  name: z.string().default(''),
  role: z.string().default(''),
  email: z.string().default(''),
  phone: z.string().default(''),
})

const GenerateDraftBodySchema = z.object({
  company: z.object({
    name: z.string().min(1),
    industry: z.string().default(''),
    region: z.string().default(''),
    size: z.string().default(''),
    inn: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    signals: z.array(SignalSchema).default([]),
    contact: ContactSchema.optional(),
  }),
})

const SaveDraftBodySchema = z.object({
  subject: z.string().max(500),
  body: z.string(),
  companyInfo: z
    .object({
      name: z.string(),
      industry: z.string().nullable().optional(),
      region: z.string().nullable().optional(),
      inn: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
})

// ─── Template fallback ────────────────────────────────────────────────────────

type GenerateCompanyInput = z.infer<typeof GenerateDraftBodySchema>['company']

function buildTemplateDraft(company: GenerateCompanyInput): { subject: string; bodyText: string } {
  const contactName = company.contact?.name?.split(' ')[0] ?? 'коллега'
  return {
    subject: `Сотрудничество с ${company.name}`,
    bodyText: `Здравствуйте, ${contactName}!

${company.name} привлекла моё внимание как интересный игрок в ${company.industry}${company.region ? ` в ${company.region}` : ''}.

Мы помогаем компаниям в вашей сфере автоматизировать поиск клиентов и первый контакт с ними — без увеличения штата.

Когда удобно поговорить на 15 минут?`,
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const draftsRoutes: FastifyPluginAsync = async (app) => {
  await app.register(workspaceContextPlugin)

  /**
   * POST /api/v1/drafts/generate
   *
   * Generates an AI-personalised outreach message for a company from the
   * Discover flow. Accepts raw company data — no DB company ID required.
   *
   * Falls back to a template when OPENAI_API_KEY is absent or the API call fails.
   */
  app.post('/generate', async (request, reply) => {
    const { company } = GenerateDraftBodySchema.parse(request.body)
    const now = new Date()
    const openai = getOpenAIClient()

    if (!openai) {
      const fallback = buildTemplateDraft(company)
      return reply.send({
        data: { ...fallback, generatedAt: now.toISOString(), usedAI: false },
      })
    }

    try {
      const signalsText =
        company.signals.length > 0
          ? company.signals.map((s) => `- ${s.label}`).join('\n')
          : 'Сигналы роста не обнаружены'

      const contactName = company.contact?.name ?? ''
      const contactRole = company.contact?.role ?? ''

      const systemPrompt = `Ты эксперт по B2B-продажам на российском рынке.
Напиши персонализированное cold outreach письмо на русском языке.
Требования:
- Тон: профессиональный, конкретный, без клише
- Первое предложение — конкретно об этой компании или её сигналах роста
- Тело письма: не более 150 слов
- Заканчивай конкретным предложением о встрече на 15 минут
Верни JSON: { "subject": "...", "bodyText": "..." }`

      const userPrompt = `Данные компании-получателя:
- Название: ${company.name}
- Отрасль: ${company.industry || 'не указана'}
- Регион: ${company.region || 'не указан'}
- Размер: ${company.size || 'неизвестно'}
- Контакт: ${contactName}${contactRole ? ` (${contactRole})` : ''}
- Сайт: ${company.website || 'не указан'}

Сигналы роста:
${signalsText}

Напиши персонализированное письмо. Верни только JSON.`

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.75,
        max_tokens: 600,
      })

      const raw = response.choices[0]?.message?.content ?? '{}'
      const parsed = JSON.parse(raw) as { subject?: string; bodyText?: string }

      const subject = parsed.subject ?? `Сотрудничество с ${company.name}`
      const bodyText = parsed.bodyText ?? buildTemplateDraft(company).bodyText

      logger.info({
        event: 'drafts.generate.success',
        companyName: company.name,
        workspaceId: request.workspaceId,
      })

      return reply.send({
        data: { subject, bodyText, generatedAt: now.toISOString(), usedAI: true },
      })
    } catch (err) {
      logger.warn({
        event: 'drafts.generate.error',
        error: err instanceof Error ? err.message : String(err),
        companyName: company.name,
      })
      const fallback = buildTemplateDraft(company)
      return reply.send({
        data: { ...fallback, generatedAt: now.toISOString(), usedAI: false },
      })
    }
  })

  /**
   * POST /api/v1/drafts
   *
   * Persists a generated draft to the activities table so it can be retrieved
   * later (e.g. from a "Saved Drafts" view or campaign enrollment).
   *
   * Company context is embedded in `metadata` because the company from the
   * Discover flow is not necessarily saved to the companies table yet.
   */
  app.post('/', async (request, reply) => {
    const { subject, body, companyInfo } = SaveDraftBodySchema.parse(request.body)
    const db = getDb()

    const [activity] = await db
      .insert(activities)
      .values({
        workspaceId: request.workspaceId,
        performedBy: request.userId,
        type: 'email_sent',
        direction: 'outbound',
        subject,
        body,
        automated: false,
        metadata: {
          source: 'discover_draft',
          ...(companyInfo
            ? {
                companyName: companyInfo.name,
                companyIndustry: companyInfo.industry ?? null,
                companyRegion: companyInfo.region ?? null,
                inn: companyInfo.inn ?? null,
              }
            : {}),
        },
      })
      .returning()

    logger.info({
      event: 'drafts.saved',
      activityId: activity.id,
      workspaceId: request.workspaceId,
    })

    return reply.status(201).send({
      data: { id: activity.id, savedAt: activity.occurredAt },
    })
  })
}
