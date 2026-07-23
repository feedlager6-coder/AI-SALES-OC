/**
 * ProviderRegistry — central register of all active SearchProviders.
 *
 * Providers are registered once at startup (in setup.ts) and queried by
 * SearchOrchestratorImpl when a Hunt is executed. The registry is the
 * single place to add or remove data sources — no other file changes needed.
 *
 * Registration order determines deduplication priority: companies from
 * providers registered first win when the same company appears in multiple
 * results.
 */

import type { SearchProvider } from './search-provider.js'

export class ProviderRegistry {
  private readonly providers: SearchProvider[] = []

  /**
   * Register a provider. Duplicate providerId registrations are rejected
   * at runtime so configuration mistakes surface immediately.
   */
  register(provider: SearchProvider): void {
    const existing = this.providers.find((p) => p.providerId === provider.providerId)
    if (existing) {
      throw new Error(
        `[ProviderRegistry] Provider "${provider.providerId}" is already registered. ` +
          'Each provider must have a unique providerId.',
      )
    }
    this.providers.push(provider)
  }

  /**
   * Returns a snapshot of all registered providers in registration order.
   * The array is a copy — mutations do not affect the registry.
   */
  getAll(): SearchProvider[] {
    return [...this.providers]
  }

  get size(): number {
    return this.providers.length
  }
}
