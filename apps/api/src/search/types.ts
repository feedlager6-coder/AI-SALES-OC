/**
 * Search layer types — shared between SearchOrchestrator, SearchProviders,
 * RankingEngine, and the HTTP response body of POST /api/v1/hunts/:id/search.
 *
 * Frontend receives SearchResult as JSON and renders it without knowing anything
 * about providers, orchestration, or ranking internals.
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

export interface SearchCompany {
  id: string

  /**
   * Russian Tax ID (ИНН). Primary deduplication key across providers —
   * a company with a known INN will never appear twice even if two providers
   * return it independently.
   */
  inn?: string | null

  /**
   * Company website / domain (without protocol), e.g. "stroygrupp.ru".
   * Secondary deduplication key when INN is absent.
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
  companies: SearchCompany[]
  totalFound: number
  query: SearchParams
}
