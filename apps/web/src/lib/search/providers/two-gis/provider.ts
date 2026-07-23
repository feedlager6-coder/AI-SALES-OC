/**
 * TwoGISProvider — SearchProvider implementation backed by the 2GIS Catalog API.
 *
 * This is the only file that knows about all four integration layers:
 *   TwoGISConfig   — where to connect and how to behave
 *   TwoGISClient   — how to make HTTP requests (mock or real)
 *   TwoGISMapper   — how to translate raw API items into internal models
 *   RateLimiter    — when to slow down (prepared, not yet active)
 *   RetryPolicy    — how many times to retry on transient errors (prepared)
 *
 * SearchOrchestratorImpl calls only provider.search(hunt) — it never sees
 * any of the layers above. Replacing MockTwoGISClient with RealTwoGISClient
 * requires changing exactly one line (in hunt-service.ts, where providers
 * are instantiated), with zero impact on anything above.
 *
 * Architecture:
 *
 *   SearchOrchestrator
 *     ↓ provider.search(hunt)
 *   TwoGISProvider
 *     ↓ rateLimiter.acquire()
 *     ↓ retryPolicy.execute(...)
 *     ↓ client.search(params)     ← MockTwoGISClient or RealTwoGISClient
 *     ↓ mapper.toSearchResult()
 *     ↑ SearchResult
 */

import type { SearchProvider } from '../../search-provider'
import type { Hunt } from '../../../hunt/hunt-api'
import type { SearchResult, SearchParams } from '../../types'
import type { TwoGISConfig } from './config'
import type { TwoGISClient } from './client'
import type { RateLimiter } from './rate-limiter'
import type { RetryPolicy } from './retry-policy'
import { resolveCityId } from './config'
import { MockTwoGISClient } from './client'
import { TwoGISMapper } from './mapper'
import { PassthroughRateLimiter } from './rate-limiter'
import { NoRetryPolicy } from './retry-policy'
import { defaultTwoGISConfig } from './config'

// ─── Dependency injection container ──────────────────────────────────────────

/**
 * All injectable dependencies for TwoGISProvider.
 * Pass a full or partial override to the constructor for testing or config changes.
 */
export interface TwoGISProviderDeps {
  config:      TwoGISConfig
  client:      TwoGISClient
  mapper:      TwoGISMapper
  rateLimiter: RateLimiter
  retryPolicy: RetryPolicy
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class TwoGISProvider implements SearchProvider {
  readonly providerId   = '2gis'
  readonly providerName = '2GIS'

  private readonly config:      TwoGISConfig
  private readonly client:      TwoGISClient
  private readonly mapper:      TwoGISMapper
  private readonly rateLimiter: RateLimiter
  private readonly retryPolicy: RetryPolicy

  constructor(deps?: Partial<TwoGISProviderDeps>) {
    this.config      = deps?.config      ?? defaultTwoGISConfig
    this.mapper      = deps?.mapper      ?? new TwoGISMapper()
    this.rateLimiter = deps?.rateLimiter ?? new PassthroughRateLimiter()
    this.retryPolicy = deps?.retryPolicy ?? new NoRetryPolicy()

    // Client selection: mock when useMock is true, real otherwise.
    // Passing deps.client explicitly always wins (e.g. in tests).
    if (deps?.client) {
      this.client = deps.client
    } else if (this.config.useMock) {
      this.client = new MockTwoGISClient()
    } else {
      // RealTwoGISClient is imported lazily to keep the mock path lean.
      // When real HTTP is needed, import and instantiate here.
      throw new Error(
        '[TwoGISProvider] useMock is false but no real client is provided. ' +
          'Import RealTwoGISClient from ./client and pass it via deps.client.',
      )
    }
  }

  async search(hunt: Hunt): Promise<SearchResult> {
    const query = this.buildSearchParams(hunt)

    await this.rateLimiter.acquire()

    try {
      const cityId   = resolveCityId(hunt.intentJson.region)
      const response = await this.retryPolicy.execute(() =>
        this.client.search({
          q:         this.buildQuery(hunt),
          ...(cityId !== undefined ? { city_id: cityId } : {}),
          type:      'branch',
          fields:    this.config.fields,
          page_size: this.config.defaultPageSize,
          page:      this.config.defaultPage,
          key:       this.config.apiKey,
        }),
      )

      return this.mapper.toSearchResult(response, query)
    } finally {
      this.rateLimiter.release()
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Build the `q` string for the 2GIS API from the hunt's intent fields.
   * Combines industry + any free-text clarification from the user.
   */
  private buildQuery(hunt: Hunt): string {
    const parts: string[] = []

    if (hunt.intentJson.industry) {
      parts.push(hunt.intentJson.industry)
    }

    if (hunt.intentJson.clarifyingAnswer) {
      parts.push(hunt.intentJson.clarifyingAnswer)
    }

    // Fallback: use the raw query if no structured intent was extracted
    return parts.length > 0 ? parts.join(' ') : hunt.rawQuery
  }

  /**
   * Build the SearchParams for SearchResult.query (UI display).
   */
  private buildSearchParams(hunt: Hunt): SearchParams {
    return {
      rawQuery:         hunt.rawQuery,
      industry:         hunt.intentJson.industry,
      region:           hunt.intentJson.region,
      companySize:      hunt.intentJson.companySize,
      clarifyingAnswer: hunt.intentJson.clarifyingAnswer,
    }
  }
}
