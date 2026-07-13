/**
 * Rule-based ICP scoring service for the transport vertical.
 * Score range: 0–100. Uses rules defined in verticals/transport/icp.yaml.
 *
 * Sprint 1.2: rule-based only (no AI). Sprint 2.2 will add LLM hybrid scoring.
 */
import { createLogger } from '@ai-sales-os/logger'

const logger = createLogger({ name: 'api:icp-scoring' })

// ─── Transport vertical rules (mirrored from verticals/transport/icp.yaml) ───

const TRANSPORT_INDUSTRIES = new Set([
  'transport',
  'logistics',
  'courier',
  'freight',
  'supply_chain',
  'forwarding',
  // Russian equivalents
  'транспорт',
  'логистика',
  'курьер',
  'грузоперевозки',
  'экспедирование',
  'доставка',
])

const PRIORITY_CITIES = new Set([
  'Москва',
  'Санкт-Петербург',
  'Екатеринбург',
  'Новосибирск',
  'Казань',
  'Нижний Новгород',
  'Самара',
  'Ростов-на-Дону',
  'Краснодар',
])

// Revenue threshold: 50,000,000 RUB
const REVENUE_THRESHOLD = 50_000_000

export const ICP_THRESHOLDS = {
  qualified: 50,
  high_quality: 75,
  reject: 30,
} as const

/**
 * Compute ICP score for a company using transport vertical rules.
 * Returns score 0–100.
 */
// Using a loose input type to work with both Zod-parsed bodies (undefined optional
// fields) and Drizzle-returned rows (null optional fields) without type gymnastics.
export function computeIcpScore(company: {
  industry?: string | null
  city?: string | null
  emails?: string[] | null
  revenueRub?: number | bigint | null
  employeesCount?: string | null
  [key: string]: unknown
}): number {
  const industry = company.industry ?? null
  const city = company.city ?? null
  const emails = company.emails ?? null
  const revenueRub = company.revenueRub != null ? Number(company.revenueRub) : null
  const employeesCount = company.employeesCount ?? null

  let score = 0

  // Rule: industry match → +25
  if (industry) {
    const normalized = industry.toLowerCase().trim()
    if (TRANSPORT_INDUSTRIES.has(normalized)) {
      score += 25
    }
  }

  // Rule: employees_count in range 10+ → +20
  if (employeesCount) {
    const count = parseEmployeesCount(employeesCount)
    if (count >= 10) {
      score += 20
    }
  }

  // Rule: city in priority list → +10
  if (city && PRIORITY_CITIES.has(city)) {
    score += 10
  }

  // Rule: email_found → +10 (Sprint 1.3 enrichment adds more)
  if (emails && emails.length > 0) {
    score += 10
  }

  // Rule: revenue_rub >= 50M → +20
  if (revenueRub != null && revenueRub >= REVENUE_THRESHOLD) {
    score += 20
  }

  // Note: has_open_vacancies (+15) requires HH.ru integration (Sprint 1.3)

  const finalScore = Math.min(100, Math.max(0, score))

  logger.debug({
    event: 'icp.score.computed',
    score: finalScore,
    industry,
    city,
  })

  return finalScore
}

/**
 * Determine company status based on ICP score.
 * Only updates status if the company is in an early pipeline stage.
 */
export function icpScoreToStatus(
  score: number,
  currentStatus: string,
): string | null {
  // Don't override advanced pipeline stages
  const earlyStages = new Set(['new', 'enriching', 'enriched'])
  if (!earlyStages.has(currentStatus)) return null

  if (score >= ICP_THRESHOLDS.high_quality) return 'qualified'
  if (score >= ICP_THRESHOLDS.qualified) return 'qualified'
  if (score < ICP_THRESHOLDS.reject) return 'low_quality'
  return null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseEmployeesCount(value: string): number {
  // Handle ranges like "50-200", "200-500", "1000+"
  const cleaned = value.replace(/[^0-9\-+]/g, '')
  const match = cleaned.match(/^(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}
