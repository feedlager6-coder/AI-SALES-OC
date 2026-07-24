/**
 * ICPScoreCalculator — Ideal Customer Profile fit score.
 *
 * Point breakdown (total possible before penalties: 100):
 *   Industry match      → 30 pts
 *   Region match        → 20 pts
 *   Size in range       → 20 pts
 *   INN verified        → 10 pts
 *   No FSSP flag        → 10 pts
 *   Active (hiring/contracts) → 10 pts
 *
 * Penalties (applied after base score):
 *   financial_risk          → −20
 *   leadership_instability  → −10
 *   activity_decline        → −10
 *
 * Result: clamped to 0–100.
 */

import type { MergedCompany } from '../types.js'
import type { SearchHunt } from '../search-provider.js'

const BASE_POINTS = {
  industryMatch: 30,
  regionMatch:   20,
  sizeInRange:   20,
  innVerified:   10,
  noFsspFlag:    10,
  isActive:      10,
} as const

const PENALTIES: Record<string, number> = {
  financial_risk:          20,
  leadership_instability:  10,
  activity_decline:        10,
}

const ACTIVE_SIGNAL_TYPES = new Set([
  'hiring',
  'hiring_role_match',
  'contract_won',
  'contract_active',
  'expanding',
  'growing',
])

// Extra points awarded when the company has signals the user explicitly wants
const SIGNALS_WANTED_BOOST = 10
// Penalty applied when the company has signals the user explicitly excluded
const EXCLUDE_SIGNALS_PENALTY = 15

export class ICPScoreCalculator {
  calculate(company: MergedCompany, hunt: SearchHunt): number {
    const intent = hunt.intentJson
    let score = 0

    // Industry match
    if (intent.industry) {
      const target = intent.industry.trim().toLowerCase()
      const actual = (company.industry ?? '').trim().toLowerCase()
      if (actual.includes(target) || target.includes(actual)) {
        score += BASE_POINTS.industryMatch
      }
    }

    // Region match
    if (intent.region) {
      const target = intent.region.trim().toLowerCase()
      const actual = (company.region ?? '').trim().toLowerCase()
      if (actual.includes(target) || target.includes(actual)) {
        score += BASE_POINTS.regionMatch
      }
    }

    // Size in range (basic: any size info present counts)
    if (company.size && company.size.trim().length > 0) {
      score += BASE_POINTS.sizeInRange
    }

    // INN verified
    if (typeof company.inn === 'string' && company.inn.trim().length >= 10) {
      score += BASE_POINTS.innVerified
    }

    // No FSSP flag — if no financial_risk signal from fssp source
    const hasFsspFlag = company.signalsV4.some(
      (s) => s.type === 'financial_risk' && s.source === 'fssp',
    )
    if (!hasFsspFlag) score += BASE_POINTS.noFsspFlag

    // Active — has any positive activity signal
    const isActive = company.signalsV4.some((s) => ACTIVE_SIGNAL_TYPES.has(s.type))
    if (isActive) score += BASE_POINTS.isActive

    // Apply penalties from negative signals
    for (const signal of company.signalsV4) {
      const penalty = PENALTIES[signal.type]
      if (penalty !== undefined) score -= penalty
    }

    // ── User-specified signal preferences ─────────────────────────────────────
    // signals_wanted: boost when company has at least one desired signal type
    const signalsWanted = intent.signals_wanted
    if (signalsWanted && signalsWanted.length > 0) {
      const companySignalTypes = new Set(company.signalsV4.map((s) => s.type))
      const hasWanted = signalsWanted.some((t) => companySignalTypes.has(t))
      if (hasWanted) score += SIGNALS_WANTED_BOOST
    }

    // exclude_signals: penalise when company has any signal type the user excluded
    const excludeSignals = intent.exclude_signals
    if (excludeSignals && excludeSignals.length > 0) {
      const companySignalTypes = new Set(company.signalsV4.map((s) => s.type))
      const hasExcluded = excludeSignals.some((t) => companySignalTypes.has(t))
      if (hasExcluded) score -= EXCLUDE_SIGNALS_PENALTY
    }

    return Math.min(100, Math.max(0, score))
  }
}
