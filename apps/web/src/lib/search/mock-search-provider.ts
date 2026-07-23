/**
 * MockSearchProvider — adapter that wraps MockSearchService.
 *
 * This is the only place in the codebase that imports mock-search-service.
 * Everything above this layer (HuntService, UI) is mock-agnostic.
 *
 * Receives a Hunt and extracts the SearchParams the mock service needs,
 * so the mock can filter results by industry / region just as before.
 *
 * To replace with a real provider:
 *   1. Create a class implementing SearchProvider.
 *   2. Swap it in the HuntService singleton (hunt-service.ts).
 *   3. This file can be deleted — no other code depends on it.
 */

import type { SearchProvider } from './search-provider'
import type { Hunt } from '../hunt/hunt-api'
import type { SearchResult } from './types'
import { searchCompanies } from './mock-search-service'

export class MockSearchProvider implements SearchProvider {
  readonly name = 'mock'

  search(hunt: Hunt): Promise<SearchResult> {
    // Extract SearchParams from the Hunt for the internal mock service.
    // Real providers would use hunt.rawQuery or hunt.intentJson directly
    // to build their own API queries.
    return searchCompanies({
      rawQuery:         hunt.rawQuery,
      industry:         hunt.intentJson.industry,
      region:           hunt.intentJson.region,
      companySize:      hunt.intentJson.companySize,
      clarifyingAnswer: hunt.intentJson.clarifyingAnswer,
    })
  }
}
