/**
 * TwoGISConfig — all tunable parameters for the 2GIS integration.
 *
 * Centralising config here means:
 *   • The API key is never scattered across files.
 *   • Timeout, page size, and retry behaviour can be tuned in one place.
 *   • Tests can inject a different config without monkey-patching.
 *
 * When the real API key is available:
 *   1. Add NEXT_PUBLIC_TWOGIS_API_KEY to the environment (or a server-side
 *      secret if the provider moves to the API server).
 *   2. Replace the placeholder in defaultTwoGISConfig.apiKey.
 *   3. Set useMock: false.
 */

export interface TwoGISConfig {
  /** Base URL for the 2GIS Catalog API. */
  readonly baseUrl: string

  /** 2GIS API key. Required for real requests; ignored by MockTwoGISClient. */
  readonly apiKey: string

  /** Default number of results to fetch per page. Max 50 in the real API. */
  readonly defaultPageSize: number

  /** Default page to start from (1-based). */
  readonly defaultPage: number

  /** Maximum wait time for a single HTTP request, in milliseconds. */
  readonly timeoutMs: number

  /**
   * Extra fields to include in every request.
   * "items.org"            → INN, ОГРН, legal form
   * "items.rubrics"        → activity categories
   * "items.contact_groups" → phones, emails
   * "items.links"          → website, social media
   */
  readonly fields: string

  /**
   * When true, TwoGISProvider uses MockTwoGISClient.
   * When false, it uses the real HTTP client.
   * Flip this to false when the API key is configured.
   */
  readonly useMock: boolean
}

// ─── Region → city_id mapping ─────────────────────────────────────────────────
//
// 2GIS identifies cities by their internal numeric IDs, not by name.
// This map translates the region string extracted by IntentParser into
// the correct city_id for the API query.
//
// To add a new city: look up its ID at
//   https://catalog.api.2gis.com/3.0/cities?country_code=ru&key=YOUR_KEY
// or use the 2GIS web app URL: the city ID appears in the slug.
//
export const TWOGIS_CITY_IDS: Readonly<Record<string, string>> = {
  москва:        '4504222888030252',
  'санкт-петербург': '4504222888030251',
  питер:         '4504222888030251',
  екатеринбург:  '4504222888030765',
  новосибирск:   '4504222888030764',
  казань:        '4504222888030768',
  нижний_новгород: '4504222888030773',
  краснодар:     '4504222888030772',
  ростов:        '4504222888030772',
  челябинск:     '4504222888030766',
  уфа:           '4504222888030769',
  пермь:         '4504222888030767',
  тюмень:        '4504222888030795',
  самара:        '4504222888030780',
  омск:          '4504222888030775',
  воронеж:       '4504222888030776',
}

/**
 * Resolve a human-readable region string to a 2GIS city_id.
 * Returns undefined when the region is not in the mapping (the API will
 * perform a nationwide search instead).
 */
export function resolveCityId(region: string | null): string | undefined {
  if (!region) return undefined
  const key = region
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/ё/g, 'е')
  return TWOGIS_CITY_IDS[key]
}

// ─── Default configuration ────────────────────────────────────────────────────

export const defaultTwoGISConfig: TwoGISConfig = {
  baseUrl:         'https://catalog.api.2gis.com/3.0/items',
  apiKey:          process.env.NEXT_PUBLIC_TWOGIS_API_KEY ?? 'TWOGIS_API_KEY_NOT_SET',
  defaultPageSize: 20,
  defaultPage:     1,
  timeoutMs:       8_000,
  fields:          'items.org,items.rubrics,items.contact_groups,items.links,items.adm_div',
  useMock:         true, // ← flip to false when the real key is configured
}
