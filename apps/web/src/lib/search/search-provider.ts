/**
 * SearchProvider — contract that every data-source adapter must satisfy.
 *
 * Implementations (current and future):
 *   MockSearchProvider   — hardcoded mock data, used in development
 *   TwoGISProvider       — 2GIS API (companies by geo / category)
 *   HHProvider           — HH.ru API (companies hiring in a niche)
 *   RusprofileProvider   — Rusprofile / ЕГРЮЛ (company registry)
 *   HunterProvider       — Hunter.io (email discovery)
 *   SnovProvider         — Snov.io  (lead enrichment)
 *
 * To add a new provider:
 *   1. Create a class that implements SearchProvider.
 *   2. Pass it to HuntService alongside (or instead of) existing providers.
 *   3. Zero UI changes required.
 */

import type { SearchParams, SearchResult } from './types'

export interface SearchProvider {
  /** Human-readable identifier used in logs and debugging. */
  readonly name: string

  /**
   * Execute a search and return a (possibly partial) result set.
   * HuntService merges results from all registered providers.
   */
  search(params: SearchParams): Promise<SearchResult>
}
