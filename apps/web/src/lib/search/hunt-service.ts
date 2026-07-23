/**
 * HuntService (frontend) — orchestrates search providers for a given Hunt.
 *
 * Accepts the full Hunt object (returned by the backend after creation)
 * and fans it out to all registered SearchProviders in parallel. Results
 * are merged and deduplicated by company id.
 *
 * Flow:
 *   UI confirms intent
 *     → backend creates Hunt (via hunt-api.ts)
 *     → HuntService.search(hunt)           ← you are here
 *         → MockSearchProvider.search(hunt) (or real providers)
 *         → merge & deduplicate
 *     → SearchResult returned to UI
 *
 * To add a real provider (e.g. TwoGISProvider):
 *   1. Create a class implementing SearchProvider.
 *   2. Append it to the providers[] array in the singleton at the bottom.
 *   3. Zero UI changes required.
 *
 * Provider order matters for merge priority: results from providers[0]
 * win deduplication over providers[1], etc.
 */

import type { SearchProvider } from './search-provider'
import type { Hunt } from '../hunt/hunt-api'
import type { SearchResult } from './types'
import { MockSearchProvider } from './mock-search-provider'

export class HuntService {
  constructor(private readonly providers: SearchProvider[]) {
    if (providers.length === 0) {
      throw new Error('HuntService requires at least one SearchProvider')
    }
  }

  async search(hunt: Hunt): Promise<SearchResult> {
    // Run all providers in parallel — failure-tolerant: one provider crashing
    // does not block results from the others.
    const settlements = await Promise.allSettled(
      this.providers.map((provider) => provider.search(hunt)),
    )

    // Log failures; collect successful results in provider order.
    const successfulResults = settlements.flatMap((settlement, i) => {
      if (settlement.status === 'rejected') {
        console.error(
          `[HuntService] Provider "${this.providers[i]!.name}" failed:`,
          settlement.reason,
        )
        return []
      }
      return [settlement.value]
    })

    if (successfulResults.length === 0) {
      throw new Error('All search providers failed. Please try again.')
    }

    // Merge and deduplicate by company id (first occurrence wins).
    const seen = new Set<string>()
    const companies = successfulResults
      .flatMap((r) => r.companies)
      .filter((company) => {
        if (seen.has(company.id)) return false
        seen.add(company.id)
        return true
      })

    return {
      companies,
      totalFound: companies.length,
      // Reconstruct SearchParams from Hunt for UI compatibility
      query: {
        rawQuery:         hunt.rawQuery,
        industry:         hunt.intentJson.industry,
        region:           hunt.intentJson.region,
        companySize:      hunt.intentJson.companySize,
        clarifyingAnswer: hunt.intentJson.clarifyingAnswer,
      },
    }
  }
}

// ─── Default singleton ────────────────────────────────────────────────────────
//
// Add providers here as they become available:
//   new TwoGISProvider()
//   new HHProvider()
//   new DadataProvider()
//   new HunterProvider()
//
export const huntService = new HuntService([new MockSearchProvider()])
