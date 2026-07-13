import type {
  IEmailFinderPlugin,
  EmailFinderParams,
  EmailFinderResult,
} from '../../interfaces/index.js'

/**
 * Pattern-based email finder — last resort fallback.
 * Guesses common email patterns like firstname@domain.
 * Confidence is always low (0.15) — signals human review needed.
 */
export class PatternEmailFinderPlugin implements IEmailFinderPlugin {
  readonly name = 'pattern'
  readonly displayName = 'Pattern-based (fallback)'
  readonly category = 'email_finder' as const
  readonly costPerLookup = 0

  async isConfigured(_workspaceId: string): Promise<boolean> {
    return true
  }

  async findEmail(params: EmailFinderParams): Promise<EmailFinderResult> {
    if (!params.firstName || !params.domain) {
      return { confidence: 0, source: 'pattern' }
    }

    const firstName = params.firstName.toLowerCase().replace(/[^a-z]/g, '')
    const lastName = params.lastName?.toLowerCase().replace(/[^a-z]/g, '') ?? ''

    const candidates = [
      `${firstName}@${params.domain}`,
      `${firstName}.${lastName}@${params.domain}`,
      `${firstName[0]}${lastName}@${params.domain}`,
    ].filter((e) => e.includes('@') && e.split('@')[0].length > 0)

    return {
      email: candidates[0],
      confidence: 0.15,
      source: 'pattern',
      verificationStatus: 'unknown',
    }
  }
}
