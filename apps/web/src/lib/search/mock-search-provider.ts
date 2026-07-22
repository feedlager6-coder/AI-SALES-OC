/**
 * MockSearchProvider — adapter that wraps MockSearchService.
 *
 * This is the only place in the codebase that imports mock-search-service.
 * Everything above this layer (HuntService, UI) is mock-agnostic.
 */

import type { SearchProvider } from './search-provider'
import type { SearchParams, SearchResult } from './types'
import { searchCompanies } from './mock-search-service'

export class MockSearchProvider implements SearchProvider {
  readonly name = 'mock'

  search(params: SearchParams): Promise<SearchResult> {
    return searchCompanies(params)
  }
}
