/**
 * HuntService (frontend) — thin bridge between the Discover page and
 * the SearchOrchestrator.
 *
 * The Discover page calls huntService.search(hunt); this class delegates
 * that call directly to the orchestrator. No provider logic lives here —
 * all provider management, sequential execution, and deduplication happen
 * inside SearchOrchestratorImpl.
 *
 * Architecture:
 *
 *   Discover page
 *    ↓ huntService.search(hunt)
 *   HuntService          ← you are here (thin adapter)
 *    ↓ orchestrator.search(hunt)
 *   SearchOrchestratorImpl
 *    ↓ (sequential, deduplicated)
 *   ProviderRegistry → [MockSearchProvider, ...]
 *
 * To add a real provider, see search-orchestrator.ts — no changes needed here.
 */

import type { Hunt } from '../hunt/hunt-api'
import type { SearchResult } from './types'
import type { SearchOrchestrator } from './search-orchestrator'
import { SearchOrchestratorImpl } from './search-orchestrator'
import { ProviderRegistry } from './provider-registry'
import { MockSearchProvider } from './mock-search-provider'

export class HuntService {
  constructor(private readonly orchestrator: SearchOrchestrator) {}

  search(hunt: Hunt): Promise<SearchResult> {
    return this.orchestrator.search(hunt)
  }
}

// ─── Provider registry ────────────────────────────────────────────────────────
//
// Register providers here. Order determines deduplication priority:
// companies from earlier providers win over later ones.
//
// To add a real provider when it's ready:
//   import { TwoGISProvider } from './providers/two-gis-provider'
//   providerRegistry.register(new TwoGISProvider())
//
export const providerRegistry = new ProviderRegistry()
providerRegistry.register(new MockSearchProvider())

// ─── Orchestrator singleton ───────────────────────────────────────────────────

export const searchOrchestrator = new SearchOrchestratorImpl(providerRegistry)

// ─── HuntService singleton ────────────────────────────────────────────────────
//
// Discover page imports this. Swapping the orchestrator here changes the
// entire search strategy without touching the UI.
//
export const huntService = new HuntService(searchOrchestrator)
