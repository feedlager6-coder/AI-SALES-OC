export interface RetryPolicy {
  execute<T>(fn: () => Promise<T>): Promise<T>
}

/** No-op — executes exactly once, never retries. Replace when real API is active. */
export class NoRetryPolicy implements RetryPolicy {
  execute<T>(fn: () => Promise<T>): Promise<T> { return fn() }
}
