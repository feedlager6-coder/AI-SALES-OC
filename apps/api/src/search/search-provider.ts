/**
 * SearchProvider — contract every data-source adapter must satisfy.
 *
 * Current implementations (apps/api/src/search/providers/):
 *   MockSearchProvider   — hardcoded mock data, used in development
 *   TwoGISProvider       — 2GIS Catalog API (mock client by default)
 *
 * Future implementations (plug in without changing anything else):
 *   HHProvider           — HH.ru API (companies hiring in a niche)
 *   DadataProvider       — Dadata / ЕГРЮЛ (company registry + enrichment)
 *   HunterProvider       — Hunter.io (email discovery)
 *
 * To add a new provider:
 *   1. Create a class that implements SearchProvider.
 *   2. Register it in apps/api/src/search/setup.ts.
 *   3. Zero changes to SearchOrchestrator, routes, or frontend required.
 */

import type { SearchResult, SignalType } from './types.js'

/**
 * Minimal Hunt surface that SearchProviders need.
 * Does not depend on Drizzle schema types — providers are DB-agnostic.
 *
 * signals_wanted / exclude_signals are optional — parsed by LLM intent interpreter
 * and passed through the pipeline so ICPScoreCalculator can apply boosts/penalties.
 */
export interface SearchHunt {
  id: string
  rawQuery: string
  intentJson: {
    industry: string | null
    region: string | null
    companySize: string | null
    clarifyingAnswer: string | null
    /** Signal types the user explicitly wants to see. Boosts ICP when matched. */
    signals_wanted?: SignalType[]
    /** Signal types the user wants to exclude. Penalises ICP when matched. */
    exclude_signals?: SignalType[]
  }
}

export interface SearchProvider {
  /**
   * Stable machine-readable identifier, e.g. 'mock', '2gis', 'hhru'.
   * Used as a key in logs, metrics, and dedup provenance tracking.
   */
  readonly providerId: string

  /**
   * Human-readable name shown in logs and debugging output.
   */
  readonly providerName: string

  /**
   * Execute a search against this data source.
   * The Hunt contains both the raw query and the structured intent fields.
   * SearchOrchestratorImpl calls this and merges results across all providers.
   */
  search(hunt: SearchHunt): Promise<SearchResult>
}
