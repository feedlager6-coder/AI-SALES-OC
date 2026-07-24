/**
 * SnovStep — fallback to Snov.io when Hunter.io returns no results.
 * Confidence: 65 if verified, 45 if unverified.
 * Source: 'snov'
 */
import { SnovPlugin } from '@ai-sales-os/plugins'
import { createLogger } from '@ai-sales-os/logger'
import type { ContactCandidate } from '../../search/types.js'
import type { RankedCompany } from '../../search/types.js'
import { extractDomain } from '../utils/domain.js'

const logger = createLogger({ name: 'api:contact-discovery:snov-step' })

const CONFIDENCE_VERIFIED = 65
const CONFIDENCE_UNVERIFIED = 45

export class SnovStep {
  private readonly plugin = new SnovPlugin()

  async run(company: RankedCompany, workspaceId: string): Promise<ContactCandidate[]> {
    const domain = extractDomain(company.website)
    if (!domain) return []

    const configured = await this.plugin.isConfigured(workspaceId)
    if (!configured) return []

    const candidates: ContactCandidate[] = []

    try {
      const result = await this.plugin.findEmail({ workspaceId, domain })

      if (!result.email && (!result.allEmails || result.allEmails.length === 0)) {
        return []
      }

      const allEmails =
        result.allEmails ??
        (result.email ? [{ email: result.email, confidence: result.confidence }] : [])

      for (const entry of allEmails) {
        const verified = result.verificationStatus === 'valid'
        const confidence = verified ? CONFIDENCE_VERIFIED : CONFIDENCE_UNVERIFIED
        const name = [entry.firstName, entry.lastName].filter(Boolean).join(' ') || null

        candidates.push({
          name: name ?? null,
          role: entry.title ?? null,
          email: entry.email,
          emailVerified: verified,
          phone: null,
          source: 'snov',
          confidence,
        })
      }
    } catch (err) {
      logger.warn({
        event: 'contact_discovery.snov_step.error',
        companyId: company.id,
        domain,
        error: err instanceof Error ? err.message : String(err),
      })
    }

    return candidates
  }
}
