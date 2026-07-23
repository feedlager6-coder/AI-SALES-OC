/**
 * Hunt routes — REST API for the Hunt entity.
 *
 * POST   /api/v1/hunts            — create a new Hunt (draft)
 * GET    /api/v1/hunts/:id        — fetch a Hunt by ID
 * PATCH  /api/v1/hunts/:id/status — advance Hunt status
 * POST   /api/v1/hunts/:id/search — execute search for a Hunt, return SearchResult
 *
 * POST /api/v1/hunts/:id/search is the primary endpoint for the Discover flow.
 * It runs all registered SearchProviders, deduplicates, ranks, and returns the
 * result as JSON. The frontend never executes any search logic — it only
 * renders the response.
 *
 * Architecture:
 *
 *   Frontend (Discover page)
 *    ↓ POST /api/v1/hunts/:id/search
 *   Route handler (this file)
 *    ↓ searchOrchestrator.search(hunt)
 *   SearchOrchestratorImpl
 *    ↓ (sequential)
 *   SearchProviders → Merge → Dedup → RankingEngine
 *    ↓
 *   SearchResult JSON → Frontend
 *
 * All providers, deduplication, and ranking run server-side.
 * Frontend never imports providers, registry, or ranking engine.
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { huntService } from '../services/hunt.service.js'
import { searchOrchestrator } from '../search/setup.js'
import { workspaceContextPlugin } from '../plugins/workspace-context.js'
import { createLogger } from '@ai-sales-os/logger'

const logger = createLogger({ name: 'api:hunts-route' })

// ─── Validation schemas ───────────────────────────────────────────────────────

const IntentJsonSchema = z.object({
  industry:         z.string().nullable().default(null),
  region:           z.string().nullable().default(null),
  companySize:      z.string().nullable().default(null),
  clarifyingAnswer: z.string().nullable().default(null),
})

const CreateHuntBodySchema = z.object({
  rawQuery:   z.string().min(1).max(1000),
  intentJson: IntentJsonSchema.optional().default({}),
})

const UpdateStatusBodySchema = z.object({
  status: z.enum(['draft', 'confirmed', 'searching', 'completed', 'failed']),
})

// ─── Routes ───────────────────────────────────────────────────────────────────

export const huntsRoutes: FastifyPluginAsync = async (app) => {
  await app.register(workspaceContextPlugin)

  /**
   * POST /api/v1/hunts
   * Create a new Hunt in 'draft' status from the user's confirmed intent.
   */
  app.post('/', async (request, reply) => {
    const { rawQuery, intentJson } = CreateHuntBodySchema.parse(request.body)
    const { workspaceId, userId } = request

    const hunt = await huntService.createHunt({
      workspaceId,
      userId,
      rawQuery,
      intentJson: {
        industry:         intentJson.industry,
        region:           intentJson.region,
        companySize:      intentJson.companySize,
        clarifyingAnswer: intentJson.clarifyingAnswer,
      },
    })

    return reply.status(201).send({ data: hunt })
  })

  /**
   * GET /api/v1/hunts/:id
   * Fetch a Hunt by ID. Returns 404 if not found in this workspace.
   */
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { workspaceId } = request

    const hunt = await huntService.getHunt(id, workspaceId)
    if (!hunt) {
      return reply.status(404).send({
        error: { code: 'HUNT_NOT_FOUND', message: 'Hunt not found', statusCode: 404 },
      })
    }

    return reply.status(200).send({ data: hunt })
  })

  /**
   * PATCH /api/v1/hunts/:id/status
   * Advance a Hunt to the next status.
   */
  app.patch('/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { status } = UpdateStatusBodySchema.parse(request.body)
    const { workspaceId } = request

    const hunt = await huntService.updateStatus(id, workspaceId, status)
    return reply.status(200).send({ data: hunt })
  })

  /**
   * POST /api/v1/hunts/:id/search
   *
   * Execute a full search for a Hunt and return ranked results.
   *
   * This is the server-side search entry point. All business logic lives here:
   *   1. Fetch + verify Hunt ownership
   *   2. Advance status to 'searching'
   *   3. Run SearchOrchestrator (providers → merge → dedup → ranking)
   *   4. Advance status to 'completed' (or 'failed' on error)
   *   5. Return SearchResult
   *
   * The frontend receives plain JSON — it has no knowledge of providers,
   * the registry, or ranking internals.
   */
  app.post('/:id/search', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { workspaceId } = request

    // ── Step 1: Fetch and verify ownership ──────────────────────────────────
    const huntRow = await huntService.getHunt(id, workspaceId)
    if (!huntRow) {
      return reply.status(404).send({
        error: { code: 'HUNT_NOT_FOUND', message: 'Hunt not found', statusCode: 404 },
      })
    }

    // ── Step 2: Advance to 'searching' ──────────────────────────────────────
    await huntService.updateStatus(id, workspaceId, 'searching')

    // Build the SearchHunt from the DB row (intentJson is JSONB — cast safely)
    const rawIntent = (huntRow.intentJson ?? {}) as Record<string, unknown>
    const searchHunt = {
      id:       huntRow.id,
      rawQuery: huntRow.rawQuery,
      intentJson: {
        industry:         typeof rawIntent['industry']         === 'string' ? rawIntent['industry']         : null,
        region:           typeof rawIntent['region']           === 'string' ? rawIntent['region']           : null,
        companySize:      typeof rawIntent['companySize']      === 'string' ? rawIntent['companySize']      : null,
        clarifyingAnswer: typeof rawIntent['clarifyingAnswer'] === 'string' ? rawIntent['clarifyingAnswer'] : null,
      },
    }

    // ── Step 3: Run SearchOrchestrator ──────────────────────────────────────
    try {
      const result = await searchOrchestrator.search(searchHunt)

      // ── Step 4a: Advance to 'completed' ────────────────────────────────
      await huntService.updateStatus(id, workspaceId, 'completed')

      logger.info({
        event: 'hunt.search.completed',
        huntId: id,
        totalFound: result.totalFound,
      })

      return reply.status(200).send({ data: result })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)

      logger.error({
        event: 'hunt.search.failed',
        huntId: id,
        error: message,
      })

      // ── Step 4b: Advance to 'failed' ────────────────────────────────────
      await huntService.updateStatus(id, workspaceId, 'failed').catch(() => {
        // Best-effort — do not mask the original error
      })

      return reply.status(502).send({
        error: {
          code:       'SEARCH_FAILED',
          message:    'Search failed — all providers returned errors.',
          statusCode: 502,
        },
      })
    }
  })
}
