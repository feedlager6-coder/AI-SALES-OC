import type {
  ILeadSourcePlugin,
  LeadSearchParams,
  LeadSearchResult,
} from '../../interfaces/index.js'

/**
 * CSV Import plugin — always enabled; no external API needed.
 * Actual CSV parsing logic lives in the API layer (upload → validate → create companies).
 * This plugin stub satisfies the registry interface.
 */
export class CSVImportPlugin implements ILeadSourcePlugin {
  readonly name = 'csv'
  readonly displayName = 'CSV Import'
  readonly category = 'lead_source' as const

  async isConfigured(_workspaceId: string): Promise<boolean> {
    return true // always available
  }

  async search(_params: LeadSearchParams): Promise<LeadSearchResult> {
    // CSV import is handled via direct API endpoint, not search
    return { companies: [] }
  }
}
