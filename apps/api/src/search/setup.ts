/**
 * Search layer setup — instantiates and wires up all V4 search components.
 *
 * This is the ONLY file that knows about specific provider implementations.
 * SearchOrchestrator, RankingEngine, and routes depend only on interfaces.
 *
 * To add a new provider:
 *   1. Import it here.
 *   2. providerRegistry.register(new MyProvider(), tier)
 *   3. Done — zero changes to routes, orchestrator, or frontend.
 *
 * To replace ranking:
 *   Pass a different engine to SearchOrchestratorImpl.
 */

import { ProviderRegistry } from './provider-registry.js'
import { SearchOrchestratorImpl } from './search-orchestrator.js'
import { MockSearchProvider } from './providers/mock/mock.provider.js'
import { TwoGISProvider } from './providers/two-gis/provider.js'
import { V4RankingEngine } from './v4-ranking-engine.js'
import { getRedisConnection } from '@ai-sales-os/queue'

// ─── Provider registry ────────────────────────────────────────────────────────
//
// Tier 1: Directory providers — 2GIS, Mock (run immediately)
// Tier 2: Registry providers — Dadata, Госзакупки (Pass 4)
// Tier 3: Async — website scraping (Pass 5)
//
export const providerRegistry = new ProviderRegistry()
providerRegistry.register(new MockSearchProvider(), 1)
providerRegistry.register(new TwoGISProvider(), 1)  // MockTwoGISClient until useMock=false

// ─── V4 Ranking Engine ────────────────────────────────────────────────────────
//
// Uses ICP × Timing × Completeness scoring formula.
// ICPScoreCalculator, TimingScoreCalculator, CompletenessCalculator
// are constructed with defaults inside V4RankingEngine.
//
const v4RankingEngine = new V4RankingEngine()

// ─── Redis client ─────────────────────────────────────────────────────────────
//
// Reuses the singleton from packages/queue (same ioredis instance as BullMQ).
// Tier1 cache TTL: 6h. Tier2 cache TTL: 24h.
//
let redisClient: ReturnType<typeof getRedisConnection> | null = null
try {
  redisClient = getRedisConnection()
} catch {
  // Redis unavailable at startup — orchestrator runs without cache
}

// ─── Orchestrator singleton ───────────────────────────────────────────────────
//
// V4 tiered pipeline:
//   Tier1+2 parallel → DedupEngine → SignalEngine → ICP filter →
//   V4RankingEngine → CompanyRegistry → CompanyPersister (async)
//
export const searchOrchestrator = new SearchOrchestratorImpl(
  providerRegistry,
  v4RankingEngine,
  redisClient,
)
