/**
 * DadataStep — extracts director name and role from ЕГРЮЛ via Dadata.
 * Confidence: 70 (ЕГРЮЛ data is authoritative for director name but email must be guessed).
 * Source: 'dadata'
 */
import { DadataPlugin } from '@ai-sales-os/plugins'
import { createLogger } from '@ai-sales-os/logger'
import type { ContactCandidate } from '../../search/types.js'
import type { RankedCompany } from '../../search/types.js'

const logger = createLogger({ name: 'api:contact-discovery:dadata-step' })

const DIRECTOR_CONFIDENCE = 70

export class DadataStep {
  private readonly plugin = new DadataPlugin()

  async run(company: RankedCompany): Promise<ContactCandidate[]> {
    try {
      const params: { workspaceId: string; inn?: string; companyName: string } = {
        workspaceId: 'system', // Dadata uses env-level API key, not per-workspace
        companyName: company.name,
      }
      if (company.inn) params.inn = company.inn

      const result = await this.plugin.getCompanyData(params)
      if (!result?.directorName) return []

      // Status check — don't add contacts for liquidated companies
      if (result.status === 'liquidated') return []

      const candidate: ContactCandidate = {
        name: result.directorName,
        role: 'Генеральный директор',
        // email is unknown at this point — requires Hunter/Snov/Pattern to fill
        email: '',
        emailVerified: false,
        phone: null,
        source: 'dadata',
        confidence: DIRECTOR_CONFIDENCE,
      }

      return [candidate]
    } catch (err) {
      logger.warn({
        event: 'contact_discovery.dadata_step.error',
        companyId: company.id,
        error: err instanceof Error ? err.message : String(err),
      })
      return []
    }
  }
}
