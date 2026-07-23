/**
 * TwoGIS API raw response types.
 * Mirrors the real 2GIS Catalog API (v3.0) response shape.
 *
 *   GET https://catalog.api.2gis.com/3.0/items
 *       ?q=строительные+компании&city_id=4504222888030252
 *       &type=branch&fields=items.org,items.rubrics,items.contact_groups,items.links
 *       &page_size=20&key=YOUR_API_KEY
 */

export interface TwoGISRubric {
  id: string
  name: string
  short_name?: string
  is_main_in_system?: boolean
}

export interface TwoGISAddressComponent {
  type: 'country' | 'region' | 'city' | 'district' | 'street' | 'house' | 'office' | 'floor' | 'entrance' | 'postcode'
  value: string
}

export interface TwoGISAddress {
  postcode?: string
  country_code?: string
  description?: string
  name?: string
  components?: TwoGISAddressComponent[]
}

export interface TwoGISContact {
  type: 'phone' | 'email' | 'website' | 'fax' | 'vk' | 'instagram' | 'whatsapp'
  value: string
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
  id: string
  name: string
  inn?: string
  ogrn?: string
  legal_form?: string
}

export interface TwoGISScheduleSlot {
  from: string
  to: string
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

export interface TwoGISItem {
  id: string
  name: string
  full_name?: string
  rubrics?: TwoGISRubric[]
  address?: TwoGISAddress
  contact_groups?: TwoGISContactGroup[]
  links?: TwoGISLink[]
  org?: TwoGISOrg
  point?: TwoGISPoint
  adm_div?: Array<{ type: string; name: string; id: string }>
  employees_count?: string
  schedule?: TwoGISSchedule
  vacancy_count?: number
  is_verified?: boolean
  rating?: number
  review_count?: number
}

export interface TwoGISMeta {
  api_version?: string
  code: number
  issue_date?: string
}

export interface TwoGISResult {
  total: number
  items: TwoGISItem[]
}

export interface TwoGISApiResponse {
  meta: TwoGISMeta
  result: TwoGISResult
}

export interface TwoGISSearchParams {
  q: string
  city_id?: string
  type?: 'branch'
  fields?: string
  page_size?: number
  page?: number
  key: string
}
