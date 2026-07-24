/**
 * ContactDiscoveryService — 7-step contact waterfall for V4 pipeline.
 *
 * Waterfall steps (all run in parallel):
 *   1. DadataStep    — director from ЕГРЮЛ (confidence: 70)
 *   2. WebsiteStep   — stub in Pass 3, full LLM in Pass 5
 *   3. HhruStep      — email regex in vacancy text (confidence: 60)
 *   4. HunterStep    — domain + role filter (confidence: 75 verified / 40 unverified)
 *   5. SnovStep      — fallback to Hunter DB (confidence: 65 verified)
 *   6. PatternStep   — firstname@domain patterns (confidence: 30)
 *   7. GenericFallbackStep — info@, sales@, hello@ (confidence: 20)
 *
 * Early stop: if any step returns confidence >= 80 AND emailVerified === true,
 * skip the costly paid API steps (Hunter, Snov). Otherwise run all in parallel.
 *
 * ContactRanker selects the top 3 by effective confidence.
 */
import { createLogger } from '@ai-sales-os/logger'
import type { ContactCandidate, RankedCompany } from '../search/types.js'
import { ContactRanker } from './contact-ranker.js'
import { DadataStep } from './steps/dadata-step.js'
import { WebsiteStep } from './steps/website-step.js'
import { HhruStep } from './steps/hhru-step.js'
import { HunterStep } from './steps/hunter-step.js'
import { SnovStep } from './steps/snov-step.js'
import { PatternStep } from './steps/pattern-step.js'
import { GenericFallbackStep } from './steps/generic-fallback-step.js'

const logger = createLogger({ name: 'api:contact-discovery' })

// Confidence threshold for early stop (skip paid APIs if already satisfied)
const EARLY_STOP_CONFIDENCE = 80

export class ContactDiscoveryService {
  private readonly ranker = new ContactRanker()
  private readonly dadataStep = new DadataStep()
  private readonly websiteStep = new WebsiteStep()
  private readonly hhruStep = new HhruStep()
  private readonly hunterStep = new HunterStep()
  private readonly snovStep = new SnovStep()
  private readonly patternStep = new PatternStep()
  private readonly genericStep = new GenericFallbackStep()

  /**
   * Discover contacts for a single company.
   * Returns up to 3 ContactCandidate objects sorted by confidence DESC.
   *
   * @param company         - Ranked company to discover contacts for
   * @param workspaceId     - Workspace ID for plugin configuration checks
   * @param verticalContext - Vertical context hint (e.g. 'transport') — reserved for future use
   */
  async findForCompany(
    company: RankedCompany,
    workspaceId: string,
    _verticalContext: string,
  ): Promise<ContactCandidate[]> {
    const startMs = Date.now()

    try {
      // ── Phase 1: Run free/no-cost steps in parallel ───────────────────────
      const [dadataResults, websiteResults, hhruResults] = await Promise.allSettled([
        this.dadataStep.run(company),
        this.websiteStep.run(company),
        this.hhruStep.run(company),
      ])

      const phase1Candidates: ContactCandidate[] = [
        ...(dadataResults.status === 'fulfilled' ? dadataResults.value : []),
        ...(websiteResults.status === 'fulfilled' ? websiteResults.value : []),
        ...(hhruResults.status === 'fulfilled' ? hhruResults.value : []),
      ]

      // ── Early stop check ──────────────────────────────────────────────────
      const hasHighConfidenceVerified = phase1Candidates.some(
        (c) => c.confidence >= EARLY_STOP_CONFIDENCE && c.emailVerified && c.email,
      )

      let phase2Candidates: ContactCandidate[] = []

      if (!hasHighConfidenceVerified) {
        // ── Phase 2: Run paid API steps + pattern in parallel ─────────────
        // We need director name for PatternStep — attach phase1 results temporarily
        const companyWithContacts: RankedCompany = {
          ...company,
          contacts: phase1Candidates,
        }

        const [hunterResults, snovResults, patternResults] = await Promise.allSettled([
          this.hunterStep.run(companyWithContacts, workspaceId),
          this.snovStep.run(companyWithContacts, workspaceId),
          this.patternStep.run(companyWithContacts),
        ])

        phase2Candidates = [
          ...(hunterResults.status === 'fulfilled' ? hunterResults.value : []),
          ...(snovResults.status === 'fulfilled' ? snovResults.value : []),
          ...(patternResults.status === 'fulfilled' ? patternResults.value : []),
        ]
      }

      // ── Phase 3: Generic fallback (always run if no email found yet) ──────
      const allSoFar = [...phase1Candidates, ...phase2Candidates]
      const hasAnyEmail = allSoFar.some((c) => c.email)

      let genericResults: ContactCandidate[] = []
      if (!hasAnyEmail) {
        const result = await this.genericStep.run(company).catch(() => [])
        genericResults = result
      }

      const allCandidates = [...allSoFar, ...genericResults]

      // ── Rank and return top 3 ─────────────────────────────────────────────
      const ranked = this.ranker.rank(allCandidates)

      logger.info({
        event: 'contact_discovery.done',
        companyId: company.id,
        totalCandidates: allCandidates.length,
        ranked: ranked.length,
        earlyStop: hasHighConfidenceVerified,
        elapsedMs: Date.now() - startMs,
      })

      return ranked
    } catch (err) {
      logger.error({
        event: 'contact_discovery.fatal',
        companyId: company.id,
        error: err instanceof Error ? err.message : String(err),
      })
      return []
    }
  }
}
