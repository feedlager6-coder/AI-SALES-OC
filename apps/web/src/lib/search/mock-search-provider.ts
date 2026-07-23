/**
 * MockSearchProvider — adapter that wraps MockSearchService.
 *
 * This is the only place in the codebase that imports mock-search-service.
 * Everything above this layer (SearchOrchestratorImpl, HuntService, UI)
 * is mock-agnostic.
 *
 * Receives a Hunt and extracts the SearchParams the mock service needs,
 * so the mock can filter results by industry / region just as before.
 *
 * To replace with a real provider:
 *   1. Create a class implementing SearchProvider (providerRegistry.ts).
 *   2. Register it: providerRegistry.register(new RealProvider())
 *   3. Remove MockSearchProvider from the registry when no longer needed.
 *      No other files need to change.
 */

import type { SearchProvider } from './search-provider'
import type { Hunt } from '../hunt/hunt-api'
import type { SearchResult } from './types'
import { searchCompanies } from './mock-search-service'

export class MockSearchProvider implements SearchProvider {
  readonly providerId = 'mock'
  readonly providerName = 'Mock Search Provider'

  search(hunt: Hunt): Promise<SearchResult> {
    // Extract SearchParams from the Hunt for the internal mock service.
    // Real providers would build their own API queries from hunt.rawQuery
    // or hunt.intentJson directly.
    return searchCompanies({
      rawQuery:         hunt.rawQuery,
      industry:         hunt.intentJson.industry,
      region:           hunt.intentJson.region,
      companySize:      hunt.intentJson.companySize,
      clarifyingAnswer: hunt.intentJson.clarifyingAnswer,
    })
  }
}
