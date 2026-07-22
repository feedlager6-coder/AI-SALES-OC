/**
 * MockMessageGenerator — template-based message drafting, no AI, no network.
 *
 * Picks a template that matches the company's primary signal (hiring / growing /
 * expanding / contract) and fills in the company name, contact name, industry,
 * and region. Falls back to a generic template when no signals are present.
 *
 * REPLACING THIS IN THE FUTURE:
 *   Create an AIMessageGenerator that implements MessageGenerator:
 *
 *     export class AIMessageGenerator implements MessageGenerator {
 *       generate(company: MockCompany): DraftMessage {
 *         // call your LLM endpoint synchronously (or make generate() async)
 *       }
 *     }
 *
 *   Pass it to DraftMessageScreen instead of MockMessageGenerator.
 *   No UI changes required.
 */

import type { MockCompany, SignalType } from '@/lib/search/types'
import type { MessageGenerator } from './message-generator'
import type { DraftMessage } from './types'

// ─── Template builders ────────────────────────────────────────────────────────

type TemplateVars = {
  contactName: string
  companyName: string
  industry: string
  region: string
}

type TemplateFn = (vars: TemplateVars) => { subject: string; body: string }

const TEMPLATES: Record<SignalType | 'default', TemplateFn> = {
  hiring: ({ contactName, companyName, industry }) => ({
    subject: `Сотрудничество с ${companyName}`,
    body: `Добрый день, ${contactName}!

Обратил внимание, что ${companyName} активно набирает сотрудников — это всегда признак роста. Обычно в такой момент перед командой встаёт вопрос расширения клиентской базы.

Мы помогаем компаниям в ${industry} автоматизировать поиск клиентов и первый контакт с ними, чтобы команда могла фокусироваться на переговорах, а не на холодном обзвоне.

Возможно, это было бы полезно и для вас? Готов рассказать подробнее — 15 минут хватит, чтобы понять, есть ли смысл.`,
  }),

  growing: ({ contactName, companyName, industry }) => ({
    subject: `Предложение для ${companyName}`,
    body: `Здравствуйте, ${contactName}!

Видел, что ${companyName} демонстрирует уверенный рост — поздравляю! Именно в этот момент особенно важно не упустить потенциальных клиентов.

Мы помогаем командам в ${industry} выстраивать стабильный поток лидов и автоматизировать первый контакт — без увеличения штата.

Если интересно — готов показать на конкретных примерах, как это работает.`,
  }),

  expanding: ({ contactName, companyName, industry, region }) => ({
    subject: `${companyName} — выход на новые рынки`,
    body: `Добрый день, ${contactName}!

Узнал, что ${companyName} выходит на новые рынки — отличная новость! Выход в новый регион всегда требует быстрого поиска местных клиентов и партнёров в ${region}.

Мы как раз помогаем компаниям в ${industry} выстраивать первичный контакт с потенциальными клиентами в новых регионах — быстро и без лишних затрат.

Есть несколько идей, которые могут быть полезны — поговорим?`,
  }),

  contract: ({ contactName, companyName, industry }) => ({
    subject: `Поздравляем с новым контрактом — ${companyName}`,
    body: `Здравствуйте, ${contactName}!

Видел информацию о вашем новом контракте — поздравляю с успехом! Это хороший момент, чтобы подумать о следующем шаге.

Мы помогаем компаниям в ${industry} системно выстраивать работу с новыми клиентами — чтобы следующий контракт не заставил себя долго ждать.

Если есть интерес — готов коротко рассказать, как это устроено.`,
  }),

  default: ({ contactName, companyName, industry, region }) => ({
    subject: `Сотрудничество с ${companyName}`,
    body: `Здравствуйте, ${contactName}!

${companyName} привлекла моё внимание как интересный игрок в ${industry} в ${region}.

Мы помогаем компаниям в вашей сфере автоматизировать поиск клиентов и первый контакт с ними — это позволяет команде фокусироваться на переговорах, а не на поиске лидов.

Когда удобно поговорить на 15 минут?`,
  }),
}

// ─── Generator ────────────────────────────────────────────────────────────────

export class MockMessageGenerator implements MessageGenerator {
  generate(company: MockCompany): DraftMessage {
    const primarySignal = company.signals[0]
    const key: SignalType | 'default' = primarySignal?.type ?? 'default'

    const templateFn = TEMPLATES[key]
    const vars: TemplateVars = {
      contactName: company.contact.name.split(' ')[0] ?? company.contact.name,
      companyName: company.name,
      industry:    company.industry,
      region:      company.region,
    }

    const { subject, body } = templateFn(vars)

    return { subject, body, generatedAt: new Date() }
  }
}

// ─── Default singleton ────────────────────────────────────────────────────────

export const mockMessageGenerator = new MockMessageGenerator()
