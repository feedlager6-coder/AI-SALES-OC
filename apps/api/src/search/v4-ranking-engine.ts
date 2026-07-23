/**
 * V4RankingEngine — ICP × Timing × Completeness scoring and ranking.
 *
 * Formula:
 *   finalScore = icpScore * 0.60 + timingScore * 0.30 + completeness * 0.10
 *
 * Implements the existing RankingEngine interface for backward compatibility.
 * The orchestrator calls rankV4() directly to get typed RankedCompany[].
 *
 * NOTE: icpScore, timingScore, finalScore are INTERNAL only.
 * They are used for ordering but must not appear in the API JSON response.
 * The orchestrator strips them via toPublicResult() before sending to the client.
 */

import type { SearchCompany, MergedCompany, RankedCompany } from './types.js'
import type { RankingEngine } from './ranking-engine.js'
import type { SearchHunt } from './search-provider.js'
import { ICPScoreCalculator } from './scoring/icp-score.js'
import { TimingScoreCalculator } from './scoring/timing-score.js'
import { CompletenessCalculator } from './scoring/completeness-score.js'

const ICP_WEIGHT         = 0.60
const TIMING_WEIGHT      = 0.30
const COMPLETENESS_WEIGHT = 0.10

export class V4RankingEngine implements RankingEngine {
  private readonly icpCalc:      ICPScoreCalculator
  private readonly timingCalc:   TimingScoreCalculator
  private readonly completenessCalc: CompletenessCalculator

  constructor(
    icpCalc?:          ICPScoreCalculator,
    timingCalc?:       TimingScoreCalculator,
    completenessCalc?: CompletenessCalculator,
  ) {
    this.icpCalc          = icpCalc          ?? new ICPScoreCalculator()
    this.timingCalc       = timingCalc       ?? new TimingScoreCalculator()
    this.completenessCalc = completenessCalc ?? new CompletenessCalculator()
  }

  /**
   * RankingEngine interface implementation.
   * Callers that use the RankingEngine abstraction get SearchCompany[] back.
   * The orchestrator uses rankV4() directly to keep RankedCompany[] types.
   */
  rank(companies: SearchCompany[], hunt: SearchHunt): SearchCompany[] {
    // V4RankingEngine always receives MergedCompany[] from the V4 orchestrator.
    // This cast is safe because SearchOrchestratorV4 guarantees MergedCompany input.
    return this.rankV4(companies as MergedCompany[], hunt)
  }

  /**
   * Full V4 ranking — returns RankedCompany[] with all scoring fields.
   * Called directly by SearchOrchestratorV4.
   */
  rankV4(companies: MergedCompany[], hunt: SearchHunt): RankedCompany[] {
    if (companies.length === 0) return []

    const now = new Date()

    const ranked: RankedCompany[] = companies.map((company) => {
      const icpScore    = this.icpCalc.calculate(company, hunt)
      const timingScore = this.timingCalc.calculate(company.signalsV4, now)
      const completeness = this.completenessCalc.calculate(company)

      const finalScore =
        icpScore    * ICP_WEIGHT +
        timingScore * TIMING_WEIGHT +
        completeness * COMPLETENESS_WEIGHT

      return {
        ...company,
        icpScore:          Math.round(icpScore),
        timingScore:       Math.round(timingScore),
        finalScore:        Math.round(finalScore),
        existsInWorkspace: false, // filled by CompanyRegistry
        workspaceStatus:   'new', // filled by CompanyRegistry
      } satisfies RankedCompany
    })

    // Sort by finalScore DESC — stable sort preserves provider order on ties
    ranked.sort((a, b) => b.finalScore - a.finalScore)

    return ranked
  }
}
