/**
 * RankingEngine — scoring and ordering layer between SearchOrchestrator
 * and the final SearchResult.
 *
 * Architecture:
 *
 *   SearchOrchestrator (merges + deduplicates provider results)
 *    ↓
 *   RankingEngine.rank(companies, hunt)
 *    ↓
 *   SearchResult.companies  (sorted by relevance, score stripped)
 *
 * Design principles:
 *   • rankingScore is an internal detail only. It is computed here, used for
 *     ordering, and discarded before the result leaves rank().
 *     It must never appear in API responses or the frontend.
 *   • The interface is the only stable contract. Replacing DefaultRankingEngine
 *     with an AI ranker requires zero changes to callers.
 *
 * Replacing with AI:
 *   1. Create class AiRankingEngine implements RankingEngine.
 *   2. Its rank() can call any LLM — signature stays identical.
 *   3. In setup.ts, pass new AiRankingEngine(llmClient) to SearchOrchestratorImpl.
 *
 * Scoring weights (DefaultRankingEngine):
 *
 *   Signal                      Points
 *   ─────────────────────────── ──────
 *   Email present                  20
 *   Phone present                  15
 *   INN present                    15
 *   Website present                10
 *   Growth signals present         15
 *   Confirmed (INN + website)      10
 *   Industry matches intent        10
 *   Region matches intent           5
 *   ─────────────────────────── ──────
 *   Maximum possible              100
 */

import type { SearchCompany } from './types.js'
import type { SearchHunt } from './search-provider.js'

// ─── Interface ────────────────────────────────────────────────────────────────

export interface RankingEngine {
  /**
   * Sort `companies` by relevance to `hunt`.
   * rankingScore is never present on the returned objects.
   */
  rank(companies: SearchCompany[], hunt: SearchHunt): SearchCompany[]
}

// ─── Internal types ───────────────────────────────────────────────────────────

type ScoredCompany = SearchCompany & { _rankingScore: number }

// ─── Scoring weights ──────────────────────────────────────────────────────────

const WEIGHTS = {
  email:         20,
  phone:         15,
  inn:           15,
  website:       10,
  growthSignals: 15,
  confirmed:     10,
  industryMatch: 10,
  regionMatch:    5,
} as const

const GROWTH_SIGNAL_TYPES = new Set(['growing', 'expanding', 'hiring'])

// ─── Default (rule-based) implementation ─────────────────────────────────────

export class DefaultRankingEngine implements RankingEngine {
  rank(companies: SearchCompany[], hunt: SearchHunt): SearchCompany[] {
    if (companies.length === 0) return []

    const intentIndustry = hunt.intentJson.industry?.trim().toLowerCase() ?? null
    const intentRegion   = hunt.intentJson.region?.trim().toLowerCase()   ?? null

    const scored: ScoredCompany[] = companies.map((company) => ({
      ...company,
      _rankingScore: this.score(company, intentIndustry, intentRegion),
    }))

    // Stable sort: ties preserve provider-dedup priority (first provider wins)
    scored.sort((a, b) => b._rankingScore - a._rankingScore)

    return scored.map(({ _rankingScore: _dropped, ...company }) => company)
  }

  private score(
    company: SearchCompany,
    intentIndustry: string | null,
    intentRegion: string | null,
  ): number {
    let points = 0

    if (this.hasEmail(company))   points += WEIGHTS.email
    if (this.hasPhone(company))   points += WEIGHTS.phone
    if (this.hasInn(company))     points += WEIGHTS.inn
    if (this.hasWebsite(company)) points += WEIGHTS.website

    if (this.hasInn(company) && this.hasWebsite(company)) {
      points += WEIGHTS.confirmed
    }

    if (this.hasGrowthSignals(company)) points += WEIGHTS.growthSignals

    if (intentIndustry && this.matchesIndustry(company, intentIndustry)) {
      points += WEIGHTS.industryMatch
    }
    if (intentRegion && this.matchesRegion(company, intentRegion)) {
      points += WEIGHTS.regionMatch
    }

    return points
  }

  private hasEmail(c: SearchCompany): boolean {
    return typeof c.contact?.email === 'string' && c.contact.email.trim().length > 0
  }

  private hasPhone(c: SearchCompany): boolean {
    return typeof c.contact?.phone === 'string' && c.contact.phone.trim().length > 0
  }

  private hasInn(c: SearchCompany): boolean {
    return typeof c.inn === 'string' && c.inn.trim().length > 0
  }

  private hasWebsite(c: SearchCompany): boolean {
    return typeof c.website === 'string' && c.website.trim().length > 0
  }

  private hasGrowthSignals(c: SearchCompany): boolean {
    return Array.isArray(c.signals) && c.signals.some((s) => GROWTH_SIGNAL_TYPES.has(s.type))
  }

  private matchesIndustry(c: SearchCompany, intentIndustry: string): boolean {
    return c.industry?.trim().toLowerCase().includes(intentIndustry) ?? false
  }

  private matchesRegion(c: SearchCompany, intentRegion: string): boolean {
    return c.region?.trim().toLowerCase().includes(intentRegion) ?? false
  }
}
