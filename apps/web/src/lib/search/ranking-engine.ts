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
 *     ordering, and then discarded before the result leaves this layer.
 *     It must never appear in UI components or API responses.
 *   • The interface is the only stable contract. Implementations can be
 *     swapped freely — see "Replacing with AI" below.
 *   • Rule-based scoring is deterministic and free of external I/O, which
 *     makes it easy to unit-test and reason about without mocking.
 *
 * Replacing DefaultRankingEngine with an AI ranker:
 *   1. Create a class that implements RankingEngine (e.g. AiRankingEngine).
 *   2. Its rank() method can call any LLM or ML service — the signature
 *      stays identical: MockCompany[] + Hunt → MockCompany[].
 *   3. In hunt-service.ts, replace `new DefaultRankingEngine()` with
 *      `new AiRankingEngine(llmClient)`. Zero other changes required.
 *
 * Scoring weights (DefaultRankingEngine, rule-based):
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

import type { Hunt } from '../hunt/hunt-api'
import type { MockCompany } from './types'

// ─── Interface ────────────────────────────────────────────────────────────────

/**
 * RankingEngine — the stable contract every ranking implementation must satisfy.
 *
 * Implementations are free to use rules, embeddings, LLM scoring, or any
 * combination. The caller (SearchOrchestrator) does not care about the
 * mechanism — only the ordered result.
 */
export interface RankingEngine {
  /**
   * Sort `companies` by relevance to `hunt`.
   *
   * @param companies - Merged, deduplicated list from all providers.
   * @param hunt      - The active Hunt, including raw query and intent fields.
   * @returns The same companies in descending relevance order.
   *          The array length is always equal to the input length.
   *          rankingScore is never present on the returned objects.
   */
  rank(companies: MockCompany[], hunt: Hunt): MockCompany[]
}

// ─── Internal types ───────────────────────────────────────────────────────────

/**
 * Internal-only augmentation used within this file during ranking.
 * Never exported — the score is stripped before the result leaves rank().
 */
type ScoredCompany = MockCompany & { _rankingScore: number }

// ─── Scoring weights ──────────────────────────────────────────────────────────

const WEIGHTS = {
  /** Valid email address on the contact record */
  email: 20,
  /** Phone number on the contact record */
  phone: 15,
  /** INN (Russian Tax ID) present — confirms legal identity */
  inn: 15,
  /** Website / domain present */
  website: 10,
  /** At least one growth-category signal (growing / expanding / hiring) */
  growthSignals: 15,
  /** Both INN and website present — "confirmed" company */
  confirmed: 10,
  /** Company's stated industry matches the Hunt intent */
  industryMatch: 10,
  /** Company's region matches the Hunt intent */
  regionMatch: 5,
} as const

/** Signal types that indicate company growth/momentum */
const GROWTH_SIGNAL_TYPES = new Set(['growing', 'expanding', 'hiring'])

// ─── Default (rule-based) implementation ─────────────────────────────────────

export class DefaultRankingEngine implements RankingEngine {
  rank(companies: MockCompany[], hunt: Hunt): MockCompany[] {
    if (companies.length === 0) return []

    const intentIndustry = hunt.intentJson.industry?.trim().toLowerCase() ?? null
    const intentRegion   = hunt.intentJson.region?.trim().toLowerCase()   ?? null

    // Score every company, keeping the original object reference intact.
    const scored: ScoredCompany[] = companies.map((company) => ({
      ...company,
      _rankingScore: this.score(company, intentIndustry, intentRegion),
    }))

    // Sort descending by score; stable sort preserves provider-dedup priority
    // when two companies tie (same score → earlier provider wins).
    scored.sort((a, b) => b._rankingScore - a._rankingScore)

    // Strip the internal score field before returning.
    return scored.map(({ _rankingScore: _dropped, ...company }) => company)
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Compute the rankingScore for a single company.
   * This is the only place where business rules live. Adding a new signal
   * means adding a weight constant and a line here — nothing else changes.
   */
  private score(
    company: MockCompany,
    intentIndustry: string | null,
    intentRegion: string | null,
  ): number {
    let points = 0

    // ── Contact data quality ──────────────────────────────────────────────────
    if (this.hasEmail(company))   points += WEIGHTS.email
    if (this.hasPhone(company))   points += WEIGHTS.phone

    // ── Legal / web identity ──────────────────────────────────────────────────
    if (this.hasInn(company))     points += WEIGHTS.inn
    if (this.hasWebsite(company)) points += WEIGHTS.website

    // Bonus for confirmed identity (both INN and website present)
    if (this.hasInn(company) && this.hasWebsite(company)) {
      points += WEIGHTS.confirmed
    }

    // ── Growth signals ────────────────────────────────────────────────────────
    if (this.hasGrowthSignals(company)) points += WEIGHTS.growthSignals

    // ── Intent matching ───────────────────────────────────────────────────────
    if (intentIndustry && this.matchesIndustry(company, intentIndustry)) {
      points += WEIGHTS.industryMatch
    }
    if (intentRegion && this.matchesRegion(company, intentRegion)) {
      points += WEIGHTS.regionMatch
    }

    return points
  }

  private hasEmail(company: MockCompany): boolean {
    return typeof company.contact?.email === 'string' && company.contact.email.trim().length > 0
  }

  private hasPhone(company: MockCompany): boolean {
    return typeof company.contact?.phone === 'string' && company.contact.phone.trim().length > 0
  }

  private hasInn(company: MockCompany): boolean {
    return typeof company.inn === 'string' && company.inn.trim().length > 0
  }

  private hasWebsite(company: MockCompany): boolean {
    return typeof company.website === 'string' && company.website.trim().length > 0
  }

  private hasGrowthSignals(company: MockCompany): boolean {
    return Array.isArray(company.signals) &&
      company.signals.some((s) => GROWTH_SIGNAL_TYPES.has(s.type))
  }

  private matchesIndustry(company: MockCompany, intentIndustry: string): boolean {
    if (!company.industry) return false
    return company.industry.trim().toLowerCase().includes(intentIndustry)
  }

  private matchesRegion(company: MockCompany, intentRegion: string): boolean {
    if (!company.region) return false
    return company.region.trim().toLowerCase().includes(intentRegion)
  }
}
