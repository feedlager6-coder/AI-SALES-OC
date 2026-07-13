import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, eq, isNull, desc, count } from 'drizzle-orm'
import { getDb, deals, companies, activities } from '@ai-sales-os/db'
import { NotFoundError, BadRequestError } from '@ai-sales-os/errors'
import { workspaceContextPlugin } from '../plugins/workspace-context.js'
import { createLogger } from '@ai-sales-os/logger'

const logger = createLogger({ name: 'api:deals' })

const DealStages = ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const

const CreateDealSchema = z.object({
  title: z.string().min(1).max(500),
  companyId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  valueRub: z.number().int().nonnegative().optional(),
  stage: z.enum(DealStages).default('new'),
  probability: z.number().int().min(0).max(100).default(0),
  expectedClose: z.string().date().optional(), // ISO date string YYYY-MM-DD
  tags: z.array(z.string()).default([]),
})

const UpdateDealSchema = CreateDealSchema.partial().extend({
  lostReason: z.string().optional(),
})

const ListDealsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  stage: z.enum(DealStages).optional(),
  companyId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
})

export const dealsRoutes: FastifyPluginAsync = async (app) => {
  await app.register(workspaceContextPlugin)

  /** GET /api/deals — list with filtering and pagination */
  app.get('/', async (request, reply) => {
    const query = ListDealsSchema.parse(request.query)
    const db = getDb()

    const conditions = [
      eq(deals.workspaceId, request.workspaceId),
      isNull(deals.deletedAt),
    ]

    if (query.stage) conditions.push(eq(deals.stage, query.stage))
    if (query.companyId) conditions.push(eq(deals.companyId, query.companyId))
    if (query.assignedTo) conditions.push(eq(deals.assignedTo, query.assignedTo))

    const offset = (query.page - 1) * query.limit

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(deals)
        .where(and(...conditions))
        .orderBy(desc(deals.createdAt))
        .limit(query.limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(deals)
        .where(and(...conditions)),
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

  /** GET /api/deals/:id — single deal */
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = getDb()

    const deal = await db.query.deals.findFirst({
      where: and(
        eq(deals.id, id),
        eq(deals.workspaceId, request.workspaceId),
        isNull(deals.deletedAt),
      ),
    })

    if (!deal) throw new NotFoundError('Deal', 'DEAL_NOT_FOUND')

    return reply.send({ data: deal })
  })

  /** POST /api/deals — create deal */
  app.post('/', async (request, reply) => {
    const body = CreateDealSchema.parse(request.body)
    const db = getDb()

    // Verify company belongs to workspace if provided
    if (body.companyId) {
      const company = await db.query.companies.findFirst({
        where: and(
          eq(companies.id, body.companyId),
          eq(companies.workspaceId, request.workspaceId),
          isNull(companies.deletedAt),
        ),
        columns: { id: true },
      })
      if (!company) throw new BadRequestError('Company not found in this workspace')
    }

    const [deal] = await db
      .insert(deals)
      .values({
        ...body,
        workspaceId: request.workspaceId,
      })
      .returning()

    // Log deal_created activity if company is linked
    if (deal.companyId) {
      await db.insert(activities).values({
        workspaceId: request.workspaceId,
        companyId: deal.companyId,
        contactId: deal.contactId ?? null,
        dealId: deal.id,
        type: 'deal_created',
        direction: 'internal',
        subject: `Сделка создана: ${deal.title}`,
        performedBy: request.userId,
        automated: false,
      })
    }

    logger.info({
      event: 'deal.created',
      workspaceId: request.workspaceId,
      dealId: deal.id,
      stage: deal.stage,
    })

    return reply.status(201).send({ data: deal })
  })

  /** PATCH /api/deals/:id — update deal */
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateDealSchema.parse(request.body)
    const db = getDb()

    const existing = await db.query.deals.findFirst({
      where: and(
        eq(deals.id, id),
        eq(deals.workspaceId, request.workspaceId),
        isNull(deals.deletedAt),
      ),
    })
    if (!existing) throw new NotFoundError('Deal', 'DEAL_NOT_FOUND')

    const updateData: Record<string, unknown> = {
      ...body,
      updatedAt: new Date(),
    }

    // Track stage transitions
    if (body.stage && body.stage !== existing.stage) {
      if (body.stage === 'won') updateData.wonAt = new Date()
      if (body.stage === 'lost') updateData.lostAt = new Date()
    }

    const [updated] = await db
      .update(deals)
      .set(updateData)
      .where(
        and(
          eq(deals.id, id),
          eq(deals.workspaceId, request.workspaceId),
        ),
      )
      .returning()

    // Log stage change activity if company is linked
    if (body.stage && body.stage !== existing.stage && existing.companyId) {
      await db.insert(activities).values({
        workspaceId: request.workspaceId,
        companyId: existing.companyId,
        dealId: id,
        type: 'deal_stage_changed',
        direction: 'internal',
        subject: `Сделка: ${existing.stage} → ${body.stage}`,
        performedBy: request.userId,
        automated: false,
        metadata: { from: existing.stage, to: body.stage },
      })
    }

    logger.info({
      event: 'deal.updated',
      workspaceId: request.workspaceId,
      dealId: id,
      stage: updated.stage,
    })

    return reply.send({ data: updated })
  })

  /** DELETE /api/deals/:id — soft delete */
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = getDb()

    const [updated] = await db
      .update(deals)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(deals.id, id),
          eq(deals.workspaceId, request.workspaceId),
          isNull(deals.deletedAt),
        ),
      )
      .returning({ id: deals.id })

    if (!updated) throw new NotFoundError('Deal', 'DEAL_NOT_FOUND')

    return reply.status(204).send()
  })
}
