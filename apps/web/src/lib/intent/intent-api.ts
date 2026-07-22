/**
 * Intent API client — the only place in the frontend that knows how
 * intent parsing works: it calls the backend.
 *
 * Discover page imports parseIntent() and receives ParsedIntent.
 * It does not know whether the backend uses rules or AI.
 */

import type { ParsedIntent } from './types'

export async function parseIntent(query: string): Promise<ParsedIntent> {
  const response = await fetch('/api/v1/intent/parse', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const message = (data as { error?: { message?: string } })?.error?.message
    throw new Error(message ?? `Intent parse failed (${response.status})`)
  }

  return response.json() as Promise<ParsedIntent>
}
