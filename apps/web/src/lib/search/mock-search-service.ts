import type { SearchParams, SearchResult, MockCompany } from './types'
import { MOCK_COMPANIES } from './mock-data'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Loosely filter companies by the parsed intent params.
 * When no params are extracted, return all companies (random order).
 */
function filterCompanies(params: SearchParams): MockCompany[] {
  let results = [...MOCK_COMPANIES]

  if (params.industry) {
    const needle = params.industry.toLowerCase()
    const industryMatches = results.filter((c) =>
      c.industry.toLowerCase().includes(needle) ||
      needle.includes(c.industry.toLowerCase()),
    )
    // Fall back to full set if filter yields nothing
    if (industryMatches.length >= 3) results = industryMatches
  }

  if (params.region) {
    const needle = params.region.toLowerCase()
    const regionMatches = results.filter((c) =>
      c.region.toLowerCase().includes(needle) ||
      needle.includes(c.region.toLowerCase()),
    )
    if (regionMatches.length >= 2) results = regionMatches
  }

  // Shuffle with a simple seed-based determinism so the same query returns
  // the same order — but still looks randomised to the user.
  const seed = params.rawQuery.length % 7
  results = [...results].sort((a, b) => {
    const aScore = (a.id.charCodeAt(2) + seed) % 5
    const bScore = (b.id.charCodeAt(2) + seed) % 5
    return aScore - bScore
  })

  return results
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * MockSearchService — returns fake data after a short delay.
 *
 * REPLACING THIS IN THE FUTURE:
 * Create a RealSearchService that implements the same async API:
 *
 *   export async function searchCompanies(params: SearchParams): Promise<SearchResult> {
 *     const res = await fetch('/api/v1/hunts', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify(params),
 *     })
 *     return res.json()
 *   }
 *
 * Import that function instead of this one in discover/page.tsx — no UI changes needed.
 */
export async function searchCompanies(params: SearchParams): Promise<SearchResult> {
  // Simulate network latency (slightly less than the animation duration)
  await delay(2400)

  const companies = filterCompanies(params)

  return {
    companies,
    totalFound: companies.length,
    query: params,
  }
}
