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

// Note: only city IDs verified to work against the 2GIS Catalog v3 API are listed here.
// Other cities are handled via region text in the search query (see provider.ts buildQuery).
// Moscow ID verified: curl test returned 4051+ results. Other 4504222888* IDs return 404.
export const TWOGIS_CITY_IDS: Readonly<Record<string, string>> = {
  москва:  '4504222397630173',
  moscow:  '4504222397630173',
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
