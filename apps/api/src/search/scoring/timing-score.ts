/**
 * TimingScoreCalculator — recency-weighted score based on V4 signals.
 *
 * Score = max(signal.weight * recencyMultiplier) across all signals.
 * No signals in last 90 days → 0.
 *
 * Recency multipliers:
 *   0–3 days   → 1.0 (very hot)
 *   4–7 days   → 0.8 (hot)
 *   8–14 days  → 0.6 (warm)
 *   15–30 days → 0.4 (cooling)
 *   31–90 days → 0.2 (cold)
 *   > 90 days  → 0   (excluded)
 *
 * Result: 0–100 (clamped).
 */

import type { Signal } from '../types.js'

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

function recencyMultiplier(daysAgo: number): number {
  if (daysAgo <= 3)  return 1.0
  if (daysAgo <= 7)  return 0.8
  if (daysAgo <= 14) return 0.6
  if (daysAgo <= 30) return 0.4
  if (daysAgo <= 90) return 0.2
  return 0
}

export class TimingScoreCalculator {
  /**
   * Calculate timing score for a company based on its signals.
   *
   * Uses `detectedAt` as the reference date when `eventDate` is null.
   * Negative signal types (financial_risk, leadership_instability, activity_decline)
   * are excluded — they affect icpScore, not timingScore.
   */
  calculate(signals: Signal[], now: Date = new Date()): number {
    const NEGATIVE_SIGNALS = new Set([
      'financial_risk',
      'leadership_instability',
      'activity_decline',
    ])

    const nowMs = now.getTime()

    let maxScore = 0

    for (const signal of signals) {
      if (NEGATIVE_SIGNALS.has(signal.type)) continue

      // Use eventDate if available, fall back to detectedAt
      const refDate = signal.eventDate ?? signal.detectedAt
      const ageMs   = nowMs - refDate.getTime()

      if (ageMs > NINETY_DAYS_MS) continue

      const daysAgo    = ageMs / (24 * 60 * 60 * 1000)
      const multiplier = recencyMultiplier(daysAgo)
      const score      = signal.weight * multiplier

      if (score > maxScore) maxScore = score
    }

    return Math.min(100, Math.round(maxScore))
  }
}
