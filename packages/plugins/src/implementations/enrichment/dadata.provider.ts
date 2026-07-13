import { getEnv } from '@ai-sales-os/config'
import type {
  ICompanyDataPlugin,
  CompanyDataParams,
  CompanyDataResult,
} from '../../interfaces/index.js'

interface DadataSuggestion {
  value: string
  unrestricted_value: string
  data: {
    inn?: string
    ogrn?: string
    name?: {
      full_with_opf?: string
      short_with_opf?: string
      full?: string
      short?: string
    }
    address?: {
      value?: string
      data?: {
        city?: string
        region?: string
        postal_code?: string
      }
    }
    okved?: string
    okved_type?: string
    okved_name?: string
    management?: {
      name?: string
      post?: string
    }
    state?: {
      status?: 'ACTIVE' | 'LIQUIDATING' | 'LIQUIDATED' | 'BANKRUPT' | 'REORGANIZING'
      registration_date?: number
      liquidation_date?: number
    }
    finance?: {
      year?: number
      revenue?: number
      expense?: number
      net_assets?: number
    }
    employee_count?: number
    branch_count?: number
    hid?: string
  }
}

interface DadataResponse {
  suggestions: DadataSuggestion[]
}

function mapStatus(
  status?: string,
): CompanyDataResult['status'] {
  if (status === 'ACTIVE') return 'active'
  if (status === 'LIQUIDATING' || status === 'BANKRUPT' || status === 'REORGANIZING')
    return 'liquidating'
  if (status === 'LIQUIDATED') return 'liquidated'
  return undefined
}

/**
 * Dadata.ru plugin — enriches companies via Russian ЕГРЮЛ/ЕГРИП registry.
 * Uses the Dadata Suggestions API (official, paid, requires API key).
 * Docs: https://dadata.ru/api/find-party/
 */
export class DadataPlugin implements ICompanyDataPlugin {
  readonly name = 'dadata'
  readonly displayName = 'Dadata (ЕГРЮЛ/ЕГРИП)'
  readonly category = 'company_data' as const

  async isConfigured(_workspaceId: string): Promise<boolean> {
    try {
      const env = getEnv()
      return Boolean(env.DADATA_API_KEY)
    } catch {
      return false
    }
  }

  async getCompanyData(params: CompanyDataParams): Promise<CompanyDataResult | null> {
    const env = getEnv()
    if (!env.DADATA_API_KEY) return null

    // Prefer INN lookup (most precise), fall back to name search
    const [url, body] = params.inn
      ? [
          'https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party',
          JSON.stringify({ query: params.inn }),
        ]
      : [
          'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party',
          JSON.stringify({ query: params.companyName, count: 1 }),
        ]

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${env.DADATA_API_KEY}`,
        'Accept': 'application/json',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })

    if (!resp.ok) {
      throw new Error(`Dadata API error: ${resp.status} ${resp.statusText}`)
    }

    const data = (await resp.json()) as DadataResponse
    const suggestion = data.suggestions?.[0]

    if (!suggestion?.data) return null

    const d = suggestion.data
    const result: CompanyDataResult = {
      raw: d as unknown as Record<string, unknown>,
    }

    if (d.inn) result.inn = d.inn
    if (d.ogrn) result.ogrn = d.ogrn
    if (d.name?.full_with_opf) result.legalName = d.name.full_with_opf
    if (d.management?.name) result.directorName = d.management.name
    if (d.state?.registration_date) {
      result.registrationDate = new Date(d.state.registration_date).toISOString().split('T')[0]
    }
    const mappedStatus = mapStatus(d.state?.status)
    if (mappedStatus) result.status = mappedStatus
    if (d.address?.value) result.address = d.address.value
    if (d.okved) result.okvedCode = d.okved
    if (d.okved_name) result.okvedName = d.okved_name
    if (d.employee_count) result.employeesCount = String(d.employee_count)
    if (d.finance?.revenue) result.revenueRub = d.finance.revenue

    return result
  }
}
