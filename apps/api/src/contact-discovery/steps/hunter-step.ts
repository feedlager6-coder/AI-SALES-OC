/**
 * HunterStep — finds and verifies emails via Hunter.io.
 * Filters by executive roles (CEO, General, Commercial Director).
 * Confidence: 75 if emailVerified, 40 if unverified.
 * Source: 'hunter'
 */
import { HunterPlugin } from '@ai-sales-os/plugins'
import { createLogger } from '@ai-sales-os/logger'
import type { ContactCandidate } from '../../search/types.js'
import type { RankedCompany } from '../../search/types.js'
import { extractDomain } from '../utils/domain.js'

const logger = createLogger({ name: 'api:contact-discovery:hunter-step' })

const CONFIDENCE_VERIFIED = 75
const CONFIDENCE_UNVERIFIED = 40

// Role keywords to prioritise — CEO, Commercial Director, General Director
const TARGET_ROLE_KEYWORDS = [
  'ceo', 'chief executive', 'генеральный', 'commercial', 'коммерческий', 'director', 'директор',
]

function isTargetRole(title: string | undefined): boolean {
  if (!title) return false
  const lower = title.toLowerCase()
  return TARGET_ROLE_KEYWORDS.some((kw) => lower.includes(kw))
}

export class HunterStep {
  private readonly plugin = new HunterPlugin()

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

      const allEmails = result.allEmails ?? (result.email ? [{ email: result.email, confidence: result.confidence }] : [])

      for (const entry of allEmails) {
        const targetRole = isTargetRole(entry.title)

        // Verify email if we have the capability
        let verified = result.verificationStatus === 'valid'
        if (!verified && entry.email) {
          try {
            const verification = await this.plugin.verifyEmail(entry.email)
            verified = verification.status === 'valid'
          } catch {
            // Verification failed — keep as unverified
          }
        }

        const confidence = verified ? CONFIDENCE_VERIFIED : CONFIDENCE_UNVERIFIED
        // Boost confidence for executive roles
        const adjustedConfidence = targetRole ? Math.min(100, confidence + 10) : confidence

        const name = [entry.firstName, entry.lastName].filter(Boolean).join(' ') || null

        candidates.push({
          name: name ?? null,
          role: entry.title ?? null,
          email: entry.email,
          emailVerified: verified,
          phone: null,
          source: 'hunter',
          confidence: adjustedConfidence,
        })
      }
    } catch (err) {
      logger.warn({
        event: 'contact_discovery.hunter_step.error',
        companyId: company.id,
        domain,
        error: err instanceof Error ? err.message : String(err),
      })
    }

    return candidates
  }
}
