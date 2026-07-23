/**
 * RateLimiter — interface for throttling outbound requests to the 2GIS API.
 *
 * The 2GIS Catalog API enforces per-key rate limits:
 *   • Free tier:     ~1 req/s,  50 req/day
 *   • Paid tiers:   up to 50 req/s, no daily cap
 *
 * This interface is prepared but not implemented yet. When real API calls
 * are enabled, plug in a concrete implementation (token bucket or leaky
 * bucket) and pass it to TwoGISProvider via TwoGISProviderDeps.
 *
 * To implement:
 *   class TokenBucketRateLimiter implements RateLimiter {
 *     async acquire(): Promise<void> {
 *       // wait until a token is available
 *     }
 *     release(): void {
 *       // return the token if unused
 *     }
 *   }
 */

export interface RateLimiter {
  /**
   * Called before each outbound request.
   * Implementations should block (await) until the request is allowed.
   * Resolves immediately if no throttling is needed.
   */
  acquire(): Promise<void>

  /**
   * Called after a request completes (success or error).
   * Allows the limiter to update its internal state.
   */
  release(): void
}

// ─── No-op implementation (used while real API is not connected) ──────────────

/**
 * PassthroughRateLimiter — does nothing; every request is allowed immediately.
 * Replace with a real implementation when the 2GIS API key is configured.
 */
export class PassthroughRateLimiter implements RateLimiter {
  acquire(): Promise<void> {
    return Promise.resolve()
  }

  release(): void {
    // no-op
  }
}
