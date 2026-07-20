/**
 * Campaigns API
 * Manages outreach campaigns: create, read, update, lifecycle (start/pause/stop).
 *
 * GET    /api/campaigns
 * POST   /api/campaigns
 * GET    /api/campaigns/:id
 * PATCH  /api/campaigns/:id
 * DELETE /api/campaigns/:id
 * POST   /api/campaigns/:id/start
 * POST   /api/campaigns/:id/pause
 * POST   /api/campaigns/:id/stop
 * GET    /api/campaigns/:id/enrollments
 * POST   /api/campaigns/:id/enroll
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, eq, desc, count, inArray, sql } from 'drizzle-orm'
import {
  getDb,
  campaigns,
  companies,
  sequences,
  sequenceEnrollments,
} from '@ai-sales-os/db'
import { workspaceContextPlugin } from '../plugins/workspace-context.js'
import { NotFoundError, BadRequestError } from '@ai-sales-os/errors'
import { createLogger } from '@ai-sales-os/logger'

const logger = createLogger({ name: 'api:campaigns' })

// ─── Schemas ──────────────────────────────────────────────────────────────────

const SendingSettingsSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
  time_from: z.string().regex(/^\d{2}:\d{2}$/).default('09:00'),
  time_to: z.string().regex(/^\d{2}:\d{2}$/).default('18:00'),
  timezone: z.string().default('Europe/Moscow'),
  daily_limit: z.number().int().min(1).max(2000).default(100),
})

const IcpFilterSchema = z.object({
  icpMin: z.number().int().min(0).max(100).optional(),
  icpMax: z.number().int().min(0).max(100).optional(),
  cities: z.array(z.string()).optional(),
  industries: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
})

const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  vertical: z.string().max(100).optional(),
  icpFilter: IcpFilterSchema.default({}),
  sendingSettings: SendingSettingsSchema.default({}),
})

const UpdateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  vertical: z.string().max(100).optional(),
  icpFilter: IcpFilterSchema.optional(),
  sendingSettings: SendingSettingsSchema.optional(),
})

const ListCampaignsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']).optional(),
})

const EnrollSchema = z.object({
  companyIds: z.array(z.string().uuid()).min(1).max(500),
  sequenceId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
})

// ─── Routes ───────────────────────────────────────────────────────────────────

export const campaignsRoutes: FastifyPluginAsync = async (app) => {
  await app.register(workspaceContextPlugin)

  /** GET /api/campaigns — list campaigns */
  app.get('/', async (request, reply) => {
    const query = ListCampaignsSchema.parse(request.query)
    const db = getDb()

    const conditions = [eq(campaigns.workspaceId, request.workspaceId)]
    if (query.status) {
      conditions.push(eq(campaigns.status, query.status))
    }

    const offset = (query.page - 1) * query.limit

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(campaigns)
        .where(and(...conditions))
        .orderBy(desc(campaigns.createdAt))
        .limit(query.limit)
        .offset(offset),
      db.select({ total: count() }).from(campaigns).where(and(...conditions)),
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

  /** POST /api/campaigns — create campaign */
  app.post('/', async (request, reply) => {
    const body = CreateCampaignSchema.parse(request.body)
    const db = getDb()

    const [campaign] = await db
      .insert(campaigns)
      .values({
        workspaceId: request.workspaceId,
        createdBy: request.userId,
        name: body.name,
        icpFilter: body.icpFilter,
        sendingSettings: body.sendingSettings,
        ...(body.vertical ? { vertical: body.vertical } : {}),
      })
      .returning()

    logger.info({ event: 'campaign.created', campaignId: campaign.id, workspaceId: request.workspaceId })
    return reply.status(201).send({ data: campaign })
  })

  /** GET /api/campaigns/:id — single campaign */
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = getDb()

    const campaign = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, id),
        eq(campaigns.workspaceId, request.workspaceId),
      ),
    })
    if (!campaign) throw new NotFoundError('Campaign not found')

    // Load associated sequences
    const seqs = await db
      .select()
      .from(sequences)
      .where(and(
        eq(sequences.campaignId, id),
        eq(sequences.workspaceId, request.workspaceId),
      ))

    return reply.send({ data: { ...campaign, sequences: seqs } })
  })

  /** PATCH /api/campaigns/:id — update campaign */
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateCampaignSchema.parse(request.body)
    const db = getDb()

    const existing = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, id),
        eq(campaigns.workspaceId, request.workspaceId),
      ),
    })
    if (!existing) throw new NotFoundError('Campaign not found')

    if (existing.status === 'completed' || existing.status === 'archived') {
      throw new BadRequestError('Cannot update a completed or archived campaign')
    }

    const [updated] = await db
      .update(campaigns)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.vertical !== undefined ? { vertical: body.vertical } : {}),
        ...(body.icpFilter !== undefined ? { icpFilter: body.icpFilter } : {}),
        ...(body.sendingSettings !== undefined ? { sendingSettings: body.sendingSettings } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(campaigns.id, id), eq(campaigns.workspaceId, request.workspaceId)))
      .returning()

    return reply.send({ data: updated })
  })

  /** DELETE /api/campaigns/:id — soft-archive campaign */
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = getDb()

    const existing = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, id),
        eq(campaigns.workspaceId, request.workspaceId),
      ),
    })
    if (!existing) throw new NotFoundError('Campaign not found')

    if (existing.status === 'active') {
      throw new BadRequestError('Pause the campaign before deleting it')
    }

    await db
      .update(campaigns)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(and(eq(campaigns.id, id), eq(campaigns.workspaceId, request.workspaceId)))

    logger.info({ event: 'campaign.archived', campaignId: id, workspaceId: request.workspaceId })
    return reply.status(204).send()
  })

  /** POST /api/campaigns/:id/start — activate campaign */
  app.post('/:id/start', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = getDb()

    const campaign = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, id),
        eq(campaigns.workspaceId, request.workspaceId),
      ),
    })
    if (!campaign) throw new NotFoundError('Campaign not found')

    if (campaign.status === 'active') {
      return reply.send({ data: campaign })
    }

    if (campaign.status === 'completed' || campaign.status === 'archived') {
      throw new BadRequestError('Cannot start a completed or archived campaign')
    }

    const [updated] = await db
      .update(campaigns)
      .set({
        status: 'active',
        startedAt: campaign.startedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(campaigns.id, id), eq(campaigns.workspaceId, request.workspaceId)))
      .returning()

    logger.info({ event: 'campaign.started', campaignId: id, workspaceId: request.workspaceId })
    return reply.send({ data: updated })
  })

  /** POST /api/campaigns/:id/pause — pause active campaign */
  app.post('/:id/pause', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = getDb()

    const campaign = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, id),
        eq(campaigns.workspaceId, request.workspaceId),
      ),
    })
    if (!campaign) throw new NotFoundError('Campaign not found')

    if (campaign.status !== 'active') {
      throw new BadRequestError('Campaign is not active')
    }

    const [updated] = await db
      .update(campaigns)
      .set({ status: 'paused', updatedAt: new Date() })
      .where(and(eq(campaigns.id, id), eq(campaigns.workspaceId, request.workspaceId)))
      .returning()

    logger.info({ event: 'campaign.paused', campaignId: id, workspaceId: request.workspaceId })
    return reply.send({ data: updated })
  })

  /** POST /api/campaigns/:id/stop — complete and end campaign */
  app.post('/:id/stop', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = getDb()

    const campaign = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, id),
        eq(campaigns.workspaceId, request.workspaceId),
      ),
    })
    if (!campaign) throw new NotFoundError('Campaign not found')

    if (campaign.status === 'completed' || campaign.status === 'archived') {
      throw new BadRequestError('Campaign is already finished')
    }

    const [updated] = await db
      .update(campaigns)
      .set({ status: 'completed', endedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(campaigns.id, id), eq(campaigns.workspaceId, request.workspaceId)))
      .returning()

    logger.info({ event: 'campaign.stopped', campaignId: id, workspaceId: request.workspaceId })
    return reply.send({ data: updated })
  })

  /** GET /api/campaigns/:id/enrollments — list enrollments for a campaign */
  app.get('/:id/enrollments', async (request, reply) => {
    const { id } = request.params as { id: string }
    const query = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      status: z.enum(['active', 'paused', 'completed', 'replied', 'unsubscribed', 'bounced', 'stopped']).optional(),
    }).parse(request.query)

    const db = getDb()

    // Verify campaign belongs to workspace
    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, id), eq(campaigns.workspaceId, request.workspaceId)),
    })
    if (!campaign) throw new NotFoundError('Campaign not found')

    // Find all sequences for this campaign
    const seqs = await db
      .select({ id: sequences.id })
      .from(sequences)
      .where(eq(sequences.campaignId, id))

    if (seqs.length === 0) {
      return reply.send({ data: [], meta: { total: 0, page: query.page, limit: query.limit, hasNextPage: false } })
    }

    const seqIds = seqs.map((s) => s.id)

    const conditions = [
      inArray(sequenceEnrollments.sequenceId, seqIds),
      eq(sequenceEnrollments.workspaceId, request.workspaceId),
    ]
    if (query.status) {
      conditions.push(eq(sequenceEnrollments.status, query.status))
    }

    const offset = (query.page - 1) * query.limit

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: sequenceEnrollments.id,
          workspaceId: sequenceEnrollments.workspaceId,
          sequenceId: sequenceEnrollments.sequenceId,
          companyId: sequenceEnrollments.companyId,
          companyName: companies.name,
          contactId: sequenceEnrollments.contactId,
          status: sequenceEnrollments.status,
          currentStep: sequenceEnrollments.currentStep,
          enrolledAt: sequenceEnrollments.enrolledAt,
          completedAt: sequenceEnrollments.completedAt,
          replyAt: sequenceEnrollments.replyAt,
          replyClassification: sequenceEnrollments.replyClassification,
        })
        .from(sequenceEnrollments)
        .leftJoin(companies, eq(sequenceEnrollments.companyId, companies.id))
        .where(and(...conditions))
        .orderBy(desc(sequenceEnrollments.enrolledAt))
        .limit(query.limit)
        .offset(offset),
      db.select({ total: count() }).from(sequenceEnrollments).where(and(...conditions)),
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

  /** POST /api/campaigns/:id/enroll — enroll companies into a campaign sequence */
  app.post('/:id/enroll', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = EnrollSchema.parse(request.body)
    const db = getDb()

    // Validate campaign
    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, id), eq(campaigns.workspaceId, request.workspaceId)),
    })
    if (!campaign) throw new NotFoundError('Campaign not found')
    if (campaign.status === 'completed' || campaign.status === 'archived') {
      throw new BadRequestError('Cannot enroll into a completed or archived campaign')
    }

    // Validate sequence belongs to this campaign
    const seq = await db.query.sequences.findFirst({
      where: and(
        eq(sequences.id, body.sequenceId),
        eq(sequences.campaignId, id),
        eq(sequences.workspaceId, request.workspaceId),
      ),
    })
    if (!seq) throw new NotFoundError('Sequence not found or does not belong to this campaign')

    // Batch insert enrollments; onConflictDoNothing silently skips duplicates
    const values = body.companyIds.map((companyId) => ({
      workspaceId: request.workspaceId,
      sequenceId: body.sequenceId,
      companyId,
      status: 'active' as const,
      ...(body.contactId ? { contactId: body.contactId } : {}),
    }))

    const inserted = await db
      .insert(sequenceEnrollments)
      .values(values)
      .onConflictDoNothing()
      .returning({ id: sequenceEnrollments.id })

    const enrolled = inserted.length
    const skipped = body.companyIds.length - enrolled

    // Atomically increment stats.enrolled and touch updatedAt
    await db
      .update(campaigns)
      .set({
        stats: sql`jsonb_set(
          stats,
          '{enrolled}',
          to_jsonb(COALESCE((stats->>'enrolled')::int, 0) + ${enrolled})
        )`,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, id))

    logger.info({
      event: 'campaign.enrolled',
      campaignId: id,
      enrolled,
      skipped,
      workspaceId: request.workspaceId,
    })

    return reply.status(201).send({ data: { enrolled, skipped, total: body.companyIds.length } })
  })
}
