export interface RateLimiter {
  acquire(): Promise<void>
  release(): void
}

/** No-op — every request is allowed immediately. Replace when real API is active. */
export class PassthroughRateLimiter implements RateLimiter {
  acquire(): Promise<void> { return Promise.resolve() }
  release(): void { /* no-op */ }
}
