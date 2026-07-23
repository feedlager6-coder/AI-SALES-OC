/**
 * SearchOrchestrator — central coordinator between Hunt and SearchProviders.
 *
 * Hunt never calls a SearchProvider directly. All search traffic flows through
 * the orchestrator, which handles:
 *   • Sequential provider execution (one at a time; simpler failure isolation)
 *   • Result merging across all providers
 *   • Deduplication by INN → domain → id (in that priority order)
 *   • Ranking via RankingEngine (after merge + dedup)
 *
 * Architecture:
 *
 *   Hunt
 *    ↓
 *   SearchOrchestrator.search(hunt)
 *    ↓ (for each provider in ProviderRegistry, sequentially)
 *   SearchProvider.search(hunt)
 *    ↓
 *   merged + deduplicated companies
 *    ↓
 *   RankingEngine.rank(companies, hunt)
 *    ↓
 *   SearchResult  (ordered by relevance, no score field in output)
 *    ↓
 *   UI
 *
 * How to add a real provider (e.g. 2GIS):
 *   1. Create a class implementing SearchProvider with a unique providerId.
 *   2. Call providerRegistry.register(new TwoGISProvider()) in this file.
 *   3. Done — SearchOrchestratorImpl picks it up automatically.
 *      No changes to HuntService, Discover page, or any UI component.
 *
 * How to replace the ranking algorithm (e.g. with AI):
 *   1. Create a class implementing RankingEngine (e.g. AiRankingEngine).
 *   2. Pass it to SearchOrchestratorImpl as the second constructor argument.
 *   3. Done — zero changes to providers, HuntService, or UI required.
 *
 * Sequential vs parallel:
 *   Providers currently run sequentially so each provider's result can inform
 *   deduplication before the next one runs. Switch to parallel by replacing the
 *   for-of loop with Promise.allSettled() when throughput becomes a bottleneck.
 */

import type { Hunt } from '../hunt/hunt-api'
import type { MockCompany, SearchResult } from './types'
import type { ProviderRegistry } from './provider-registry'
import { DefaultRankingEngine } from './ranking-engine'
import type { RankingEngine } from './ranking-engine'

// ─── Interface ────────────────────────────────────────────────────────────────

export interface SearchOrchestrator {
  /**
   * Execute a Hunt against all registered providers and return a unified result.
   * Throws only if every provider fails; partial failures are logged and skipped.
   */
  search(hunt: Hunt): Promise<SearchResult>
}

// ─── Deduplication helpers ────────────────────────────────────────────────────

/**
 * Build a deduplication key for a company.
 *
 * Priority:
 *   1. INN — canonical Russian tax identifier, globally unique
 *   2. Domain (website) — normalised hostname, unique per company
 *   3. id — provider-local identifier (last resort)
 *
 * When two companies share a key, the one from the provider registered earlier
 * in ProviderRegistry wins (first-occurrence semantics).
 */
function dedupKey(company: MockCompany): string {
  if (company.inn) return `inn:${company.inn.trim()}`
  if (company.website) {
    // Normalise: strip protocol, www, and trailing slash
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
    // Allow callers to inject a custom RankingEngine (e.g. AiRankingEngine).
    // Falls back to DefaultRankingEngine (rule-based) when none is provided.
    this.rankingEngine = rankingEngine ?? new DefaultRankingEngine()
  }

  async search(hunt: Hunt): Promise<SearchResult> {
    const providers = this.registry.getAll()

    if (providers.length === 0) {
      throw new Error('[SearchOrchestrator] No providers registered. Add at least one SearchProvider.')
    }

    const allCompanies: MockCompany[] = []
    const seen = new Set<string>()
    const providerErrors: string[] = []

    // ── Sequential execution ──────────────────────────────────────────────────
    //
    // Providers run one after another. Each provider's results are deduplicated
    // against everything collected so far, so the first provider always has
    // highest priority (its companies are never displaced by later providers).
    //
    for (const provider of providers) {
      try {
        console.info(
          `[SearchOrchestrator] Running provider: ${provider.providerName} (${provider.providerId})`,
        )

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

        console.info(
          `[SearchOrchestrator] Provider "${provider.providerId}" returned ` +
            `${result.companies.length} companies (${added} new after dedup).`,
        )
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(
          `[SearchOrchestrator] Provider "${provider.providerId}" failed: ${message}`,
        )
        providerErrors.push(`${provider.providerId}: ${message}`)
        // Continue to the next provider — partial results are better than none.
      }
    }

    if (allCompanies.length === 0 && providerErrors.length === providers.length) {
      throw new Error(
        `[SearchOrchestrator] All providers failed:\n${providerErrors.join('\n')}`,
      )
    }

    // ── Ranking ───────────────────────────────────────────────────────────────
    //
    // After merging and deduplication, pass the flat list through RankingEngine.
    // The engine computes an internal rankingScore for each company, sorts by it
    // descending, and strips the score field before returning — so ranked
    // companies are plain MockCompany objects with no extra fields.
    //
    // rankingScore is an internal detail of this layer and must never reach UI.
    //
    const rankedCompanies = this.rankingEngine.rank(allCompanies, hunt)

    console.info(
      `[SearchOrchestrator] Ranking complete. ` +
        `${rankedCompanies.length} companies ordered by relevance.`,
    )

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
