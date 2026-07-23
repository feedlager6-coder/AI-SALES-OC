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

  /**
   * Russian Tax ID (ИНН). Used as the primary deduplication key across
   * providers — a company with a known INN will never appear twice in
   * merged results even if two providers return it independently.
   */
  inn?: string | null

  /**
   * Company website / domain (without protocol), e.g. "stroygrupp.ru".
   * Used as the secondary deduplication key when INN is absent.
   */
  website?: string | null

  name: string
  industry: string
  region: string
  /** Human-readable size, e.g. "50–200 сотрудников" */
  size: string
  description: string
  contact: CompanyContact
  signals: CompanySignal[]
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
