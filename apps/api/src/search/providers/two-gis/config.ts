/**
 * TwoGISConfig — all tunable parameters for the 2GIS integration.
 *
 * On the API server, API keys are read from server-side environment variables
 * (TWOGIS_API_KEY), never from NEXT_PUBLIC_* variables.
 *
 * When the real API key is available:
 *   1. Add TWOGIS_API_KEY to Replit Secrets.
 *   2. Set useMock: false in defaultTwoGISConfig below.
 */

export interface TwoGISConfig {
  readonly baseUrl: string
  readonly apiKey: string
  readonly defaultPageSize: number
  readonly defaultPage: number
  readonly timeoutMs: number
  readonly fields: string
  readonly useMock: boolean
}

// ─── Region → city_id mapping ─────────────────────────────────────────────────

export const TWOGIS_CITY_IDS: Readonly<Record<string, string>> = {
  москва:           '4504222888030252',
  'санкт-петербург': '4504222888030251',
  питер:            '4504222888030251',
  екатеринбург:     '4504222888030765',
  новосибирск:      '4504222888030764',
  казань:           '4504222888030768',
  нижний_новгород:  '4504222888030773',
  краснодар:        '4504222888030772',
  ростов:           '4504222888030772',
  челябинск:        '4504222888030766',
  уфа:              '4504222888030769',
  пермь:            '4504222888030767',
  тюмень:           '4504222888030795',
  самара:           '4504222888030780',
  омск:             '4504222888030775',
  воронеж:          '4504222888030776',
}

export function resolveCityId(region: string | null): string | undefined {
  if (!region) return undefined
  const key = region.toLowerCase().replace(/\s+/g, '_').replace(/ё/g, 'е')
  return TWOGIS_CITY_IDS[key]
}

export const defaultTwoGISConfig: TwoGISConfig = {
  baseUrl:         'https://catalog.api.2gis.com/3.0/items',
  apiKey:          process.env['TWOGIS_API_KEY'] ?? 'TWOGIS_API_KEY_NOT_SET',
  defaultPageSize: 20,
  defaultPage:     1,
  timeoutMs:       8_000,
  fields:          'items.org,items.rubrics,items.contact_groups,items.links,items.adm_div',
  useMock:         true, // ← flip to false when TWOGIS_API_KEY is set
}
