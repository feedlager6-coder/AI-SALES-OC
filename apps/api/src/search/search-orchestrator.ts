/**
 * SearchOrchestrator — V4 tiered pipeline coordinator.
 *
 * V4 pipeline stages:
 *   1.  SearchPlanBuilder.build(hunt) → SearchPlan
 *   2.  Tier1 + Tier2 launched in parallel (Promise.all)
 *       - Redis cache check BEFORE each provider call (TTL: Tier1=6h, Tier2=24h)
 *   3.  DedupEngine.dedup(allRaw)
 *   4.  SignalEngine.extractSignals() per company
 *   5.  ICPScoreCalculator pre-score (for filter threshold)
 *   6.  PreRankingFilter.filter()
 *   7.  CompletenessCalculator per company (used inside V4RankingEngine)
 *   8.  V4RankingEngine.rankV4()
 *   9.  CompanyRegistry — enrich with existsInWorkspace + workspaceStatus
 *   10. CompanyPersister.persist() — async fire-and-forget
 *   11. Return SearchResultV4
 *
 * Frontend never sees providers, registry, or ranking internals.
 * Score fields (icpScore, timingScore, finalScore) are stripped before response.
 */

import { createHash } from 'node:crypto'
import { createLogger } from '@ai-sales-os/logger'
import type { SearchResultV4, SearchPlanSummary, SearchCompany, MergedCompany, RankedCompany } from './types.js'
import type { ProviderRegistry } from './provider-registry.js'
import type { SearchHunt } from './search-provider.js'
import type { V4RankingEngine } from './v4-ranking-engine.js'
import { SearchPlanBuilder } from './search-plan-builder.js'
import { SignalEngine } from './signal-engine.js'
import { ICPScoreCalculator } from './scoring/icp-score.js'
import { PreRankingFilter } from './filter-stage.js'
import { DedupEngine } from './dedup/dedup-engine.js'
import { CompanyRegistry } from './company-registry.js'
import { CompanyPersister } from './persistence/company-persister.js'

const logger = createLogger({ name: 'api:search-orchestrator' })

// Redis cache TTLs in seconds
const TIER1_CACHE_TTL_S = 6 * 60 * 60    // 6 hours
const TIER2_CACHE_TTL_S = 24 * 60 * 60   // 24 hours

// ─── Redis cache interface (ioredis subset we need) ───────────────────────────

interface RedisClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, expiryMode: 'EX', time: number): Promise<unknown>
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface SearchOrchestrator {
  search(hunt: SearchHunt, workspaceId: string): Promise<SearchResultV4>
}

// ─── Cache key helper ─────────────────────────────────────────────────────────

/**
 * Build a deterministic cache key from the full search request.
 *
 * MUST include rawQuery so that two different user queries that happen to parse
 * into the same intent fields (or all-null intent) do NOT collide in Redis.
 *
 * Key shape: `search:<providerId>:<md5(rawQuery|industry|region|companySize|clarifyingAnswer)>`
 */
function buildCacheKey(providerId: string, hunt: SearchHunt): string {
  const keyMaterial = {
    rawQuery:         hunt.rawQuery.trim().toLowerCase(),
    industry:         hunt.intentJson.industry?.trim().toLowerCase() ?? '',
    region:           hunt.intentJson.region?.trim().toLowerCase()   ?? '',
    companySize:      hunt.intentJson.companySize                    ?? '',
    clarifyingAnswer: hunt.intentJson.clarifyingAnswer               ?? '',
  }
  const hash = createHash('md5').update(JSON.stringify(keyMaterial)).digest('hex')
  return `search:${providerId}:${hash}`
}

// ─── Score-stripping for API response ────────────────────────────────────────

/**
 * Remove internal scoring fields before sending to the client.
 * icpScore, timingScore, finalScore are for ordering only — not shown in UI.
 */
