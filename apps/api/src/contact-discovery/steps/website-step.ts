/**
 * WebsiteStep — stub for Pass 3.
 * Full LLM-powered extraction (Playwright + OpenAI) is implemented in Pass 5.
 */
import type { ContactCandidate } from '../../search/types.js'
import type { RankedCompany } from '../../search/types.js'

export class WebsiteStep {
  /**
   * Returns empty array in Pass 3 — full LLM website extraction added in Pass 5.
   */
  async run(_company: RankedCompany): Promise<ContactCandidate[]> {
    return []
  }
}
