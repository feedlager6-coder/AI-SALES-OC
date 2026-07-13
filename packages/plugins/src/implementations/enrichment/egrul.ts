import type {
  ICompanyDataPlugin,
  CompanyDataParams,
  CompanyDataResult,
} from '../../interfaces/index.js'

/**
 * ЕГРЮЛ (Federal Tax Service) plugin for Russian company data.
 * Uses the official egrul.nalog.ru public API.
 * No API key required — respects robots.txt and rate limits.
 *
 * Full implementation (actual HTTP calls) will be added in Sprint 1.3.
 */
export class EgrulPlugin implements ICompanyDataPlugin {
  readonly name = 'egrul'
  readonly displayName = 'ЕГРЮЛ (ФНС)'
  readonly category = 'company_data' as const

  async isConfigured(_workspaceId: string): Promise<boolean> {
    return true // public API, no key needed
  }

  async getCompanyData(_params: CompanyDataParams): Promise<CompanyDataResult | null> {
    // TODO Sprint 1.3: implement egrul.nalog.ru API call
    // Rate limit: max 1 req/sec per IP, respect Retry-After headers
    return null
  }
}
