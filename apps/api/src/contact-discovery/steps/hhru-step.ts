/**
 * HhruStep — extracts contact emails from HH.ru vacancy descriptions.
 * Searches vacancies for the company and parses "Контактное лицо" field
 * and email patterns from vacancy text.
 * Confidence: 60
 * Source: 'hhru'
 */
import { createLogger } from '@ai-sales-os/logger'
import type { ContactCandidate } from '../../search/types.js'
import type { RankedCompany } from '../../search/types.js'

const logger = createLogger({ name: 'api:contact-discovery:hhru-step' })

// Regex for email addresses in text
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

const HH_API_BASE = 'https://api.hh.ru'
const HHRU_CONFIDENCE = 60

interface HHVacancy {
  id: string
  name: string
  description?: string
  contacts?: {
    name?: string
    email?: string
    phones?: Array<{ formatted?: string }>
  }
  employer?: {
    id?: string
    name?: string
  }
}

interface HHVacanciesResponse {
  items: HHVacancy[]
  found: number
}

interface HHVacancyDetail {
  description?: string
  contacts?: {
    name?: string
    email?: string
    phones?: Array<{ formatted?: string }>
  }
}

export class HhruStep {
  async run(company: RankedCompany): Promise<ContactCandidate[]> {
    const candidates: ContactCandidate[] = []

    try {
      // Search vacancies by employer name
      const searchParams = new URLSearchParams({
        text: company.name,
        per_page: '5',
      })

      const searchResp = await fetch(
        `${HH_API_BASE}/vacancies?${searchParams.toString()}`,
        {
          headers: { 'User-Agent': 'ai-sales-os/1.0 (support@example.com)' },
          signal: AbortSignal.timeout(8_000),
        },
      )

      if (!searchResp.ok) return []

      const searchData = (await searchResp.json()) as HHVacanciesResponse
      const vacancies = searchData.items ?? []

      for (const vacancy of vacancies.slice(0, 3)) {
        try {
          const detailResp = await fetch(
            `${HH_API_BASE}/vacancies/${vacancy.id}`,
            {
              headers: { 'User-Agent': 'ai-sales-os/1.0 (support@example.com)' },
              signal: AbortSignal.timeout(5_000),
            },
          )

          if (!detailResp.ok) continue
          const detail = (await detailResp.json()) as HHVacancyDetail

          // Extract from contacts field
          if (detail.contacts?.email) {
            const candidate: ContactCandidate = {
              name: detail.contacts.name ?? null,
              role: null,
              email: detail.contacts.email,
              emailVerified: false,
              phone: detail.contacts.phones?.[0]?.formatted ?? null,
              source: 'hhru',
              confidence: HHRU_CONFIDENCE,
            }
            candidates.push(candidate)
          }

          // Extract emails from description text via regex
          if (detail.description) {
            // Strip HTML tags before regex matching
            const plainText = detail.description.replace(/<[^>]+>/g, ' ')
            const matches = plainText.match(EMAIL_REGEX)
            if (matches) {
              for (const email of matches) {
                // Skip generic addresses — handled by GenericFallbackStep
                if (/^(info|sales|hello|support|hr|noreply|no-reply)@/i.test(email)) continue
                const existing = candidates.find((c) => c.email === email)
                if (!existing) {
                  candidates.push({
                    name: null,
                    role: null,
                    email,
                    emailVerified: false,
                    phone: null,
                    source: 'hhru',
                    confidence: HHRU_CONFIDENCE - 10, // Slightly lower — no name/role
                  })
                }
              }
            }
          }
        } catch {
          // Vacancy detail fetch failed — continue to next
        }
      }
    } catch (err) {
      logger.warn({
        event: 'contact_discovery.hhru_step.error',
        companyId: company.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }

    return candidates
  }
}
