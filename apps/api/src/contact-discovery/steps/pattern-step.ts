/**
 * PatternStep — generates email guesses using common patterns (firstname@domain, etc.)
 * Uses existing PatternEmailFinderPlugin. Confidence: 30.
 * Source: 'pattern'
 */
import { PatternEmailFinderPlugin } from '@ai-sales-os/plugins'
import { createLogger } from '@ai-sales-os/logger'
import type { ContactCandidate } from '../../search/types.js'
import type { RankedCompany } from '../../search/types.js'
import { extractDomain } from '../utils/domain.js'

const logger = createLogger({ name: 'api:contact-discovery:pattern-step' })

export class PatternStep {
  private readonly plugin = new PatternEmailFinderPlugin()

  async run(company: RankedCompany): Promise<ContactCandidate[]> {
    const domain = extractDomain(company.website)
    if (!domain) return []

    // Collect all director names from existing candidates (filled by DadataStep)
    // Pattern step generates emails for any name we already know
    const directors: Array<{ firstName: string; lastName?: string; name: string; role: string }> = []

    // Check if any prior step found a director name without an email
    for (const c of company.contacts) {
      if (c.source === 'dadata' && c.name && !c.email) {
        const parts = c.name.trim().split(/\s+/)
        // Russian name format: Фамилия Имя Отчество
        const [lastName, firstName] = parts
        if (firstName) {
          directors.push({ firstName, lastName, name: c.name, role: c.role ?? 'Генеральный директор' })
        }
      }
    }

    if (directors.length === 0) return []

    const candidates: ContactCandidate[] = []

    for (const director of directors) {
      try {
        const finderParams: { workspaceId: string; domain: string; firstName: string; lastName?: string } = {
          workspaceId: 'system',
          domain,
          firstName: director.firstName,
        }
        if (director.lastName) finderParams.lastName = director.lastName
        const result = await this.plugin.findEmail(finderParams)

        if (result.email) {
          candidates.push({
            name: director.name,
            role: director.role,
            email: result.email,
            emailVerified: false,
            phone: null,
            source: 'pattern',
            confidence: 30,
          })
        }
      } catch (err) {
        logger.warn({
          event: 'contact_discovery.pattern_step.error',
          companyId: company.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return candidates
  }
}
