/**
 * TwoGISMapper — transforms raw 2GIS API items into SearchCompany.
 * All field translation logic lives here; TwoGISProvider and TwoGISClient
 * never contain business rules.
 */

import type { TwoGISApiResponse, TwoGISItem, TwoGISContact } from './types.js'
import type { SearchCompany, SearchParams, SearchResult, CompanySignal } from '../../types.js'

function extractContact(item: TwoGISItem, type: TwoGISContact['type']): string | undefined {
  for (const group of item.contact_groups ?? []) {
    const found = group.contacts.find((c) => c.type === type)
    if (found) return found.text ?? found.value
  }
  return undefined
}

function normaliseDomain(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  return (
    raw.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase() || undefined
  )
}

function extractRegion(item: TwoGISItem): string {
  const city = item.adm_div?.find((d) => d.type === 'city')
  if (city) return city.name
  const component = item.address?.components?.find((c) => c.type === 'city')
  if (component) return component.value
  return 'Россия'
}

function mapSize(raw: string | undefined): string {
  if (!raw) return 'Размер не указан'
  if (raw.includes('-')) return `${raw} сотрудников`
  const n = parseInt(raw, 10)
  if (isNaN(n)) return raw
  if (n < 10)   return 'до 10 сотрудников'
  if (n < 50)   return '10–50 сотрудников'
  if (n < 200)  return '50–200 сотрудников'
  if (n < 1000) return '200–1000 сотрудников'
  return '1000+ сотрудников'
}

function mapSignals(item: TwoGISItem): CompanySignal[] {
  const signals: CompanySignal[] = []
  if (item.vacancy_count && item.vacancy_count > 0) {
    signals.push({ label: `Открыто ${item.vacancy_count} вакансий`, type: 'hiring' })
  }
  if (item.is_verified) {
    signals.push({ label: 'Верифицирован в 2GIS', type: 'growing' })
  }
  if (item.rating !== undefined && item.rating >= 4.5) {
    signals.push({ label: `Высокий рейтинг: ${item.rating.toFixed(1)} ★`, type: 'growing' })
  }
  return signals
}

function mapDescription(item: TwoGISItem): string {
  const rubric =
    item.rubrics?.find((r) => r.is_main_in_system)?.name ??
    item.rubrics?.[0]?.name ??
    'Компания'
  const city     = extractRegion(item)
  const verified = item.is_verified ? ' Верифицированная компания.' : ''
  const reviews  =
    item.review_count && item.review_count > 0 ? ` ${item.review_count} отзывов на 2GIS.` : ''
  return `${rubric} в ${city}.${verified}${reviews}`
}

export class TwoGISMapper {
  toCompany(item: TwoGISItem): SearchCompany | null {
    if (!item.id || !item.name) return null

    const phone   = extractContact(item, 'phone')
    const email   = extractContact(item, 'email')
    const website = extractContact(item, 'website') ?? item.links?.find((l) => l.type === 'website')?.value
    const domain  = normaliseDomain(website)

    return {
      id:      `2gis:${item.id}`,
      inn:     item.org?.inn ?? null,
      website: domain ?? null,
      name:    item.name,
      industry:
        item.rubrics?.find((r) => r.is_main_in_system)?.short_name ??
        item.rubrics?.[0]?.short_name ??
        item.rubrics?.[0]?.name ??
        'Прочие',
      region:      extractRegion(item),
      size:        mapSize(item.employees_count),
      description: mapDescription(item),
      contact: {
        name:  item.org?.name ?? item.full_name ?? item.name,
        role:  item.org?.legal_form ?? 'Организация',
        email: email ?? '',
        phone: phone ?? '',
      },
      signals: mapSignals(item),
    }
  }

  toSearchResult(response: TwoGISApiResponse, query: SearchParams): SearchResult {
    const companies = response.result.items
      .map((item) => this.toCompany(item))
      .filter((c): c is SearchCompany => c !== null)

    return { companies, totalFound: response.result.total, query }
  }
}
