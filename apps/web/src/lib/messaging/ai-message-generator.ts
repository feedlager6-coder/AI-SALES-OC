/**
 * AIMessageGenerator — calls the backend AI generation endpoint.
 *
 * Replaces MockMessageGenerator for the Discover flow. The backend uses
 * GPT-4o-mini to write a personalized cold outreach message based on the
 * company's name, industry, region, signals, and contact info.
 *
 * Falls back gracefully: if the endpoint is unreachable, the error propagates
 * to DraftMessageScreen which shows a retry UI.
 */

import type { MockCompany } from '@/lib/search/types'
import type { DraftMessage } from './types'

interface GenerateApiResponse {
  data: {
    subject: string
    bodyText: string
    generatedAt: string
    usedAI: boolean
  }
}

export class AIMessageGenerator {
  async generate(company: MockCompany): Promise<DraftMessage> {
    const response = await fetch('/api/v1/drafts/generate', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: {
          name: company.name,
          industry: company.industry,
          region: company.region,
          size: company.size,
          inn: company.inn ?? null,
          website: company.website ?? null,
          signals: company.signals,
          contact: company.contact,
        },
      }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      const message = (data as { error?: { message?: string } })?.error?.message
      throw new Error(message ?? `Draft generation failed (${response.status})`)
    }

    const { data } = (await response.json()) as GenerateApiResponse
    return {
      subject: data.subject,
      body: data.bodyText,
      generatedAt: new Date(data.generatedAt),
    }
  }
}

/** Default singleton used by DraftMessageScreen. */
export const aiMessageGenerator = new AIMessageGenerator()
