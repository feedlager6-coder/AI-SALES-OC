/**
 * Sequences API
 * Manages email sequences (multi-step outreach flows) within campaigns.
 *
 * GET    /api/sequences
 * POST   /api/sequences
 * GET    /api/sequences/:id
 * PATCH  /api/sequences/:id
 * DELETE /api/sequences/:id
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, eq, desc, count } from 'drizzle-orm'
import { getDb, sequences, campaigns } from '@ai-sales-os/db'
import { workspaceContextPlugin } from '../plugins/workspace-context.js'
import { NotFoundError, BadRequestError } from '@ai-sales-os/errors'
import { createLogger } from '@ai-sales-os/logger'

const logger = createLogger({ name: 'api:sequences' })

// ─── Schemas ──────────────────────────────────────────────────────────────────

const SequenceStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  type: z.enum(['email', 'wait']),
  // For type=email
  subject: z.string().max(500).optional(),
  bodyHtml: z.string().optional(),
  bodyText: z.string().optional(),
  // For type=wait
  delayDays: z.number().int().min(0).max(365).optional(),
  delayHours: z.number().int().min(0).max(23).optional(),
  // Conditions
  stopOnReply: z.boolean().default(true),
  stopOnClick: z.boolean().default(false),
})

const CreateSequenceSchema = z.object({
  name: z.string().min(1).max(255),
  campaignId: z.string().uuid(),
  steps: z.array(SequenceStepSchema).min(1).max(20),
})

const UpdateSequenceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  steps: z.array(SequenceStepSchema).min(1).max(20).optional(),
})

const ListSequencesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  campaignId: z.string().uuid().optional(),
})

// ─── Routes ───────────────────────────────────────────────────────────────────

export const sequencesRoutes: FastifyPluginAsync = async (app) => {
  await app.register(workspaceContextPlugin)

  /** GET /api/sequences — list sequences (optionally filtered by campaign) */
  app.get('/', async (request, reply) => {
    const query = ListSequencesSchema.parse(request.query)
    const db = getDb()

    const conditions = [eq(sequences.workspaceId, request.workspaceId)]
    if (query.campaignId) {
      conditions.push(eq(sequences.campaignId, query.campaignId))
    }

    const offset = (query.page - 1) * query.limit

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(sequences)
        .where(and(...conditions))
        .orderBy(desc(sequences.createdAt))
        .limit(query.limit)
        .offset(offset),
      db.select({ total: count() }).from(sequences).where(and(...conditions)),
    ])

    return reply.send({
      data: rows,
      meta: {
        total: Number(total),
        page: query.page,
        limit: query.limit,
        hasNextPage: offset + rows.length < Number(total),
      },
    })
  })

  /** POST /api/sequences — create sequence */
  app.post('/', async (request, reply) => {
    const body = CreateSequenceSchema.parse(request.body)
    const db = getDb()

    // Verify campaign belongs to workspace
    const campaign = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, body.campaignId),
        eq(campaigns.workspaceId, request.workspaceId),
      ),
    })
    if (!campaign) throw new NotFoundError('Campaign not found')

    if (campaign.status === 'completed' || campaign.status === 'archived') {
      throw new BadRequestError('Cannot add a sequence to a completed or archived campaign')
    }

    // Validate step numbers are unique and sequential
    const stepNumbers = body.steps.map((s) => s.stepNumber)
    const uniqueStepNumbers = new Set(stepNumbers)
    if (uniqueStepNumbers.size !== stepNumbers.length) {
      throw new BadRequestError('Sequence steps must have unique step numbers')
    }

    const [sequence] = await db
      .insert(sequences)
      .values({
        workspaceId: request.workspaceId,
        campaignId: body.campaignId,
        name: body.name,
        steps: body.steps,
      })
      .returning()

    logger.info({
      event: 'sequence.created',
      sequenceId: sequence.id,
      campaignId: body.campaignId,
      stepCount: body.steps.length,
      workspaceId: request.workspaceId,
    })

    return reply.status(201).send({ data: sequence })
  })

  /** GET /api/sequences/:id — single sequence */
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = getDb()

    const sequence = await db.query.sequences.findFirst({
      where: and(
        eq(sequences.id, id),
        eq(sequences.workspaceId, request.workspaceId),
      ),
    })
    if (!sequence) throw new NotFoundError('Sequence not found')

    return reply.send({ data: sequence })
  })

  /** PATCH /api/sequences/:id — update sequence name and/or steps */
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateSequenceSchema.parse(request.body)
    const db = getDb()

    const existing = await db.query.sequences.findFirst({
      where: and(
        eq(sequences.id, id),
        eq(sequences.workspaceId, request.workspaceId),
      ),
    })
    if (!existing) throw new NotFoundError('Sequence not found')

    if (body.steps) {
      // Validate step numbers
      const stepNumbers = body.steps.map((s) => s.stepNumber)
      const uniqueStepNumbers = new Set(stepNumbers)
      if (uniqueStepNumbers.size !== stepNumbers.length) {
        throw new BadRequestError('Sequence steps must have unique step numbers')
      }
    }

    const [updated] = await db
      .update(sequences)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.steps !== undefined ? { steps: body.steps } : {}),
        updatedAt: new Date(),
      })
      .where(eq(sequences.id, id))
      .returning()

    logger.info({ event: 'sequence.updated', sequenceId: id, workspaceId: request.workspaceId })
    return reply.send({ data: updated })
  })

  /** DELETE /api/sequences/:id — delete sequence */
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = getDb()

    const existing = await db.query.sequences.findFirst({
      where: and(
        eq(sequences.id, id),
        eq(sequences.workspaceId, request.workspaceId),
      ),
    })
    if (!existing) throw new NotFoundError('Sequence not found')

    await db.delete(sequences).where(eq(sequences.id, id))

    logger.info({ event: 'sequence.deleted', sequenceId: id, workspaceId: request.workspaceId })
    return reply.status(204).send()
  })
}
