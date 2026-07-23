/**
 * HuntService (frontend) — thin bridge between the Discover page and
 * the backend search API.
 *
 * After the migration to server-side search, this file is now a minimal
 * HTTP adapter. All search business logic (providers, deduplication,
 * ranking) runs on the API server via POST /api/v1/hunts/:id/search.
 *
 * Architecture:
 *
 *   Discover page
 *    ↓ huntService.search(hunt)
 *   HuntService (this file)           ← thin adapter only
 *    ↓ POST /api/v1/hunts/:id/search
 *   API server (apps/api)
 *    ↓
 *   SearchOrchestrator → Providers → Dedup → RankingEngine
 *    ↓
 *   SearchResult JSON
 *    ↓
 *   HuntService returns it to the Discover page
 *
 * The Discover page calls the same huntService.search(hunt) interface as before.
 * No UI changes were required for this migration.
 *
 * Frontend no longer imports:
 *   - SearchOrchestrator
 *   - ProviderRegistry
 *   - SearchProvider
 *   - RankingEngine
 *   - MockSearchProvider / TwoGISProvider
 *   - Any mock data
 */

import type { Hunt } from '../hunt/hunt-api'
import type { SearchResult } from './types'
import { searchHunt } from '../hunt/hunt-api'

export class HuntService {
  /**
   * Execute a search for the given Hunt.
   * Delegates to POST /api/v1/hunts/:id/search on the API server.
   */
  search(hunt: Hunt): Promise<SearchResult> {
    return searchHunt(hunt.id)
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const huntService = new HuntService()
