/**
 * TwoGIS API raw response types.
 *
 * These types mirror the real 2GIS Catalog API (v3.0) response shape:
 *   GET https://catalog.api.2gis.com/3.0/items
 *       ?q=строительные+компании
 *       &city_id=4504222888030252
 *       &type=branch
 *       &fields=items.org,items.rubrics,items.contact_groups,items.links
 *       &page_size=20
 *       &key=YOUR_API_KEY
 *
 * When the real HTTP client is wired in, no mapper changes are needed —
 * just replace MockTwoGISClient with RealTwoGISClient.
 *
 * Reference: https://docs.2gis.com/en/api/search/catalog/reference/3.0/get
 */

// ─── Nested sub-types ─────────────────────────────────────────────────────────

export interface TwoGISRubric {
  id: string
  name: string
  /** Short / display name for the category */
  short_name?: string
  /** Whether this is the primary rubric for the branch */
  is_main_in_system?: boolean
}

export interface TwoGISAddressComponent {
  type:
    | 'country'
    | 'region'
    | 'city'
    | 'district'
    | 'street'
    | 'house'
    | 'office'
    | 'floor'
    | 'entrance'
    | 'postcode'
  value: string
}

export interface TwoGISAddress {
  postcode?: string
  country_code?: string
  description?: string
  /** Flattened one-line address */
  name?: string
  components?: TwoGISAddressComponent[]
}

export interface TwoGISContact {
  type: 'phone' | 'email' | 'website' | 'fax' | 'vk' | 'instagram' | 'whatsapp'
  value: string
  /** Formatted display string, e.g. "+7 (343) 123-45-67" */
  text?: string
}

export interface TwoGISContactGroup {
  contacts: TwoGISContact[]
}

export interface TwoGISLink {
  type: 'website' | 'vk' | 'instagram' | 'facebook' | 'youtube' | 'telegram'
  value: string
}

export interface TwoGISOrg {
  /** 2GIS internal organisation ID */
  id: string
  name: string
  /** Russian Tax ID (ИНН), 10 or 12 digits */
  inn?: string
  /** ОГРН */
  ogrn?: string
  /** Legal form, e.g. "ООО", "АО", "ИП" */
  legal_form?: string
}

export interface TwoGISScheduleSlot {
  from: string // "09:00"
  to: string   // "18:00"
}

export interface TwoGISScheduleDay {
  working_hours?: TwoGISScheduleSlot[]
  is_working_now?: boolean
}

export type TwoGISSchedule = Partial<
  Record<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun', TwoGISScheduleDay>
>

export interface TwoGISPoint {
  lat: number
  lon: number
}

// ─── Core item (branch / organisation) ───────────────────────────────────────

export interface TwoGISItem {
  /** 2GIS branch ID, globally unique */
  id: string

  /** Display name of the branch */
  name: string

  /** Full legal name (may differ from display name) */
  full_name?: string

  /** Primary activity categories */
  rubrics?: TwoGISRubric[]

  address?: TwoGISAddress

  contact_groups?: TwoGISContactGroup[]

  links?: TwoGISLink[]

  /**
   * Organisation metadata. Present when `fields=items.org` is included.
   * Contains INN, ОГРН, legal form — required for deduplication.
   */
  org?: TwoGISOrg

  point?: TwoGISPoint

  /** Human-readable city/district description */
  adm_div?: Array<{ type: string; name: string; id: string }>

  /**
   * Number of employees. 2GIS does not always expose this field.
   * Format matches our MockCompany.size convention when present.
   */
  employees_count?: string

  schedule?: TwoGISSchedule

  /**
   * Number of active job postings on HH.ru / 2GIS Jobs.
   * Present only when the org has current vacancies.
   */
  vacancy_count?: number

  /** Whether the listing has been claimed and verified by the owner */
  is_verified?: boolean

  /** 2GIS-assigned star rating (1–5) */
  rating?: number

  /** Number of reviews on the 2GIS platform */
  review_count?: number
}

// ─── Top-level response ───────────────────────────────────────────────────────

export interface TwoGISMeta {
  api_version?: string
  code: number
  issue_date?: string
}

export interface TwoGISResult {
  /** Total number of matching items (across all pages) */
  total: number

  /** Items on the current page */
  items: TwoGISItem[]
}

export interface TwoGISApiResponse {
  meta: TwoGISMeta
  result: TwoGISResult
}

// ─── Search request params ────────────────────────────────────────────────────

/**
 * Parameters forwarded to the 2GIS Catalog API.
 * TwoGISProvider builds these from the Hunt's intentJson.
 */
export interface TwoGISSearchParams {
  /** Full-text query, e.g. "строительные компании" */
  q: string

  /**
   * 2GIS city ID. Derived by the provider from hunt.intentJson.region.
   * Examples:
   *   Москва        → '4504222888030252'
   *   Екатеринбург  → '4504222888030765'
   *   Казань        → '4504222888030768'
   *   Новосибирск   → '4504222888030764'
   */
  city_id?: string

  /** Object type filter. Always "branch" for company search. */
  type?: 'branch'

  /** Comma-separated extra fields to include in the response. */
  fields?: string

  /** Results per page (default: 20, max: 50) */
  page_size?: number

  /** 1-based page index */
  page?: number

  /** API key. Injected from TwoGISConfig — never hardcoded in callers. */
  key: string
}
