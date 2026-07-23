/**
 * SearchProvider — contract that every data-source adapter must satisfy.
 *
 * Each provider receives the full Hunt object so it has access to both
 * the raw query and the structured intent fields. This allows providers
 * to implement their own query strategies without being limited to the
 * pre-parsed fields.
 *
 * Implementations (current and future):
 *   MockSearchProvider   — hardcoded mock data, used in development
 *   TwoGISProvider       — 2GIS API (companies by geo / category)
 *   HHProvider           — HH.ru API (companies hiring in a niche)
 *   DadataProvider       — Dadata / ЕГРЮЛ (company registry + enrichment)
 *   HunterProvider       — Hunter.io (email discovery)
 *
 * To add a new provider:
 *   1. Create a class that implements SearchProvider.
 *   2. Pass it to HuntService alongside (or instead of) existing providers.
 *   3. Zero UI changes required.
 */

import type { Hunt } from '../hunt/hunt-api'
import type { SearchResult } from './types'

export type { Hunt }

export interface SearchProvider {
  /** Human-readable identifier used in logs and debugging. */
  readonly name: string

  /**
   * Execute a search and return a (possibly partial) result set.
   * The Hunt contains both the raw query and the parsed intent fields.
   * HuntService merges results from all registered providers.
   */
  search(hunt: Hunt): Promise<SearchResult>
}
