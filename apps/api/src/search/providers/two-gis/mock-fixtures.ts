/**
 * Mock 2GIS API fixtures — realistic JSON mirroring the real 2GIS Catalog API v3.0.
 * Used by MockTwoGISClient while the real API key is not configured.
 */

import type { TwoGISApiResponse, TwoGISItem } from './types.js'

const CONSTRUCTION_ITEMS: TwoGISItem[] = [
  {
    id: '70000001040000001',
    name: 'АльфаСтрой',
    full_name: 'ООО «АльфаСтрой»',
    rubrics: [
      { id: '164', name: 'Строительные компании', short_name: 'Строительство', is_main_in_system: true },
      { id: '165', name: 'Генеральные подрядчики', short_name: 'Генподряд' },
    ],
    address: { name: 'Москва, ул. Тверская, 18/1', components: [{ type: 'city', value: 'Москва' }] },
    adm_div: [{ type: 'city', name: 'Москва', id: '4504222888030252' }],
    org: { id: 'org-001', name: 'ООО «АльфаСтрой»', inn: '7703111001', ogrn: '1027700123401', legal_form: 'ООО' },
    contact_groups: [{ contacts: [
      { type: 'phone', value: '+74951110011', text: '+7 (495) 111-00-11' },
      { type: 'email', value: 'info@alphastroy.ru' },
      { type: 'website', value: 'alphastroy.ru' },
    ]}],
    links: [{ type: 'website', value: 'https://alphastroy.ru' }],
    employees_count: '100-300', vacancy_count: 12, is_verified: true, rating: 4.3, review_count: 47,
    point: { lat: 55.760476, lon: 37.617493 },
  },
  {
    id: '70000001040000002',
    name: 'КапиталСтрой Групп',
    full_name: 'АО «КапиталСтрой Групп»',
    rubrics: [{ id: '164', name: 'Строительные компании', short_name: 'Строительство', is_main_in_system: true }],
    address: { name: 'Москва, Ленинградский пр-т, 80', components: [{ type: 'city', value: 'Москва' }] },
    adm_div: [{ type: 'city', name: 'Москва', id: '4504222888030252' }],
    org: { id: 'org-002', name: 'АО «КапиталСтрой Групп»', inn: '7703222002', legal_form: 'АО' },
    contact_groups: [{ contacts: [
      { type: 'phone', value: '+74952220022', text: '+7 (495) 222-00-22' },
      { type: 'email', value: 'corp@kapitalstroy.ru' },
      { type: 'website', value: 'kapitalstroy.ru' },
    ]}],
    links: [{ type: 'website', value: 'https://kapitalstroy.ru' }],
    employees_count: '200-500', vacancy_count: 5, is_verified: true, rating: 4.1, review_count: 82,
    point: { lat: 55.797690, lon: 37.530380 },
  },
  {
    id: '70000001040000003',
    name: 'МегаБилд',
    full_name: 'ООО «МегаБилд»',
    rubrics: [{ id: '164', name: 'Строительные компании', short_name: 'Строительство', is_main_in_system: true }],
    address: { name: 'Москва, ул. Садовая-Черногрязская, 3', components: [{ type: 'city', value: 'Москва' }] },
    adm_div: [{ type: 'city', name: 'Москва', id: '4504222888030252' }],
    org: { id: 'org-003', name: 'ООО «МегаБилд»', inn: '7703333003', legal_form: 'ООО' },
    contact_groups: [{ contacts: [
      { type: 'phone', value: '+74953330033', text: '+7 (495) 333-00-33' },
      { type: 'email', value: 'hello@megabuild.ru' },
    ]}],
    links: [{ type: 'website', value: 'https://megabuild.ru' }],
    employees_count: '50-100', is_verified: false, rating: 3.8, review_count: 21,
    point: { lat: 55.761330, lon: 37.644960 },
  },
]

