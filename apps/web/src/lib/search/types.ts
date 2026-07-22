/**
 * Search layer types — the contract between UI components and any search
 * service implementation (mock or real API).
 *
 * To plug in a real backend: replace MockSearchService with a class / function
 * that calls your API and still returns Promise<SearchResult>. No UI changes needed.
 */

export type SignalType = 'hiring' | 'growing' | 'expanding' | 'contract'

export interface CompanySignal {
  label: string
  type: SignalType
}

export interface CompanyContact {
  name: string
  role: string
  email: string
  phone: string
}

export interface MockCompany {
  id: string
  name: string
  industry: string
  region: string
  /** Human-readable size, e.g. "50–200 сотрудников" */
  size: string
  description: string
  contact: CompanyContact
  signals: CompanySignal[]
  website?: string
  foundedYear?: number
}

export interface SearchParams {
  rawQuery: string
  industry: string | null
  region: string | null
  companySize: string | null
  clarifyingAnswer: string | null
}

export interface SearchResult {
  companies: MockCompany[]
  totalFound: number
  query: SearchParams
}
