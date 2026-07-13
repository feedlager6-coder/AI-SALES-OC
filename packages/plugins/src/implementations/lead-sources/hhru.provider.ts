import type {
  ILeadSourcePlugin,
  LeadSearchParams,
  LeadSearchResult,
  RawCompanyData,
} from '../../interfaces/index.js'

interface HHEmployer {
  id: number
  name: string
  alternate_url?: string
  url?: string
  site_url?: string
  description?: string
  type?: string
  industries?: Array<{ id: string; name: string }>
  area?: { id: string; name: string }
  employee_number?: string
  open_vacancies?: number
}

interface HHEmployersResponse {
  items: HHEmployer[]
  found: number
  pages: number
  page: number
  per_page: number
}

// HH.ru area IDs for major Russian cities
const AREA_IDS: Record<string, string> = {
  'москва': '1',
  'moscow': '1',
  'санкт-петербург': '2',
  'спб': '2',
  'st. petersburg': '2',
  'екатеринбург': '3',
  'новосибирск': '4',
  'казань': '88',
  'нижний новгород': '66',
  'челябинск': '104',
  'самара': '78',
  'уфа': '99',
  'ростов-на-дону': '76',
  'краснодар': '53',
  'красноярск': '54',
  'воронеж': '26',
  'пермь': '72',
  'омск': '68',
  'волгоград': '24',
}

// HH.ru industry IDs for transport/logistics vertical
const INDUSTRY_IDS: Record<string, string> = {
  'транспорт': '29',
  'transport': '29',
  'логистика': '29',
  'logistics': '29',
  'грузоперевозки': '29',
  'экспедирование': '29',
  'информационные технологии': '7',
  'it': '7',
  'строительство': '33',
  'торговля': '30',
  'производство': '25',
}

function resolveAreaId(cities: string[]): string | undefined {
  for (const city of cities) {
    const id = AREA_IDS[city.toLowerCase().trim()]
    if (id) return id
  }
  return undefined
}

function resolveIndustryId(industries: string[]): string | undefined {
  for (const industry of industries) {
    const id = INDUSTRY_IDS[industry.toLowerCase().trim()]
    if (id) return id
  }
  return undefined
}

/**
 * HH.ru (HeadHunter) employer search plugin.
 * Searches Russian job board for employers by industry and city.
 * Public API — no API key required.
 * Docs: https://api.hh.ru/openapi/redoc#tag/Работодатели
 */
export class HHRuPlugin implements ILeadSourcePlugin {
  readonly name = 'hhru'
  readonly displayName = 'HH.ru (работодатели)'
  readonly category = 'lead_source' as const

  async isConfigured(_workspaceId: string): Promise<boolean> {
    return true // HH.ru public API requires no key
  }

  async search(params: LeadSearchParams): Promise<LeadSearchResult> {
    const areaId = resolveAreaId(params.city ?? [])
    const industryId = resolveIndustryId(params.industry ?? [])
    const text = params.keywords?.join(' ') ?? params.industry?.[0] ?? ''
    const perPage = Math.min(params.limit ?? 50, 50) // HH max per_page

    const urlParams = new URLSearchParams({
      per_page: String(perPage),
      type: 'company',
    })

    if (text) urlParams.set('text', text)
    if (areaId) urlParams.set('area', areaId)
    if (industryId) urlParams.set('industry', industryId)
    if (params.cursor) urlParams.set('page', params.cursor)

    const url = `https://api.hh.ru/employers?${urlParams.toString()}`

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'ai-sales-os/1.0 (contact@ai-sales-os.ru)',
        'HH-User-Agent': 'ai-sales-os/1.0 (contact@ai-sales-os.ru)',
      },
      signal: AbortSignal.timeout(10_000),
    })

    if (!resp.ok) {
      throw new Error(`HH.ru API error: ${resp.status} ${resp.statusText}`)
    }

    const data = (await resp.json()) as HHEmployersResponse

    const companies: RawCompanyData[] = data.items.map((emp) => {
      const company: RawCompanyData = {
        source: 'hhru',
        sourceId: String(emp.id),
        name: emp.name,
        raw: emp as unknown as Record<string, unknown>,
      }

      if (emp.industries?.[0]?.name) company.industry = emp.industries[0].name
      if (emp.area?.name) company.city = emp.area.name
      if (emp.site_url) company.website = emp.site_url
      if (emp.employee_number) company.employeesCount = emp.employee_number

      return company
    })

    const nextPage = data.page + 1 < data.pages ? String(data.page + 1) : undefined

    const result: import('../../interfaces/index.js').LeadSearchResult = {
      companies,
      totalEstimate: data.found,
    }
    if (nextPage) result.nextCursor = nextPage
    return result
  }

  async getCompanyDetails(sourceId: string): Promise<RawCompanyData> {
    const url = `https://api.hh.ru/employers/${sourceId}`
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'ai-sales-os/1.0 (contact@ai-sales-os.ru)' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!resp.ok) throw new Error(`HH.ru API error: ${resp.status}`)

    const emp = (await resp.json()) as HHEmployer

    const company: RawCompanyData = {
      source: 'hhru',
      sourceId: String(emp.id),
      name: emp.name,
      raw: emp as unknown as Record<string, unknown>,
    }

    if (emp.industries?.[0]?.name) company.industry = emp.industries[0].name
    if (emp.area?.name) company.city = emp.area.name
    if (emp.site_url) company.website = emp.site_url
    if (emp.employee_number) company.employeesCount = emp.employee_number

    return company
  }
}
