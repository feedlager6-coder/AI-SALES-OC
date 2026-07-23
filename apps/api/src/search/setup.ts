/**
 * Search layer setup — instantiates and wires up all search components.
 *
 * This is the ONLY file that knows about specific provider implementations.
 * SearchOrchestrator, RankingEngine, and routes depend only on interfaces.
 *
 * To add a new provider:
 *   1. Import it here.
 *   2. providerRegistry.register(new MyProvider())
 *   3. Done — zero changes to routes, orchestrator, or frontend.
 *
 * To replace ranking:
 *   Pass a different RankingEngine to SearchOrchestratorImpl below.
 */

import { ProviderRegistry } from './provider-registry.js'
import { SearchOrchestratorImpl } from './search-orchestrator.js'
import { MockSearchProvider } from './providers/mock/mock.provider.js'
import { TwoGISProvider } from './providers/two-gis/provider.js'

// ─── Provider registry ────────────────────────────────────────────────────────
//
// Registration order = deduplication priority (first wins).
// MockSearchProvider is always first so tests are predictable.
//
export const providerRegistry = new ProviderRegistry()
providerRegistry.register(new MockSearchProvider())
providerRegistry.register(new TwoGISProvider()) // MockTwoGISClient until useMock=false

// ─── Orchestrator singleton ───────────────────────────────────────────────────
//
// DefaultRankingEngine is used by default. To inject AiRankingEngine:
//   new SearchOrchestratorImpl(providerRegistry, new AiRankingEngine(llmClient))
//
export const searchOrchestrator = new SearchOrchestratorImpl(providerRegistry)
