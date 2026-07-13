import { getEnv } from '@ai-sales-os/config'
import type {
  IEmailFinderPlugin,
  EmailFinderParams,
  EmailFinderResult,
} from '../../interfaces/index.js'

interface HunterEmail {
  value: string
  type?: string
  confidence: number
  first_name?: string
  last_name?: string
  position?: string
  verification?: { status?: string; date?: string }
}

interface HunterDomainSearchResponse {
  data?: {
    domain?: string
    organization?: string
    emails?: HunterEmail[]
    pattern?: string
  }
  meta?: {
    results?: number
    available_results?: number
  }
  errors?: Array<{ id: string; code: number; details: string }>
}

interface HunterEmailFinderResponse {
  data?: {
    first_name?: string
    last_name?: string
    email?: string
    score?: number
    position?: string
    verification?: { status?: string }
  }
  errors?: Array<{ id: string; code: number; details: string }>
}

interface HunterVerifyResponse {
  data?: {
    status?: string
    score?: number
    regexp?: boolean
    gibberish?: boolean
    disposable?: boolean
    webmail?: boolean
    mx_records?: boolean
    smtp_server?: boolean
    smtp_check?: boolean
    accept_all?: boolean
    block?: boolean
  }
  errors?: Array<{ id: string; code: number; details: string }>
}

/**
 * Hunter.io email finder plugin.
 * Priority 1 in the email finder waterfall.
 * Docs: https://hunter.io/api/docs
 */
export class HunterPlugin implements IEmailFinderPlugin {
  readonly name = 'hunter'
  readonly displayName = 'Hunter.io'
  readonly category = 'email_finder' as const
  readonly costPerLookup = 0.001 // USD estimate

  async isConfigured(_workspaceId: string): Promise<boolean> {
    try {
      const env = getEnv()
      return Boolean(env.HUNTER_API_KEY)
    } catch {
      return false
    }
  }

  async findEmail(params: EmailFinderParams): Promise<EmailFinderResult> {
    const env = getEnv()
    if (!env.HUNTER_API_KEY) {
      return { confidence: 0, source: 'hunter' }
    }

    // If we have a specific person, use Email Finder
    if (params.firstName && params.domain) {
      return this._findPersonEmail(params, env.HUNTER_API_KEY)
    }

    // Otherwise domain search for any contact
    if (params.domain) {
      return this._domainSearch(params.domain, env.HUNTER_API_KEY)
    }

    return { confidence: 0, source: 'hunter' }
  }

  private async _findPersonEmail(
    params: EmailFinderParams,
    apiKey: string,
  ): Promise<EmailFinderResult> {
    const urlParams = new URLSearchParams({
      domain: params.domain!,
      first_name: params.firstName!,
      api_key: apiKey,
    })
    if (params.lastName) urlParams.set('last_name', params.lastName)

    const url = `https://api.hunter.io/v2/email-finder?${urlParams.toString()}`
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) })

    if (resp.status === 404) return { confidence: 0, source: 'hunter' }
    if (!resp.ok) throw new Error(`Hunter API error: ${resp.status}`)

    const data = (await resp.json()) as HunterEmailFinderResponse
    if (data.errors?.length) {
      throw new Error(`Hunter API: ${data.errors[0].details}`)
    }

    const email = data.data?.email
    const score = (data.data?.score ?? 0) / 100

    const r1: EmailFinderResult = {
      confidence: score,
      source: 'hunter',
    }
    if (email) r1.email = email
    const vs1 = this._mapVerificationStatus(data.data?.verification?.status)
    if (vs1) r1.verificationStatus = vs1
    return r1
  }

  private async _domainSearch(domain: string, apiKey: string): Promise<EmailFinderResult> {
    const urlParams = new URLSearchParams({
      domain,
      api_key: apiKey,
      limit: '5',
    })

    const url = `https://api.hunter.io/v2/domain-search?${urlParams.toString()}`
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) })

    if (resp.status === 404) return { confidence: 0, source: 'hunter' }
    if (!resp.ok) throw new Error(`Hunter API error: ${resp.status}`)

    const data = (await resp.json()) as HunterDomainSearchResponse
    if (data.errors?.length) {
      throw new Error(`Hunter API: ${data.errors[0].details}`)
    }

    const emails = data.data?.emails ?? []
    if (emails.length === 0) return { confidence: 0, source: 'hunter' }

    // Pick highest-confidence email
    const best = emails.reduce((a, b) => (a.confidence >= b.confidence ? a : b))

    const r2: EmailFinderResult = {
      email: best.value,
      confidence: best.confidence / 100,
      source: 'hunter',
      allEmails: emails.map((e) => {
        const entry: { email: string; confidence: number; firstName?: string; lastName?: string; title?: string } = {
          email: e.value,
          confidence: e.confidence / 100,
        }
        if (e.first_name) entry.firstName = e.first_name
        if (e.last_name) entry.lastName = e.last_name
        if (e.position) entry.title = e.position
        return entry
      }),
    }
    const vs2 = this._mapVerificationStatus(best.verification?.status)
    if (vs2) r2.verificationStatus = vs2
    return r2
  }

  async verifyEmail(email: string): Promise<{ status: string; score: number }> {
    const env = getEnv()
    if (!env.HUNTER_API_KEY) return { status: 'unknown', score: 0 }

    const urlParams = new URLSearchParams({ email, api_key: env.HUNTER_API_KEY })
    const url = `https://api.hunter.io/v2/email-verifier?${urlParams.toString()}`
    const resp = await fetch(url, { signal: AbortSignal.timeout(15_000) })

    if (!resp.ok) return { status: 'unknown', score: 0 }

    const data = (await resp.json()) as HunterVerifyResponse
    return {
      status: data.data?.status ?? 'unknown',
      score: data.data?.score ?? 0,
    }
  }

  async getRemainingCredits(): Promise<number> {
    const env = getEnv()
    if (!env.HUNTER_API_KEY) return 0

    const url = `https://api.hunter.io/v2/account?api_key=${env.HUNTER_API_KEY}`
    const resp = await fetch(url, { signal: AbortSignal.timeout(5_000) })
    if (!resp.ok) return 0

    const data = (await resp.json()) as { data?: { requests?: { month?: { left?: number } } } }
    return data.data?.requests?.month?.left ?? 0
  }

  private _mapVerificationStatus(
    status?: string,
  ): EmailFinderResult['verificationStatus'] {
    if (status === 'valid') return 'valid'
    if (status === 'invalid') return 'invalid'
    if (status === 'accept_all' || status === 'webmail') return 'catch_all'
    return 'unknown'
  }
}
