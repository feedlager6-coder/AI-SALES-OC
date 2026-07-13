import { getEnv } from '@ai-sales-os/config'
import type {
  ILeadSourcePlugin,
  LeadSearchParams,
  LeadSearchResult,
  RawCompanyData,
} from '../../interfaces/index.js'

interface TwoGisItem {
  id: string
  name: string
  full_name?: string
  rubrics?: Array<{ name: string }>
  point?: { lat: number; lon: number }
  address?: { postcode?: string; building_id?: string; components?: Array<{ type: string; value: string }> }
  contact_groups?: Array<{
    contacts?: Array<{ type: string; value: string }>
  }>
  org?: { inn?: string; ogrn?: string }
  employee_count?: string
  url?: string
}

interface TwoGisResponse {
  meta?: { error?: { type: string; message: string }; code?: number }
  result?: {
    total: number
    items: TwoGisItem[]
  }
}

// Known 2ГИС city IDs for major Russian cities
const CITY_IDS: Record<string, string> = {
  'москва': '4504222397630173',
  'moscow': '4504222397630173',
  'санкт-петербург': '4504222397630182',
  'спб': '4504222397630182',
  'st. petersburg': '4504222397630182',
  'новосибирск': '4504222397630181',
  'екатеринбург': '4504222397630180',
  'казань': '4504222397630179',
  'нижний новгород': '4504222397630178',
  'челябинск': '4504222397630177',
  'самара': '4504222397630176',
  'уфа': '4504222397630175',
  'ростов-на-дону': '4504222397630174',
  'краснодар': '4504222397630173',
  'красноярск': '4504222397630172',
}

function parseCityId(city: string): string | undefined {
  return CITY_IDS[city.toLowerCase().trim()]
}

function extractPhone(item: TwoGisItem): string | undefined {
  const contacts = item.contact_groups?.flatMap((g) => g.contacts ?? []) ?? []
  return contacts.find((c) => c.type === 'phone')?.value
}

function extractWebsite(item: TwoGisItem): string | undefined {
  const contacts = item.contact_groups?.flatMap((g) => g.contacts ?? []) ?? []
  return contacts.find((c) => c.type === 'website')?.value
}

function extractCity(item: TwoGisItem): string | undefined {
  const components = item.address?.components ?? []
  return components.find((c) => c.type === 'city')?.value
}

/**
 * 2ГИС Catalog API v3 lead source plugin.
 * Searches Russian business directory by rubric (category) and city.
 * API docs: https://docs.2gis.com/ru/api/search/catalogs/reference/3.0/
 */
export class TwoGisPlugin implements ILeadSourcePlugin {
  readonly name = '2gis'
  readonly displayName = '2ГИС (справочник компаний)'
  readonly category = 'lead_source' as const

  async isConfigured(_workspaceId: string): Promise<boolean> {
    try {
      const env = getEnv()
      return Boolean(env.TWOGIS_API_KEY)
    } catch {
      return false
    }
  }

  async search(params: LeadSearchParams): Promise<LeadSearchResult> {
    const env = getEnv()
    if (!env.TWOGIS_API_KEY) {
      return { companies: [], totalEstimate: 0 }
    }

    const city = params.city?.[0] ?? 'Москва'
    const cityId = parseCityId(city)
    const query = params.keywords?.join(' ') ?? params.industry?.[0] ?? 'компания'

    const limit = Math.min(params.limit ?? 50, 50) // 2GIS max per page

    const urlParams = new URLSearchParams({
      key: env.TWOGIS_API_KEY,
      q: query,
      type: 'branch',
      fields: 'items.id,items.name,items.full_name,items.rubrics,items.address,items.contact_groups,items.org',
      'page_size': String(limit),
    })

    if (cityId) urlParams.set('city_id', cityId)
    if (params.cursor) urlParams.set('page', params.cursor)

    const url = `https://catalog.api.2gis.com/3.0/items?${urlParams.toString()}`

    const resp = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
    })

    if (!resp.ok) {
      throw new Error(`2GIS API error: ${resp.status} ${resp.statusText}`)
    }

    const data = (await resp.json()) as TwoGisResponse

    if (data.meta?.error) {
      throw new Error(`2GIS API error: ${data.meta.error.message}`)
    }

    const items = data.result?.items ?? []
    const total = data.result?.total ?? 0

    const companies: RawCompanyData[] = items.map((item) => {
      const phone = extractPhone(item)
      const website = extractWebsite(item)
      const cityName = extractCity(item)
      const industry = item.rubrics?.[0]?.name

      const company: RawCompanyData = {
        source: '2gis',
        sourceId: item.id,
        name: item.name,
        raw: item as unknown as Record<string, unknown>,
      }

      if (cityName ?? city) company.city = cityName ?? city
      if (industry) company.industry = industry
      if (item.org?.inn) company.inn = item.org.inn
      if (item.org?.ogrn) company.ogrn = item.org.ogrn
      if (phone) company.phone = phone
      if (website) company.website = website

      return company
    })

    return {
      companies,
      totalEstimate: total,
    }
  }

  async getCompanyDetails(sourceId: string): Promise<RawCompanyData> {
    const env = getEnv()
    if (!env.TWOGIS_API_KEY) throw new Error('2GIS API key not configured')

    const urlParams = new URLSearchParams({
      key: env.TWOGIS_API_KEY,
      id: sourceId,
      fields: 'items.id,items.name,items.full_name,items.rubrics,items.address,items.contact_groups,items.org',
    })

    const url = `https://catalog.api.2gis.com/3.0/items/byid?${urlParams.toString()}`
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!resp.ok) throw new Error(`2GIS API error: ${resp.status}`)

    const data = (await resp.json()) as TwoGisResponse
    const item = data.result?.items?.[0]
    if (!item) throw new Error(`Company ${sourceId} not found in 2GIS`)

    const company: RawCompanyData = {
      source: '2gis',
      sourceId: item.id,
      name: item.name,
      raw: item as unknown as Record<string, unknown>,
    }

    const detailCity = extractCity(item)
    if (detailCity) company.city = detailCity
    const detailIndustry = item.rubrics?.[0]?.name
    if (detailIndustry) company.industry = detailIndustry
    if (item.org?.inn) company.inn = item.org.inn
    if (item.org?.ogrn) company.ogrn = item.org.ogrn
    const phone = extractPhone(item)
    if (phone) company.phone = phone
    const website = extractWebsite(item)
    if (website) company.website = website

    return company
  }
}
