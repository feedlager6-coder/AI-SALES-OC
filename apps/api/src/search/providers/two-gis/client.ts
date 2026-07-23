/**
 * TwoGISClient — interface and implementations for the 2GIS HTTP layer.
 *
 * TwoGISProvider depends on this interface, not on any concrete HTTP client.
 * Tests inject MockTwoGISClient; production will use RealTwoGISClient.
 */

import type { TwoGISApiResponse, TwoGISSearchParams } from './types.js'
import { getMockResponse } from './mock-fixtures.js'

export interface TwoGISClient {
  search(params: TwoGISSearchParams): Promise<TwoGISApiResponse>
}

export class TwoGISClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 0,
    public readonly responseBody?: string,
  ) {
    super(message)
    this.name = 'TwoGISClientError'
  }
}

/** Simulates ~300ms network latency; returns pre-built fixtures. */
export class MockTwoGISClient implements TwoGISClient {
  constructor(private readonly latencyMs = 300) {}

  async search(params: TwoGISSearchParams): Promise<TwoGISApiResponse> {
    await new Promise<void>((resolve) => setTimeout(resolve, this.latencyMs))
    const response = getMockResponse(params.q, params.city_id)
    const pageSize = params.page_size ?? 20
    const page     = params.page ?? 1
    const start    = (page - 1) * pageSize
    const slice    = response.result.items.slice(start, start + pageSize)
    return { meta: response.meta, result: { total: response.result.total, items: slice } }
  }
}

/** Real HTTP client for the 2GIS Catalog API. Activate by setting useMock: false. */
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
      throw new TwoGISClientError(`2GIS API returned ${response.status}`, response.status, body)
    }

    try {
      return JSON.parse(body) as TwoGISApiResponse
    } catch {
      throw new TwoGISClientError('2GIS API returned non-JSON response', response.status, body)
    }
  }
}
