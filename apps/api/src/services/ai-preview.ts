/**
 * AI email preview service for Sprint 1.6.
 * Generates a personalised email preview synchronously in the API process
 * so the sequence builder UI can show the result immediately.
 *
 * Uses the same OpenAI model and prompt strategy as the AI worker.
 * Falls back to template variable substitution when no key is configured.
 *
 * Security: company lookup is always scoped to the caller's workspaceId
 * to prevent cross-tenant data leakage.
 */
import OpenAI from 'openai'
import { and, eq } from 'drizzle-orm'
import { getDb, companies } from '@ai-sales-os/db'
import { getEnv } from '@ai-sales-os/config'
import { createLogger } from '@ai-sales-os/logger'

const logger = createLogger({ name: 'api:ai-preview' })

let _openai: OpenAI | null = null

function getOpenAIClient(): OpenAI | null {
  if (_openai) return _openai
  const { OPENAI_API_KEY } = getEnv()
  if (!OPENAI_API_KEY) return null
  _openai = new OpenAI({ apiKey: OPENAI_API_KEY })
  return _openai
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

export interface PreviewResult {
  subject: string
  bodyText: string
  bodyHtml: string
  usedAI: boolean
  companyName: string
}

/**
 * @param workspaceId - Required for tenant-scoped company lookup.
 *   Prevents a caller from previewing another workspace's company data
 *   by supplying a known companyId that belongs to a different tenant.
 */
export async function generateEmailPreview(
  workspaceId: string,
  companyId: string,
  templateSubject: string,
  templateBody: string,
): Promise<PreviewResult> {
  const db = getDb()

  // Workspace-scoped lookup — prevents cross-tenant data leakage
  const company = await db.query.companies.findFirst({
    where: and(
      eq(companies.id, companyId),
      eq(companies.workspaceId, workspaceId),
    ),
    columns: {
      name: true, city: true, industry: true, inn: true,
      domain: true, website: true, employeesCount: true,
    },
  })

  const vars: Record<string, string> = {
    name: company?.name ?? '',
    city: company?.city ?? '',
    industry: company?.industry ?? '',
    inn: company?.inn ?? '',
    website: company?.website ?? company?.domain ?? '',
    employees: company?.employeesCount ?? '',
  }

  const companyName = company?.name ?? companyId.slice(0, 8)
  const openai = getOpenAIClient()

  if (!openai) {
    const subject = applyTemplate(templateSubject, vars)
    const bodyText = applyTemplate(templateBody, vars)
    return {
      subject,
      bodyText,
      bodyHtml: `<p>${bodyText.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`,
      usedAI: false,
      companyName,
    }
  }

  try {
    const systemPrompt = `Ты эксперт по B2B-продажам на российском рынке.
Напиши персонализированное outreach-письмо на русском языке.
Тон: профессиональный, конкретный, без клише.
Первое предложение — о компании получателя, не о нас.
Заканчивай конкретным вопросом.
Не более 180 слов в теле письма.
Верни JSON: { "subject": "...", "bodyText": "...", "bodyHtml": "..." }`

    const userPrompt = `Данные о компании-получателе:
- Название: ${vars.name}
- Город: ${vars.city || 'не указан'}
- Отрасль: ${vars.industry || 'не указана'}
- Сайт: ${vars.website || 'не указан'}
- Сотрудников: ${vars.employees || 'неизвестно'}

Шаблон письма:
Тема: ${templateSubject}
Тело: ${templateBody}

Персонализируй, сохрани структуру. Верни только JSON.`

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

    const raw = response.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw) as {
      subject?: string
      bodyText?: string
      bodyHtml?: string
    }

    const bodyText = parsed.bodyText ?? applyTemplate(templateBody, vars)
    return {
      subject: parsed.subject ?? applyTemplate(templateSubject, vars),
      bodyText,
      bodyHtml: parsed.bodyHtml ?? `<p>${bodyText.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`,
      usedAI: true,
      companyName,
    }
  } catch (err) {
    logger.warn({ event: 'ai_preview.error', error: err instanceof Error ? err.message : String(err) })
    const subject = applyTemplate(templateSubject, vars)
    const bodyText = applyTemplate(templateBody, vars)
    return {
      subject,
      bodyText,
      bodyHtml: `<p>${bodyText.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`,
      usedAI: false,
      companyName,
    }
  }
}
