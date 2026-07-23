/**
 * Hunt routes — REST API for the Hunt entity.
 *
 * POST   /api/v1/hunts            — create a new Hunt (draft)
 * GET    /api/v1/hunts/:id        — fetch a Hunt by ID
 * PATCH  /api/v1/hunts/:id/status — advance Hunt status
 *
 * All routes require an authenticated workspace session (via
 * workspaceContextPlugin). The workspaceId is taken from the session,
 * not from the request body, to prevent cross-workspace access.
 *
 * How to add a real search provider:
 *   1. Implement SearchProvider interface in apps/workers or a plugin.
 *   2. On PATCH status → 'confirmed', dispatch a BullMQ job with the huntId.
 *   3. The worker fetches the Hunt, runs the provider, and calls updateStatus.
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { huntService } from '../services/hunt.service.js'
import { workspaceContextPlugin } from '../plugins/workspace-context.js'

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
  // All Hunt routes require workspace context
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
   * Used by the frontend after initiating search, and by workers on completion.
   */
  app.patch('/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { status } = UpdateStatusBodySchema.parse(request.body)
    const { workspaceId } = request

    const hunt = await huntService.updateStatus(id, workspaceId, status)
    return reply.status(200).send({ data: hunt })
  })
}
