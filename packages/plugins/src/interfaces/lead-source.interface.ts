export interface LeadSearchParams {
  workspaceId: string
  industry?: string[]
  city?: string[]
  region?: string[]
  keywords?: string[]
  employeesMin?: number
  employeesMax?: number
  limit?: number
  cursor?: string
}

export interface RawCompanyData {
  source: string
  sourceId: string
  name: string
  inn?: string
  domain?: string
  city?: string
  region?: string
  industry?: string
  phone?: string
  website?: string
  employeesCount?: string
  raw?: Record<string, unknown>
}

export interface LeadSearchResult {
  companies: RawCompanyData[]
  nextCursor?: string
  totalEstimate?: number
}

export interface ILeadSourcePlugin {
  readonly name: string
  readonly displayName: string
  readonly category: 'lead_source'

  isConfigured(workspaceId: string): Promise<boolean>
  search(params: LeadSearchParams): Promise<LeadSearchResult>
  getCompanyDetails?(sourceId: string): Promise<RawCompanyData>
}
