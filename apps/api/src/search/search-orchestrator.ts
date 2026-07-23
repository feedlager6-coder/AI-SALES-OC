/**
 * SearchOrchestrator — central coordinator on the API server.
 *
 * Receives a Hunt from the route handler and:
 *   • Runs all registered SearchProviders sequentially
 *   • Merges results across providers
 *   • Deduplicates by INN → domain → id
 *   • Passes merged list through RankingEngine
 *   • Returns a ranked SearchResult (score stripped, never in API response)
 *
 * Architecture:
 *
 *   POST /api/v1/hunts/:id/search
 *    ↓
 *   SearchOrchestratorImpl.search(hunt)
 *    ↓ (sequential, each provider's output informs dedup for the next)
 *   SearchProvider.search(hunt)
 *    ↓
 *   merge + deduplicate
 *    ↓
 *   RankingEngine.rank(companies, hunt)
 *    ↓
 *   SearchResult  →  JSON response  →  Frontend
 *
 * Frontend never sees providers, registry, or ranking internals.
 *
 * How to add a provider:
 *   1. Implement SearchProvider interface.
 *   2. Register in apps/api/src/search/setup.ts.
 *   3. Zero changes to routes, HuntService, or frontend.
 *
 * How to replace ranking:
 *   1. Implement RankingEngine interface (e.g. AiRankingEngine).
 *   2. Pass to SearchOrchestratorImpl constructor in setup.ts.
 *   3. Zero changes everywhere else.
 */

import { createLogger } from '@ai-sales-os/logger'
import type { SearchCompany, SearchResult } from './types.js'
import type { ProviderRegistry } from './provider-registry.js'
import type { SearchHunt } from './search-provider.js'
import { DefaultRankingEngine } from './ranking-engine.js'
import type { RankingEngine } from './ranking-engine.js'

const logger = createLogger({ name: 'api:search-orchestrator' })

// ─── Interface ────────────────────────────────────────────────────────────────

export interface SearchOrchestrator {
  search(hunt: SearchHunt): Promise<SearchResult>
}

// ─── Deduplication helpers ────────────────────────────────────────────────────

/**
 * Build a deduplication key.
 * Priority: INN → domain → id (first-occurrence wins).
 */
function dedupKey(company: SearchCompany): string {
  if (company.inn?.trim()) return `inn:${company.inn.trim()}`
  if (company.website?.trim()) {
    const domain = company.website
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .toLowerCase()
    if (domain) return `domain:${domain}`
  }
  return `id:${company.id}`
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class SearchOrchestratorImpl implements SearchOrchestrator {
  private readonly rankingEngine: RankingEngine

  constructor(
    private readonly registry: ProviderRegistry,
    rankingEngine?: RankingEngine,
  ) {
    this.rankingEngine = rankingEngine ?? new DefaultRankingEngine()
  }

  async search(hunt: SearchHunt): Promise<SearchResult> {
    const providers = this.registry.getAll()

    if (providers.length === 0) {
      throw new Error('[SearchOrchestrator] No providers registered.')
    }

    const allCompanies: SearchCompany[] = []
    const seen = new Set<string>()
    const providerErrors: string[] = []

    for (const provider of providers) {
      try {
        logger.info({
          event: 'search.provider.start',
          providerId: provider.providerId,
          huntId: hunt.id,
        })

        const result = await provider.search(hunt)

        let added = 0
        for (const company of result.companies) {
          const key = dedupKey(company)
          if (!seen.has(key)) {
            seen.add(key)
            allCompanies.push(company)
            added++
          }
        }

        logger.info({
          event: 'search.provider.done',
          providerId: provider.providerId,
          huntId: hunt.id,
          returned: result.companies.length,
          added,
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error({
          event: 'search.provider.error',
          providerId: provider.providerId,
          huntId: hunt.id,
          error: message,
        })
        providerErrors.push(`${provider.providerId}: ${message}`)
      }
    }

    if (allCompanies.length === 0 && providerErrors.length === providers.length) {
      throw new Error(
        `[SearchOrchestrator] All providers failed:\n${providerErrors.join('\n')}`,
      )
    }

    // ── Ranking ───────────────────────────────────────────────────────────────
    // rankingScore is computed internally and stripped before returning.
    // It must never appear in the API response.
    const rankedCompanies = this.rankingEngine.rank(allCompanies, hunt)

    logger.info({
      event: 'search.ranking.done',
      huntId: hunt.id,
      total: rankedCompanies.length,
    })

    return {
      companies: rankedCompanies,
      totalFound: rankedCompanies.length,
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