export function toPublicCompany(company: RankedCompany): Omit<RankedCompany, 'icpScore' | 'timingScore' | 'finalScore'> {
  const { icpScore: _icp, timingScore: _timing, finalScore: _final, ...rest } = company
  return rest
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class SearchOrchestratorImpl implements SearchOrchestrator {
  private readonly planBuilder:      SearchPlanBuilder
  private readonly signalEngine:     SignalEngine
  private readonly icpCalc:          ICPScoreCalculator
  private readonly filter:           PreRankingFilter
  private readonly dedupEngine:      DedupEngine
  private readonly companyRegistry:  CompanyRegistry
  private readonly companyPersister: CompanyPersister

  constructor(
    private readonly registry:        ProviderRegistry,
    private readonly rankingEngine:   V4RankingEngine,
    private readonly redis:           RedisClient | null = null,
  ) {
    this.planBuilder      = new SearchPlanBuilder()
    this.signalEngine     = new SignalEngine()
    this.icpCalc          = new ICPScoreCalculator()
    this.filter           = new PreRankingFilter()
    this.dedupEngine      = new DedupEngine()
    this.companyRegistry  = new CompanyRegistry()
    this.companyPersister = new CompanyPersister()
  }

  async search(hunt: SearchHunt, workspaceId: string): Promise<SearchResultV4> {
    const startMs = Date.now()

    // ── Step 1: Build search plan ─────────────────────────────────────────────
    const plan = this.planBuilder.build(hunt)

    const providersQueried:   string[] = []
    const providersSucceeded: string[] = []
    const providersFailed:    string[] = []

    const allRaw: SearchCompany[] = []

    // ── Steps 2: Tier1 + Tier2 in parallel ───────────────────────────────────

    const tier1Ids = new Set(plan.tier1.map((e) => e.providerId))
    const tier2Ids = new Set(plan.tier2.map((e) => e.providerId))

    const providers = this.registry.getAll()

    const runProvider = async (
      providerId: string,
      tier: 1 | 2,
    ): Promise<SearchCompany[]> => {
      const provider = providers.find((p) => p.providerId === providerId)
      if (!provider) return []

      providersQueried.push(providerId)
      const ttl = tier === 1 ? TIER1_CACHE_TTL_S : TIER2_CACHE_TTL_S

      // ── Redis cache check ───────────────────────────────────────────────────
      if (this.redis) {
        try {
          const cacheKey   = buildCacheKey(providerId, hunt)
          const cached     = await this.redis.get(cacheKey)
          if (cached) {
            logger.info({
              event: 'search.provider.cache_hit',
              providerId,
              huntId: hunt.id,
            })
            const cachedResult = JSON.parse(cached) as SearchCompany[]
            providersSucceeded.push(providerId)
            return cachedResult
          }

          // Cache miss — run provider and store result
          const result = await provider.search(hunt)
          await this.redis.set(cacheKey, JSON.stringify(result.companies), 'EX', ttl)
          providersSucceeded.push(providerId)
          return result.companies
        } catch (err: unknown) {
          logger.warn({
            event: 'search.provider.cache_error',
            providerId,
            error: err instanceof Error ? err.message : String(err),
          })
          // Fall through to direct provider call
        }
      }

      // No redis or cache error — call provider directly
      try {
        logger.info({ event: 'search.provider.start', providerId, huntId: hunt.id })
        const result = await provider.search(hunt)
        logger.info({
          event:      'search.provider.done',
          providerId,
          huntId:     hunt.id,
          returned:   result.companies.length,
        })
        providersSucceeded.push(providerId)
        return result.companies
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error({ event: 'search.provider.error', providerId, huntId: hunt.id, error: message })
        providersFailed.push(providerId)
        return []
      }
    }

    // Run tier1 and tier2 in parallel
    const tier1ProviderIds = [...tier1Ids].filter((id) => providers.some((p) => p.providerId === id))
    const tier2ProviderIds = [...tier2Ids].filter((id) => providers.some((p) => p.providerId === id))

    // Also include any registered providers not in the plan (run as tier1)
    const planProviderIds = new Set([...tier1Ids, ...tier2Ids])
    const unplannedProviders = providers
      .filter((p) => !planProviderIds.has(p.providerId))
      .map((p) => p.providerId)

    const allProviderCalls = [
      ...tier1ProviderIds.map((id) => runProvider(id, 1)),
      ...unplannedProviders.map((id) => runProvider(id, 1)),
      ...tier2ProviderIds.map((id) => runProvider(id, 2)),
    ]

    const providerResults = await Promise.all(allProviderCalls)
    for (const companies of providerResults) {
      allRaw.push(...companies)
    }

    if (allRaw.length === 0 && providersFailed.length > 0 && providersSucceeded.length === 0) {
      throw new Error(
        `[SearchOrchestrator] All providers failed for hunt ${hunt.id}`,
      )
    }

    // ── Step 3: Dedup ─────────────────────────────────────────────────────────
    const merged: MergedCompany[] = this.dedupEngine.dedup(allRaw)
    const afterDedup = merged.length

    // ── Step 4: Signal extraction ─────────────────────────────────────────────
    const now = new Date()
    for (const company of merged) {
      company.signalsV4 = this.signalEngine.extractSignals(company, now)
    }

    // ── Steps 5–6: ICP pre-score + filter ────────────────────────────────────
    // Attach _icpScore for the filter stage
    for (const company of merged) {
      const score = this.icpCalc.calculate(company, hunt);
      (company as MergedCompany & { _icpScore: number })._icpScore = score
    }

    const filterResult = this.filter.filter(merged)
    const afterFilter  = filterResult.companies.length

    // ── Steps 7–8: Rank ───────────────────────────────────────────────────────
    const rankedCompanies = this.rankingEngine.rankV4(filterResult.companies, hunt)

    // ── Step 9: Workspace registry check ─────────────────────────────────────
    const presenceMap = await this.companyRegistry.checkPresence(
      workspaceId,
      rankedCompanies.map((c) => ({
        id:     c.id,
        inn:    c.inn ?? null,
        domain: c.website ?? null,
      })),
    )

    for (const company of rankedCompanies) {
      const presence = presenceMap.get(company.id)
      if (presence) {
        company.existsInWorkspace = presence.existsInWorkspace
        company.workspaceStatus   = presence.workspaceStatus
      }
    }

    // ── Step 10: Async persistence (fire-and-forget) ──────────────────────────
    void this.companyPersister.persist(hunt.id, workspaceId, rankedCompanies)

    // ── Step 11: Build result ─────────────────────────────────────────────────
    const processingMs = Date.now() - startMs

    const summary: SearchPlanSummary = {
      providersQueried,
      providersSucceeded,
      providersFailed,
      totalRaw:    allRaw.length,
      afterDedup,
      afterFilter,
      processingMs,
    }

    logger.info({
      event:        'search.complete',
      huntId:       hunt.id,
      totalRaw:     allRaw.length,
      afterDedup,
      afterFilter,
      ranked:       rankedCompanies.length,
      processingMs,
    })

    // Strip internal scoring fields — icpScore/timingScore/finalScore are for
    // ordering only and must NOT appear in the API JSON response.
    const publicCompanies = rankedCompanies.map(toPublicCompany)

    return {
      companies:  publicCompanies as RankedCompany[], // shape preserved; scores removed
      totalFound: publicCompanies.length,
      query: {
        rawQuery:         hunt.rawQuery,
        industry:         hunt.intentJson.industry,
        region:           hunt.intentJson.region,
        companySize:      hunt.intentJson.companySize,
        clarifyingAnswer: hunt.intentJson.clarifyingAnswer,
      },
      plan: summary,
    }
  }
}
