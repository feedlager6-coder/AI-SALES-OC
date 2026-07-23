/**
 * ProviderRegistry — central register of all active SearchProviders.
 *
 * V4 addition: providers carry a tier (1 | 2 | 3) used by SearchPlanBuilder
 * and the orchestrator to schedule concurrent execution.
 *
 *   Tier 1 — Directory providers: 2GIS, HH.ru
 *             Run immediately when a search starts.
 *   Tier 2 — Registry providers: Dadata, Госзакупки, ФССП
 *             Run concurrently with Tier 1 (slower, higher data quality).
 *   Tier 3 — Async providers: website scraping
 *             Run after the HTTP response is returned.
 *
 * Registration order within a tier determines deduplication priority
 * (first registered wins when the same company appears in multiple results).
 */

import type { SearchProvider } from './search-provider.js'

export type ProviderTier = 1 | 2 | 3

export interface RegisteredProvider {
  provider: SearchProvider
  tier:     ProviderTier
}

export class ProviderRegistry {
  private readonly entries: RegisteredProvider[] = []

  /**
   * Register a provider.
   * Duplicate providerId registrations are rejected at runtime so
   * configuration mistakes surface immediately at startup.
   *
   * @param provider The SearchProvider implementation.
   * @param tier     Execution tier (default: 1 — Tier 1 directory provider).
   */
  register(provider: SearchProvider, tier: ProviderTier = 1): void {
    const existing = this.entries.find((e) => e.provider.providerId === provider.providerId)
    if (existing) {
      throw new Error(
        `[ProviderRegistry] Provider "${provider.providerId}" is already registered. ` +
          'Each provider must have a unique providerId.',
      )
    }
    this.entries.push({ provider, tier })
  }

  /**
   * Returns all registered providers in registration order.
   * The array is a copy — mutations do not affect the registry.
   */
  getAll(): SearchProvider[] {
    return this.entries.map((e) => e.provider)
  }

  /**
   * Returns providers for a specific tier in registration order.
   */
  getByTier(tier: ProviderTier): SearchProvider[] {
    return this.entries.filter((e) => e.tier === tier).map((e) => e.provider)
  }

  /**
   * Returns all registered entries (provider + tier) for use by SearchPlanBuilder.
   */
  getAllEntries(): RegisteredProvider[] {
    return [...this.entries]
  }

  get size(): number {
    return this.entries.length
  }
}
