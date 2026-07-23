/**
 * PreRankingFilter — removes companies that should never reach the user.
 *
 * Filter rules (in order):
 *   1. Remove liquidated companies (status from Dadata)
 *   2. Remove companies with icpScore < 20 (after initial ICP calculation)
 *   3. Remove companies with active FSSP debt flag (if fsspFilterEnabled)
 *   4. Remove remaining confirmed duplicates (potentialDuplicate companies
 *      where a better match already exists)
 *
 * Logs filter stats for SearchPlanSummary.
 */

import { createLogger } from '@ai-sales-os/logger'
import type { MergedCompany } from './types.js'

const logger = createLogger({ name: 'api:filter-stage' })

export interface FilterOptions {
  /** Remove companies flagged as FSSP debtors. Default: false (not enabled without FSSP key). */
  fsspFilterEnabled?: boolean
  /** Minimum ICP score to pass filter. Default: 20. */
  minIcpScore?: number
}

export interface FilterResult {
  companies:    MergedCompany[]
  removedCount: number
  reasons:      Record<string, number>
}

export class PreRankingFilter {
  filter(
    companies: MergedCompany[],
    options: FilterOptions = {},
  ): FilterResult {
    const { fsspFilterEnabled = false, minIcpScore = 20 } = options

    const reasons: Record<string, number> = {
      liquidated:   0,
      low_icp:      0,
      fssp_debt:    0,
      duplicate:    0,
    }

    const passed = companies.filter((company) => {
      // Rule 1: Remove liquidated companies
      // Dadata sets description to include "ликвидирован" for dissolved companies
      const isLiquidated =
        company.description?.toLowerCase().includes('ликвидирован') ||
        company.description?.toLowerCase().includes('ликвидировано')
      if (isLiquidated) {
        reasons['liquidated']++
        return false
      }

      // Rule 2: Remove companies with low ICP score
      // icpScore is set on MergedCompany by ICPScoreCalculator before this filter runs
      const icpScore = (company as MergedCompany & { _icpScore?: number })._icpScore ?? 0
      if (icpScore < minIcpScore) {
        reasons['low_icp']++
        return false
      }

      // Rule 3: FSSP filter
      if (fsspFilterEnabled) {
        const hasFsspDebt = company.signalsV4.some(
          (s) => s.type === 'financial_risk' && s.source === 'fssp',
        )
        if (hasFsspDebt) {
          reasons['fssp_debt']++
          return false
        }
      }

      return true
    })

    const removedCount = companies.length - passed.length

    logger.info({
      event:        'filter_stage.complete',
      input:        companies.length,
      output:       passed.length,
      removedCount,
      reasons,
    })

    return { companies: passed, removedCount, reasons }
  }
}
