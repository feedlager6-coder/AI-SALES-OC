/**
 * MockSearchProvider — returns hardcoded fixtures after a simulated delay.
 *
 * Used in development while real API keys are not configured.
 * Filters by industry and region to simulate realistic provider behaviour.
 *
 * To replace: implement SearchProvider and register it in setup.ts.
 * Remove MockSearchProvider from the registry when no longer needed.
 */

import type { SearchProvider, SearchHunt } from '../../search-provider.js'
import type { SearchResult, SearchCompany, SearchParams } from '../../types.js'
import { MOCK_COMPANIES } from './mock-data.js'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function filterCompanies(hunt: SearchHunt): SearchCompany[] {
  let results = [...MOCK_COMPANIES]

  const industry = hunt.intentJson.industry?.toLowerCase()
  if (industry) {
    const industryMatches = results.filter(
      (c) =>
        c.industry.toLowerCase().includes(industry) ||
        industry.includes(c.industry.toLowerCase()),
    )
    if (industryMatches.length >= 3) results = industryMatches
  }

  const region = hunt.intentJson.region?.toLowerCase()
  if (region) {
    const regionMatches = results.filter(
      (c) =>
        c.region.toLowerCase().includes(region) ||
        region.includes(c.region.toLowerCase()),
    )
    if (regionMatches.length >= 2) results = regionMatches
  }

  // Deterministic shuffle: same query → same order
  const seed = hunt.rawQuery.length % 7
  results = [...results].sort((a, b) => {
    const aScore = (a.id.charCodeAt(2) + seed) % 5
    const bScore = (b.id.charCodeAt(2) + seed) % 5
    return aScore - bScore
  })

  return results
}

export class MockSearchProvider implements SearchProvider {
  readonly providerId   = 'mock'
  readonly providerName = 'Mock Search Provider'

  async search(hunt: SearchHunt): Promise<SearchResult> {
    // Simulate network latency
    await delay(400)

    const companies = filterCompanies(hunt)

    const query: SearchParams = {
      rawQuery:         hunt.rawQuery,
      industry:         hunt.intentJson.industry,
      region:           hunt.intentJson.region,
      companySize:      hunt.intentJson.companySize,
      clarifyingAnswer: hunt.intentJson.clarifyingAnswer,
    }

    return { companies, totalFound: companies.length, query }
  }
}
