/**
 * Intent API client — the only place in the frontend that knows how
 * intent parsing works.
 *
 * Current strategy: uses the local mock parser (no network, no backend required).
 * The mock covers industry, region, company size and clarifying questions.
 *
 * To switch to the real AI backend when it's ready:
 *   1. Uncomment the fetch block below.
 *   2. Delete (or keep as fallback) the parseIntentMock call.
 *   Zero UI changes required — Discover page only sees ParsedIntent.
 */

import type { ParsedIntent } from './types'
import { parseIntentMock } from './parse-intent-mock'

export async function parseIntent(query: string): Promise<ParsedIntent> {
  // ── Local mock (no backend needed) ────────────────────────────────────────
  return parseIntentMock(query)

  // ── Real backend (uncomment when API server + DB are running) ─────────────
  // const response = await fetch('/api/v1/intent/parse', {
  //   method: 'POST',
  //   credentials: 'include',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ query }),
  // })
  // if (!response.ok) {
  //   const data = await response.json().catch(() => ({}))
  //   const message = (data as { error?: { message?: string } })?.error?.message
  //   throw new Error(message ?? `Intent parse failed (${response.status})`)
  // }
  // return response.json() as Promise<ParsedIntent>
}
