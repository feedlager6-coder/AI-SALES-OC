/**
 * RetryPolicy — interface for retrying failed 2GIS API requests.
 *
 * The 2GIS API can return transient errors (rate limit 429, gateway 502/503).
 * A retry policy wraps a request function and re-issues it according to a
 * configured strategy (linear back-off, exponential back-off, etc.).
 *
 * This interface is prepared but not implemented yet. When real API calls
 * are enabled, plug in a concrete implementation and pass it to
 * TwoGISProvider via TwoGISProviderDeps.
 *
 * To implement:
 *   class ExponentialBackoffRetryPolicy implements RetryPolicy {
 *     async execute<T>(fn: () => Promise<T>): Promise<T> {
 *       let attempt = 0
 *       while (true) {
 *         try { return await fn() }
 *         catch (err) {
 *           if (!this.shouldRetry(err, attempt)) throw err
 *           await delay(this.backoff(attempt++))
 *         }
 *       }
 *     }
 *   }
 */

export interface RetryPolicy {
  /**
   * Execute the given async function, retrying according to policy on failure.
   *
   * @param fn      — the operation to execute (must be idempotent)
   * @returns         the result of fn on the first successful attempt
   * @throws          the last error if all retry attempts are exhausted
   */
  execute<T>(fn: () => Promise<T>): Promise<T>
}

// ─── Retry context passed to shouldRetry ─────────────────────────────────────

export interface RetryContext {
  /** 0-based attempt index (0 = first attempt, 1 = first retry, …) */
  attempt: number
  /** The error that caused the failure */
  error: unknown
}

// ─── No-op implementation (used while real API is not connected) ──────────────

/**
 * NoRetryPolicy — executes the function exactly once; never retries.
 * Replace with a real implementation when the 2GIS API key is configured.
 */
export class NoRetryPolicy implements RetryPolicy {
  execute<T>(fn: () => Promise<T>): Promise<T> {
    return fn()
  }
}
