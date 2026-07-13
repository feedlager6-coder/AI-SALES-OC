import { getEnv } from '@ai-sales-os/config'
import type {
  IEmailFinderPlugin,
  EmailFinderParams,
  EmailFinderResult,
} from '../../interfaces/index.js'

interface SnovProspect {
  email: string
  confidence?: number
  first_name?: string
  last_name?: string
  position?: string
  status?: string
}

interface SnovDomainSearchResponse {
  status?: string
  result?: {
    emails?: SnovProspect[]
    total_count?: number
  }
  data?: SnovProspect[]
  message?: string
  error?: string
}


/**
 * Snov.io email finder plugin.
 * Priority 2 in the email finder waterfall (after Hunter.io).
 * Uses API key authentication.
 * Docs: https://snov.io/api
 */
export class SnovPlugin implements IEmailFinderPlugin {
  readonly name = 'snov'
  readonly displayName = 'Snov.io'
  readonly category = 'email_finder' as const
  readonly costPerLookup = 0.001 // USD estimate

  async isConfigured(_workspaceId: string): Promise<boolean> {
    try {
      const env = getEnv()
      return Boolean(env.SNOV_API_KEY)
    } catch {
      return false
    }
  }

  async findEmail(params: EmailFinderParams): Promise<EmailFinderResult> {
    const env = getEnv()
    if (!env.SNOV_API_KEY) return { confidence: 0, source: 'snov' }

    if (params.domain) {
      return this._domainSearch(params, env.SNOV_API_KEY)
    }

    return { confidence: 0, source: 'snov' }
  }

  private async _domainSearch(
    params: EmailFinderParams,
    apiKey: string,
  ): Promise<EmailFinderResult> {
    // Snov.io uses GET with api_key param for domain search
    const urlParams = new URLSearchParams({
      access_token: apiKey,
      domain: params.domain!,
      type: 'all',
      limit: '10',
      lastId: '0',
      position: '',
    })

    const url = `https://app.snov.io/restapi/get-emails-from-url?${urlParams.toString()}`
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
    })

    if (!resp.ok) {
      if (resp.status === 404) return { confidence: 0, source: 'snov' }
      throw new Error(`Snov.io API error: ${resp.status}`)
    }

    const data = (await resp.json()) as SnovDomainSearchResponse

    if (data.error || data.status === 'error') {
      // Not found or no results — not a throw-worthy error
      return { confidence: 0, source: 'snov' }
    }

    const emails = data.result?.emails ?? (data.data as SnovProspect[] | undefined) ?? []
    if (emails.length === 0) return { confidence: 0, source: 'snov' }

    const best = emails.reduce((a: SnovProspect, b: SnovProspect) =>
      (a.confidence ?? 0) >= (b.confidence ?? 0) ? a : b,
    )

    const r: EmailFinderResult = {
      email: best.email,
      confidence: (best.confidence ?? 50) / 100,
      source: 'snov',
      allEmails: emails.map((e) => {
        const entry: { email: string; confidence: number; firstName?: string; lastName?: string; title?: string } = {
          email: e.email,
          confidence: (e.confidence ?? 50) / 100,
        }
        if (e.first_name) entry.firstName = e.first_name
        if (e.last_name) entry.lastName = e.last_name
        if (e.position) entry.title = e.position
        return entry
      }),
    }
    const vs = this._mapStatus(best.status)
    if (vs) r.verificationStatus = vs
    return r
  }

  async getRemainingCredits(): Promise<number> {
    const env = getEnv()
    if (!env.SNOV_API_KEY) return 0

    const urlParams = new URLSearchParams({ access_token: env.SNOV_API_KEY })
    const url = `https://app.snov.io/restapi/get-balance?${urlParams.toString()}`
    const resp = await fetch(url, { signal: AbortSignal.timeout(5_000) })
    if (!resp.ok) return 0

    const data = (await resp.json()) as { balance?: number }
    return data.balance ?? 0
  }

  private _mapStatus(status?: string): EmailFinderResult['verificationStatus'] {
    if (status === 'valid' || status === 'true') return 'valid'
    if (status === 'invalid' || status === 'false') return 'invalid'
    if (status === 'accept_all') return 'catch_all'
    return 'unknown'
  }
}
