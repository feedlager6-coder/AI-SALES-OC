/**
 * SearchProvider — contract that every data-source adapter must satisfy.
 *
 * Each provider receives the full Hunt object so it has access to both
 * the raw query and the structured intent fields. Providers are free to
 * implement their own query strategies — rule-based, API-driven, or AI-
 * assisted — as long as they return a SearchResult.
 *
 * Current implementations:
 *   MockSearchProvider   — hardcoded mock data, used in development
 *
 * Future implementations (plug in without changing anything else):
 *   TwoGISProvider       — 2GIS API (companies by geo / category)
 *   HHProvider           — HH.ru API (companies hiring in a niche)
 *   DadataProvider       — Dadata / ЕГРЮЛ (company registry + enrichment)
 *   HunterProvider       — Hunter.io (email discovery)
 *
 * To add a new provider:
 *   1. Create a class that implements SearchProvider.
 *   2. Register it: providerRegistry.register(new MyProvider())
 *   3. Zero changes to SearchOrchestrator, HuntService, or UI required.
 */

import type { Hunt } from '../hunt/hunt-api'
import type { SearchResult } from './types'

export type { Hunt }

export interface SearchProvider {
  /**
   * Stable machine-readable identifier, e.g. 'mock', '2gis', 'hhru'.
   * Used as a key in logs, metrics, and dedup provenance tracking.
   */
  readonly providerId: string

  /**
   * Human-readable name shown in logs and debugging output.
   * e.g. 'Mock Search Provider', '2GIS', 'HH.ru'
   */
  readonly providerName: string

  /**
   * Execute a search against this data source.
   * The Hunt contains both the raw query and the structured intent fields.
   * SearchOrchestrator calls this and merges results across all providers.
   */
  search(hunt: Hunt): Promise<SearchResult>
}
