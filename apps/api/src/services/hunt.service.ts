/**
 * HuntService — business logic for the Hunt entity.
 *
 * A Hunt is created for every user search request before the actual
 * search providers are invoked. This gives us a stable audit trail and
 * a lifecycle hook for future async enrichment workers.
 *
 * Status machine:
 *   draft → confirmed → searching → completed
 *                    ↘               ↗
 *                      → failed ────
 *
 * To integrate real search providers in the future:
 *   1. Update the status to 'searching' before dispatching jobs.
 *   2. Resolve to 'completed' / 'failed' when the job settles.
 *   3. Attach result metadata to intentJson or a separate results table.
 */

import { eq, and } from 'drizzle-orm'
import { getDb, hunts } from '@ai-sales-os/db'
import { createLogger } from '@ai-sales-os/logger'
import type { HuntStatus } from '@ai-sales-os/types'

const logger = createLogger({ name: 'api:hunt-service' })

// ─── Input types ──────────────────────────────────────────────────────────────

export interface IntentJson {
  industry: string | null
  region: string | null
  companySize: string | null
  clarifyingAnswer: string | null
}

export interface CreateHuntInput {
  workspaceId: string
  userId: string
  rawQuery: string
  intentJson: IntentJson
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class HuntService {
  /**
   * Persist a new Hunt in 'draft' status.
   * Called immediately after the user confirms their intent.
   */
  async createHunt(input: CreateHuntInput) {
    const db = getDb()

    const [hunt] = await db
      .insert(hunts)
      .values({
        workspaceId: input.workspaceId,
        createdBy: input.userId,
        rawQuery: input.rawQuery,
        intentJson: input.intentJson,
        status: 'draft',
      })
      .returning()

    if (!hunt) {
      throw new Error('Failed to create Hunt — insert returned no rows')
    }

    logger.info({
      event: 'hunt.created',
      huntId: hunt.id,
      workspaceId: hunt.workspaceId,
      status: hunt.status,
    })

    return hunt
  }

  /**
   * Fetch a single Hunt by ID, scoped to a workspace.
   * Returns null when not found (caller decides whether to 404).
   */
  async getHunt(huntId: string, workspaceId: string) {
    const db = getDb()

    const [hunt] = await db
      .select()
      .from(hunts)
      .where(and(eq(hunts.id, huntId), eq(hunts.workspaceId, workspaceId)))
      .limit(1)

    return hunt ?? null
  }

  /**
   * Advance the Hunt to a new status.
   * Only allowed transitions are enforced at the DB level via the enum;
   * business-level transition guards can be added here as needed.
   */
  async updateStatus(huntId: string, workspaceId: string, status: HuntStatus) {
    const db = getDb()

    const [updated] = await db
      .update(hunts)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(hunts.id, huntId), eq(hunts.workspaceId, workspaceId)))
      .returning()

    if (!updated) {
      throw new Error(`Hunt ${huntId} not found in workspace ${workspaceId}`)
    }

    logger.info({
      event: 'hunt.status_updated',
      huntId: updated.id,
      status: updated.status,
    })

    return updated
  }
}

// ─── Default singleton ────────────────────────────────────────────────────────
//
// To inject a test double, instantiate HuntService directly in your test.
//
export const huntService = new HuntService()
