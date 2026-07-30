/**
 * Lightweight ICP scoring helper for workers.
 * Mirrors the scoring logic from apps/api/src/services/icp-scoring.ts
 * without the Fastify/API dependency.
 */

const TRANSPORT_INDUSTRIES = new Set([
  'transport', 'logistics', 'courier', 'freight', 'supply_chain', 'forwarding',
  'транспорт', 'логистика', 'курьер', 'грузоперевозки', 'экспедирование', 'доставка',
])

const PRIORITY_CITIES = new Set([
  'Москва', 'Санкт-Петербург', 'Екатеринбург', 'Новосибирск',
  'Казань', 'Нижний Новгород', 'Самара', 'Ростов-на-Дону', 'Краснодар',
])


const ICP_THRESHOLDS = { qualified: 50, high_quality: 75, reject: 30 } as const

function parseEmployeesCount(value: string): number {
  const match = value.replace(/[^0-9]/g, '').match(/^(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

export function computeIcpScore(company: {
  name?: string
  industry?: string | null
  city?: string | null
  employeesCount?: string | null
}): number {
  let score = 0
  if (company.industry && TRANSPORT_INDUSTRIES.has(company.industry.toLowerCase().trim())) score += 25
  if (company.employeesCount && parseEmployeesCount(company.employeesCount) >= 10) score += 20
  if (company.city && PRIORITY_CITIES.has(company.city)) score += 10
  return Math.min(100, Math.max(0, score))
}

export function icpScoreToStatus(score: number): string {
  if (score >= ICP_THRESHOLDS.high_quality || score >= ICP_THRESHOLDS.qualified) return 'qualified'
  if (score < ICP_THRESHOLDS.reject) return 'low_quality'
  return 'new'
}