const LOGISTICS_ITEMS: TwoGISItem[] = [
  {
    id: '70000001040000010',
    name: 'УралГрузТранс',
    full_name: 'ООО «УралГрузТранс»',
    rubrics: [
      { id: '201', name: 'Транспортные компании', short_name: 'Транспорт', is_main_in_system: true },
      { id: '202', name: 'Грузоперевозки' },
    ],
    address: { name: 'Екатеринбург, ул. Малышева, 51', components: [{ type: 'city', value: 'Екатеринбург' }] },
    adm_div: [{ type: 'city', name: 'Екатеринбург', id: '4504222888030765' }],
    org: { id: 'org-010', name: 'ООО «УралГрузТранс»', inn: '6670101010', legal_form: 'ООО' },
    contact_groups: [{ contacts: [
      { type: 'phone', value: '+73431010101', text: '+7 (343) 101-01-01' },
      { type: 'email', value: 'cargo@uralgruztrans.ru' },
      { type: 'website', value: 'uralgruztrans.ru' },
    ]}],
    links: [{ type: 'website', value: 'https://uralgruztrans.ru' }],
    employees_count: '50-200', vacancy_count: 8, is_verified: true, rating: 4.5, review_count: 113,
    point: { lat: 56.838926, lon: 60.605702 },
  },
  {
    id: '70000001040000011',
    name: 'ЛогиПро',
    full_name: 'ООО «ЛогиПро»',
    rubrics: [
      { id: '201', name: 'Транспортные компании', short_name: 'Транспорт', is_main_in_system: true },
      { id: '203', name: 'Логистические компании' },
    ],
    address: { name: 'Екатеринбург, пр-т Ленина, 25', components: [{ type: 'city', value: 'Екатеринбург' }] },
    adm_div: [{ type: 'city', name: 'Екатеринбург', id: '4504222888030765' }],
    org: { id: 'org-011', name: 'ООО «ЛогиПро»', inn: '6670202020', ogrn: '1026600202020', legal_form: 'ООО' },
    contact_groups: [{ contacts: [
      { type: 'phone', value: '+73432020202', text: '+7 (343) 202-02-02' },
      { type: 'email', value: 'info@logipro.ru' },
      { type: 'website', value: 'logipro.ru' },
    ]}],
    links: [{ type: 'website', value: 'https://logipro.ru' }],
    employees_count: '100-300', is_verified: true, rating: 4.2, review_count: 68,
    point: { lat: 56.843332, lon: 60.601895 },
  },
  {
    id: '70000001040000012',
    name: 'СкладПлюс',
    full_name: 'ООО «СкладПлюс»',
    rubrics: [{ id: '203', name: 'Логистические компании', is_main_in_system: true }],
    address: { name: 'Екатеринбург, ул. Цвиллинга, 10', components: [{ type: 'city', value: 'Екатеринбург' }] },
    adm_div: [{ type: 'city', name: 'Екатеринбург', id: '4504222888030765' }],
    org: { id: 'org-012', name: 'ООО «СкладПлюс»', inn: '6670303030', legal_form: 'ООО' },
    contact_groups: [{ contacts: [
      { type: 'phone', value: '+73433030303', text: '+7 (343) 303-03-03' },
      { type: 'website', value: 'skladplus.ru' },
    ]}],
    links: [{ type: 'website', value: 'https://skladplus.ru' }],
    employees_count: '20-80', vacancy_count: 3, is_verified: false, rating: 3.9, review_count: 34,
    point: { lat: 56.856020, lon: 60.621930 },
  },
]

const LEGAL_ITEMS: TwoGISItem[] = [
  {
    id: '70000001040000020',
    name: 'Юридическое бюро «Правовая защита»',
    full_name: 'ООО «Правовая защита»',
    rubrics: [{ id: '301', name: 'Юридические компании', short_name: 'Юридические услуги', is_main_in_system: true }],
    address: { name: 'Казань, ул. Баумана, 44', components: [{ type: 'city', value: 'Казань' }] },
    adm_div: [{ type: 'city', name: 'Казань', id: '4504222888030768' }],
    org: { id: 'org-020', name: 'ООО «Правовая защита»', inn: '1655401010', legal_form: 'ООО' },
    contact_groups: [{ contacts: [
      { type: 'phone', value: '+78432010101', text: '+7 (843) 201-01-01' },
      { type: 'email', value: 'info@pravzaschita.ru' },
      { type: 'website', value: 'pravzaschita.ru' },
    ]}],
    links: [{ type: 'website', value: 'https://pravzaschita.ru' }],
    employees_count: '10-50', is_verified: true, rating: 4.7, review_count: 29,
    point: { lat: 55.796009, lon: 49.106434 },
  },
]

const GENERIC_ITEMS: TwoGISItem[] = [
  ...CONSTRUCTION_ITEMS.slice(0, 2),
  ...LOGISTICS_ITEMS.slice(0, 2),
]

export function getMockResponse(query: string, cityId: string | undefined): TwoGISApiResponse {
  const q = query.toLowerCase()

  let items: TwoGISItem[]

  if (q.includes('строи') || q.includes('подряд') || q.includes('ремонт')) {
    items = cityId === '4504222888030765' ? CONSTRUCTION_ITEMS.slice(2) : CONSTRUCTION_ITEMS
  } else if (
    q.includes('логист') || q.includes('транспорт') ||
    q.includes('перевоз') || q.includes('склад') || q.includes('груз')
  ) {
    items = LOGISTICS_ITEMS
  } else if (q.includes('юрид') || q.includes('право') || q.includes('адвокат')) {
    items = LEGAL_ITEMS
  } else {
    items = GENERIC_ITEMS
  }

  return {
    meta: { api_version: '3.0', code: 200 },
    result: { total: items.length, items },
  }
}
