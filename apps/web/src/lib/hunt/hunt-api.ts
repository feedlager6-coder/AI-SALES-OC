/**
 * Hunt API client — the only place in the frontend that knows how to
 * create and update Hunt records on the backend.
 *
 * A Hunt is the central entity of the Discover flow. Before any search
 * provider is invoked, a Hunt is created so that every search session
 * has a stable ID and lifecycle that the backend can track.
 *
 * Flow:
 *   user confirms intent
 *     → createHunt()         → returns Hunt with id
 *     → huntService.search(hunt)
 *     → updateHuntStatus(id, 'completed' | 'failed')
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type HuntStatus = 'draft' | 'confirmed' | 'searching' | 'completed' | 'failed'

export interface HuntIntentJson {
  industry: string | null
  region: string | null
  companySize: string | null
  clarifyingAnswer: string | null
}

/** Client-side representation of a Hunt, matching the backend response. */
export interface Hunt {
  id: string
  workspaceId: string
  createdBy: string
  rawQuery: string
  intentJson: HuntIntentJson
  status: HuntStatus
  createdAt: string
  updatedAt: string
}

// ─── Request bodies ───────────────────────────────────────────────────────────

export interface CreateHuntBody {
  rawQuery: string
  intentJson: HuntIntentJson
}

// ─── API functions ────────────────────────────────────────────────────────────

const BASE = '/api/v1/hunts'

/**
 * Create a new Hunt in 'draft' status.
 * Must be called before any search provider is invoked.
 */
export async function createHunt(body: CreateHuntBody): Promise<Hunt> {
  const response = await fetch(BASE, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const message = (data as { error?: { message?: string } })?.error?.message
    throw new Error(message ?? `Failed to create Hunt (${response.status})`)
  }

  const data = (await response.json()) as { data: Hunt }
  return data.data
}

/**
 * Advance a Hunt to a new status.
 * Call with 'searching' when the search starts, then 'completed' or 'failed'.
 */
export async function updateHuntStatus(huntId: string, status: HuntStatus): Promise<Hunt> {
  const response = await fetch(`${BASE}/${huntId}/status`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const message = (data as { error?: { message?: string } })?.error?.message
    throw new Error(message ?? `Failed to update Hunt status (${response.status})`)
  }

  const data = (await response.json()) as { data: Hunt }
  return data.data
}

/**
 * Fetch a Hunt by ID.
 */
export async function getHunt(huntId: string): Promise<Hunt> {
  const response = await fetch(`${BASE}/${huntId}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const message = (data as { error?: { message?: string } })?.error?.message
    throw new Error(message ?? `Hunt not found (${response.status})`)
  }

  const data = (await response.json()) as { data: Hunt }
  return data.data
}
