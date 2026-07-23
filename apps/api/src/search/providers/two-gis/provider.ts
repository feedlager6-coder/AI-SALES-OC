/**
 * TwoGISProvider — SearchProvider implementation backed by the 2GIS Catalog API.
 *
 * Runs server-side only. API keys are never exposed to the frontend.
 * Switch from mock to real by setting useMock: false in config.ts.
 */

import type { SearchProvider, SearchHunt } from '../../search-provider.js'
import type { SearchResult, SearchParams } from '../../types.js'
import type { TwoGISConfig } from './config.js'
import type { TwoGISClient } from './client.js'
import type { RateLimiter } from './rate-limiter.js'
import type { RetryPolicy } from './retry-policy.js'
import { resolveCityId, defaultTwoGISConfig } from './config.js'
import { MockTwoGISClient } from './client.js'
import { TwoGISMapper } from './mapper.js'
import { PassthroughRateLimiter } from './rate-limiter.js'
import { NoRetryPolicy } from './retry-policy.js'

export interface TwoGISProviderDeps {
  config:      TwoGISConfig
  client:      TwoGISClient
  mapper:      TwoGISMapper
  rateLimiter: RateLimiter
  retryPolicy: RetryPolicy
}

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

    if (deps?.client) {
      this.client = deps.client
    } else if (this.config.useMock) {
      this.client = new MockTwoGISClient()
    } else {
      throw new Error(
        '[TwoGISProvider] useMock is false but no real client provided. ' +
          'Import RealTwoGISClient and pass it via deps.client.',
      )
    }
  }

  async search(hunt: SearchHunt): Promise<SearchResult> {
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

  private buildQuery(hunt: SearchHunt): string {
    const parts: string[] = []
    if (hunt.intentJson.industry)         parts.push(hunt.intentJson.industry)
    if (hunt.intentJson.clarifyingAnswer) parts.push(hunt.intentJson.clarifyingAnswer)
    return parts.length > 0 ? parts.join(' ') : hunt.rawQuery
  }

  private buildSearchParams(hunt: SearchHunt): SearchParams {
    return {
      rawQuery:         hunt.rawQuery,
      industry:         hunt.intentJson.industry,
      region:           hunt.intentJson.region,
      companySize:      hunt.intentJson.companySize,
      clarifyingAnswer: hunt.intentJson.clarifyingAnswer,
    }
  }
}
