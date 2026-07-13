export interface CompanyDataParams {
  workspaceId: string
  inn?: string
  ogrn?: string
  companyName?: string
}

export interface CompanyDataResult {
  inn?: string
  ogrn?: string
  legalName?: string
  directorName?: string
  registrationDate?: string
  status?: 'active' | 'liquidating' | 'liquidated'
  revenueRub?: number
  employeesCount?: string
  address?: string
  okvedCode?: string
  okvedName?: string
  raw?: Record<string, unknown>
}

export interface ICompanyDataPlugin {
  readonly name: string
  readonly displayName: string
  readonly category: 'company_data'

  isConfigured(workspaceId: string): Promise<boolean>
  getCompanyData(params: CompanyDataParams): Promise<CompanyDataResult | null>
}
