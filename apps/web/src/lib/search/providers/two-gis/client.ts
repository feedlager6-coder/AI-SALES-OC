/**
 * TwoGISClient — interface and implementations for the 2GIS HTTP layer.
 *
 * TwoGISProvider depends on this interface, not on any concrete HTTP client.
 * This means:
 *   • Tests inject MockTwoGISClient — fast, no network, deterministic.
 *   • Development uses MockTwoGISClient — no API key required.
 *   • Production will use RealTwoGISClient — just swap in TwoGISProviderDeps.
 *
 * To connect the real API:
 *   1. Set NEXT_PUBLIC_TWOGIS_API_KEY in the environment.
 *   2. Set defaultTwoGISConfig.useMock = false (config.ts).
 *   3. No changes to TwoGISMapper, TwoGISProvider, or any caller.
 */

import type { TwoGISApiResponse, TwoGISSearchParams } from './types'
import { getMockResponse } from './mock-fixtures'

// ─── Interface ────────────────────────────────────────────────────────────────

export interface TwoGISClient {
  /**
   * Execute a search against the 2GIS Catalog API (real or mock).
   * @throws {TwoGISClientError} on network failure, non-200 status, or malformed response.
   */
  search(params: TwoGISSearchParams): Promise<TwoGISApiResponse>
}

// ─── Error type ───────────────────────────────────────────────────────────────

export class TwoGISClientError extends Error {
  constructor(
    message: string,
    /** HTTP status code, or 0 for network errors */
    public readonly statusCode: number = 0,
    /** Raw response body (when available) */
    public readonly responseBody?: string,
  ) {
    super(message)
    this.name = 'TwoGISClientError'
  }
}

// ─── Mock implementation ──────────────────────────────────────────────────────

/**
 * MockTwoGISClient — returns pre-built fixtures that mirror the real 2GIS API.
 *
 * Simulates ~300ms of network latency so the UI behaves identically to
 * real API calls. The fixture selection logic is in mock-fixtures.ts.
 *
 * Replace with RealTwoGISClient when the API key is ready.
 */
export class MockTwoGISClient implements TwoGISClient {
  /** Simulated network round-trip time (ms). */
  private readonly latencyMs: number

  constructor(latencyMs = 300) {
    this.latencyMs = latencyMs
  }

  async search(params: TwoGISSearchParams): Promise<TwoGISApiResponse> {
    // Simulate network latency
    await new Promise<void>((resolve) => setTimeout(resolve, this.latencyMs))

    const response = getMockResponse(params.q, params.city_id)

    // Apply pagination to the mock response
    const pageSize = params.page_size ?? 20
    const page     = params.page ?? 1
    const start    = (page - 1) * pageSize
    const slice    = response.result.items.slice(start, start + pageSize)

    return {
      meta:   response.meta,
      result: { total: response.result.total, items: slice },
    }
  }
}

// ─── Real implementation (stub) ───────────────────────────────────────────────

/**
 * RealTwoGISClient — HTTP client for the production 2GIS Catalog API.
 *
 * Currently a stub that throws a clear error. Implement the fetch block
 * below when the API key is available.
 *
 * Steps to activate:
 *   1. Add NEXT_PUBLIC_TWOGIS_API_KEY to environment secrets.
 *   2. Set defaultTwoGISConfig.useMock = false in config.ts.
 *   3. Move this client to the API server (apps/api) if rate-limiting or
 *      secret protection is needed — fetch from a server action instead.
 */
export class RealTwoGISClient implements TwoGISClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  async search(params: TwoGISSearchParams): Promise<TwoGISApiResponse> {
    const url = new URL(this.baseUrl)
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v))
    })

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    let response: Response
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
    } catch (err: unknown) {
      throw new TwoGISClientError(
        `2GIS request failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      clearTimeout(timer)
    }

    const body = await response.text()

    if (!response.ok) {
      throw new TwoGISClientError(
        `2GIS API returned ${response.status}`,
        response.status,
        body,
      )
    }

    try {
      return JSON.parse(body) as TwoGISApiResponse
    } catch {
      throw new TwoGISClientError(
        '2GIS API returned non-JSON response',
        response.status,
        body,
      )
    }
  }
}
