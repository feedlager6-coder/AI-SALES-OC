/**
 * GenericFallbackStep — generates generic mailbox addresses (info@, sales@, hello@)
 * for the company domain. Last resort — confidence: 20.
 * Source: 'generic'
 */
import { createLogger } from '@ai-sales-os/logger'
import type { ContactCandidate } from '../../search/types.js'
import type { RankedCompany } from '../../search/types.js'
import { extractDomain } from '../utils/domain.js'

const logger = createLogger({ name: 'api:contact-discovery:generic-fallback-step' })

// Common generic mailbox prefixes — ordered by relevance for B2B outreach
const GENERIC_PREFIXES = ['info', 'sales', 'hello'] as const

export class GenericFallbackStep {
  async run(company: RankedCompany): Promise<ContactCandidate[]> {
    const domain = extractDomain(company.website)
    if (!domain) {
      logger.debug({
        event: 'contact_discovery.generic_step.no_domain',
        companyId: company.id,
      })
      return []
    }

    const candidates: ContactCandidate[] = GENERIC_PREFIXES.map((prefix) => ({
      name: null,
      role: null,
      email: `${prefix}@${domain}`,
      emailVerified: false,
      phone: null,
      source: 'generic' as const,
      confidence: 20,
    }))

    return candidates
  }
}
