/**
 * TwoGIS provider — public API surface.
 *
 * Import only from this barrel file. Internal modules (mapper, client, fixtures)
 * are implementation details and should not be imported directly by other layers.
 *
 * Usage:
 *   import { TwoGISProvider } from '@/lib/search/providers/two-gis'
 *   providerRegistry.register(new TwoGISProvider())
 */

export { TwoGISProvider } from './provider'
export type { TwoGISProviderDeps } from './provider'

export { TwoGISMapper } from './mapper'
export { MockTwoGISClient, RealTwoGISClient, TwoGISClientError } from './client'
export type { TwoGISClient } from './client'

export { defaultTwoGISConfig, resolveCityId, TWOGIS_CITY_IDS } from './config'
export type { TwoGISConfig } from './config'

export { PassthroughRateLimiter } from './rate-limiter'
export type { RateLimiter } from './rate-limiter'

export { NoRetryPolicy } from './retry-policy'
export type { RetryPolicy } from './retry-policy'

export type {
  TwoGISApiResponse,
  TwoGISItem,
  TwoGISSearchParams,
  TwoGISOrg,
  TwoGISRubric,
} from './types'
