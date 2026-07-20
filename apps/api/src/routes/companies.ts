import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, eq, isNull, desc, ilike, count, or, sql, gte, lte, inArray, type SQL } from 'drizzle-orm'
import { getDb, companies, contacts, activities } from '@ai-sales-os/db'
import type { CompanyStatus } from '@ai-sales-os/types'
import { CompanyNotFoundError, CompanyDuplicateError } from '@ai-sales-os/errors'
import { workspaceContextPlugin } from '../plugins/workspace-context.js'
import { computeIcpScore, icpScoreToStatus } from '../services/icp-scoring.js'
import { createLogger } from '@ai-sales-os/logger'
import { getEnrichmentQueue, JOBS, makeJobId } from '@ai-sales-os/queue'

const logger = createLogger({ name: 'api:companies' })

const CreateCompanySchema = z.object({
  name: z.string().min(1).max(500),
  inn: z.string().length(10).or(z.string().length(12)).optional(),
  ogrn: z.string().optional(),
  domain: z.string().max(255).optional(),
  legalName: z.string().max(500).optional(),
  industry: z.string().max(100).optional(),
  city: z.string().max(255).optional(),
  region: z.string().max(255).optional(),
  address: z.string().optional(),
  website: z.string().url().optional(),
  phones: z.array(z.string()).default([]),
  emails: z.array(z.string().email()).default([]),
  source: z.enum(['2gis', 'hhru', 'csv', 'manual', 'api']).default('manual'),
  tags: z.array(z.string()).default([]),
  employeesCount: z.string().optional(),
  revenueRub: z.number().int().positive().optional(),
})

const UpdateCompanySchema = CreateCompanySchema.partial()

const ListCompaniesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  city: z.string().optional(),
  industry: z.string().optional(),
  search: z.string().optional(),
  // Sprint 1.3: ICP score range filter
  icpMin: z.coerce.number().int().min(0).max(100).optional(),
  icpMax: z.coerce.number().int().min(0).max(100).optional(),
  // Sprint 1.3: source filter
  source: z.enum(['2gis', 'hhru', 'csv', 'manual', 'api']).optional(),
})

const BatchImportSchema = z.object({
  companies: z.array(CreateCompanySchema).min(1).max(500),
})

export const companiesRoutes: FastifyPluginAsync = async (app) => {
  await app.register(workspaceContextPlugin)

  /** GET /api/companies — list with filtering, pagination, and full-text search */
  app.get('/', async (request, reply) => {
    const query = ListCompaniesSchema.parse(request.query)
    const db = getDb()

    const conditions: SQL[] = [
      eq(companies.workspaceId, request.workspaceId),
      isNull(companies.deletedAt),
    ]

    if (query.status) {
      conditions.push(eq(companies.status, query.status as CompanyStatus) as unknown as SQL)
    }
    if (query.city) {
      conditions.push(ilike(companies.city, `%${query.city}%`))
    }
    if (query.industry) {
      conditions.push(ilike(companies.industry, `%${query.industry}%`))
    }
    if (query.icpMin !== undefined) {
      conditions.push(gte(companies.icpScore, query.icpMin) as unknown as SQL)
    }
    if (query.icpMax !== undefined) {
      conditions.push(lte(companies.icpScore, query.icpMax) as unknown as SQL)
    }
    if (query.source) {
      conditions.push(eq(companies.source, query.source) as unknown as SQL)
    }

    // Full-text search on company name and legal name using Russian GIN index
    if (query.search) {
      const searchTerm = query.search.trim()
      conditions.push(
        or(
          // PostgreSQL full-text search with Russian stemming
          sql`to_tsvector('russian', ${companies.name} || ' ' || COALESCE(${companies.legalName}, '')) @@ plainto_tsquery('russian', ${searchTerm})`,
          // Fallback: simple ILIKE for short terms or non-Russian words
          ilike(companies.name, `%${searchTerm}%`),
          ilike(companies.inn, `%${searchTerm}%`),
        ) as unknown as SQL,
      )
    }

    const offset = (query.page - 1) * query.limit

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(companies)
        .where(and(...conditions))
        .orderBy(desc(companies.icpScore), desc(companies.createdAt))
        .limit(query.limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(companies)
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

  /** GET /api/companies/:id — single company with contacts and activity count */
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = getDb()

    const company = await db.query.companies.findFirst({
      where: and(
        eq(companies.id, id),
        eq(companies.workspaceId, request.workspaceId),
        isNull(companies.deletedAt),
      ),
    })

    if (!company) throw new CompanyNotFoundError()

    // Fetch contact count and activity count in parallel
    const [contactCount, activityCount] = await Promise.all([
      db
        .select({ total: count() })
        .from(contacts)
        .where(
          and(
            eq(contacts.companyId, id),
            eq(contacts.workspaceId, request.workspaceId),
            isNull(contacts.deletedAt),
          ),
        ),
      db
        .select({ total: count() })
        .from(activities)
        .where(
          and(
            eq(activities.companyId, id),
            eq(activities.workspaceId, request.workspaceId),
          ),
        ),
    ])

    return reply.send({
      data: {
        ...company,
        _counts: {
          contacts: Number(contactCount[0]?.total ?? 0),
          activities: Number(activityCount[0]?.total ?? 0),
        },
      },
    })
  })

  /** POST /api/companies — create company with ICP scoring */
  app.post('/', async (request, reply) => {
    const body = CreateCompanySchema.parse(request.body)
    const db = getDb()

    // Check INN uniqueness
    if (body.inn) {
      const existing = await db.query.companies.findFirst({
        where: and(
          eq(companies.workspaceId, request.workspaceId),
          eq(companies.inn, body.inn),
          isNull(companies.deletedAt),
        ),
        columns: { id: true },
      })
      if (existing) throw new CompanyDuplicateError('inn')
    }

    // Check domain uniqueness
    if (body.domain) {
      const existing = await db.query.companies.findFirst({
        where: and(
          eq(companies.workspaceId, request.workspaceId),
          eq(companies.domain, body.domain),
          isNull(companies.deletedAt),
        ),
        columns: { id: true },
      })
      if (existing) throw new CompanyDuplicateError('domain')
    }

    // Compute ICP score before insert
    const icpScore = computeIcpScore(body as Record<string, unknown>)
    const suggestedStatus = icpScoreToStatus(icpScore, 'new')

    const [company] = await db
      .insert(companies)
      .values({
        ...body,
        workspaceId: request.workspaceId,
        status: suggestedStatus === 'low_quality' ? 'low_quality' : 'new',
        enrichmentStatus: 'pending',
        icpScore,
      })
      .returning()

    logger.info({
      event: 'company.created',
      workspaceId: request.workspaceId,
      companyId: company.id,
      icpScore,
    })

    return reply.status(201).send({ data: company })
  })

  /** PATCH /api/companies/:id — update company */
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateCompanySchema.parse(request.body)
    const db = getDb()

    // Verify company exists in workspace
    const existing = await db.query.companies.findFirst({
      where: and(
        eq(companies.id, id),
        eq(companies.workspaceId, request.workspaceId),
        isNull(companies.deletedAt),
      ),
    })
    if (!existing) throw new CompanyNotFoundError()

    // Check INN uniqueness if changed
    if (body.inn && body.inn !== existing.inn) {
      const duplicate = await db.query.companies.findFirst({
        where: and(
          eq(companies.workspaceId, request.workspaceId),
          eq(companies.inn, body.inn),
          isNull(companies.deletedAt),
        ),
        columns: { id: true },
      })
      if (duplicate) throw new CompanyDuplicateError('inn')
    }

    // Check domain uniqueness if changed
    if (body.domain && body.domain !== existing.domain) {
      const duplicate = await db.query.companies.findFirst({
        where: and(
          eq(companies.workspaceId, request.workspaceId),
          eq(companies.domain, body.domain),
          isNull(companies.deletedAt),
        ),
        columns: { id: true },
      })
      if (duplicate) throw new CompanyDuplicateError('domain')
    }

    // Recompute ICP score with updated fields
    const merged = { ...existing, ...body }
    const icpScore = computeIcpScore(merged as Record<string, unknown>)
    const suggestedStatus = icpScoreToStatus(icpScore, existing.status)

    const updateData: Record<string, unknown> = {
      ...body,
      icpScore,
      updatedAt: new Date(),
    }
    if (suggestedStatus) {
      updateData.status = suggestedStatus
    }

    const [updated] = await db
      .update(companies)
      .set(updateData)
      .where(
        and(
          eq(companies.id, id),
          eq(companies.workspaceId, request.workspaceId),
          isNull(companies.deletedAt),
        ),
      )
      .returning()

    logger.info({
      event: 'company.updated',
      workspaceId: request.workspaceId,
      companyId: id,
      icpScore,
    })

    return reply.send({ data: updated })
  })

  /** DELETE /api/companies/:id — soft delete */
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = getDb()

    const [updated] = await db
      .update(companies)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(companies.id, id),
          eq(companies.workspaceId, request.workspaceId),
          isNull(companies.deletedAt),
        ),
      )
      .returning({ id: companies.id })

    if (!updated) throw new CompanyNotFoundError()

    logger.info({
      event: 'company.deleted',
      workspaceId: request.workspaceId,
      companyId: id,
    })

    return reply.status(204).send()
  })

  /** POST /api/companies/:id/enrich — trigger enrichment job */
  app.post('/:id/enrich', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = getDb()

    const company = await db.query.companies.findFirst({
      where: and(
        eq(companies.id, id),
        eq(companies.workspaceId, request.workspaceId),
        isNull(companies.deletedAt),
      ),
      columns: { id: true, enrichmentStatus: true },
    })

    if (!company) throw new CompanyNotFoundError()

    // Mark as in_progress immediately so UI can reflect it
    await db
      .update(companies)
      .set({ enrichmentStatus: 'in_progress', updatedAt: new Date() })
      .where(eq(companies.id, id))

    // Dispatch enrichment job to BullMQ
    await getEnrichmentQueue().add(
      JOBS.ENRICH_COMPANY,
      { workspaceId: request.workspaceId, companyId: id },
      { jobId: makeJobId(JOBS.ENRICH_COMPANY, id) },
    )

    logger.info({
      event: 'company.enrich.triggered',
      workspaceId: request.workspaceId,
      companyId: id,
    })

    return reply.send({ data: { id, enrichmentStatus: 'in_progress' } })
  })

  /**
   * POST /api/companies/import — batch import from CSV (parsed client-side).
   * Body: { companies: [...] }
   * Returns: { imported, skipped, errors }
   */
  app.post('/import', async (request, reply) => {
    const body = BatchImportSchema.parse(request.body)
    const db = getDb()

    let imported = 0
    let skipped = 0
    const errors: Array<{ index: number; reason: string }> = []

    // ── Bulk dedup check — 2 queries instead of N*2 ───────────────────────────
    const batchInns = body.companies
      .map((c) => c.inn)
      .filter((v): v is string => Boolean(v))

    const batchDomains = body.companies
      .map((c) => c.domain)
      .filter((v): v is string => Boolean(v))

    const [existingInnRows, existingDomainRows] = await Promise.all([
      batchInns.length > 0
        ? db
            .select({ inn: companies.inn })
            .from(companies)
            .where(
              and(
                eq(companies.workspaceId, request.workspaceId),
                inArray(companies.inn, batchInns),
                isNull(companies.deletedAt),
              ),
            )
        : Promise.resolve([]),
      batchDomains.length > 0
        ? db
            .select({ domain: companies.domain })
            .from(companies)
            .where(
              and(
                eq(companies.workspaceId, request.workspaceId),
                inArray(companies.domain, batchDomains),
                isNull(companies.deletedAt),
              ),
            )
        : Promise.resolve([]),
    ])

    // O(1) lookup sets — pre-populated from DB + updated as we insert
    const usedInns = new Set(existingInnRows.map((r) => r.inn).filter(Boolean) as string[])
    const usedDomains = new Set(existingDomainRows.map((r) => r.domain).filter(Boolean) as string[])

    for (let i = 0; i < body.companies.length; i++) {
      const row = body.companies[i]
      try {
        // Skip duplicates — O(1) Set lookup
        if (row.inn && usedInns.has(row.inn)) { skipped++; continue }
        if (row.domain && usedDomains.has(row.domain)) { skipped++; continue }

        const icpScore = computeIcpScore(row as Record<string, unknown>)
        const suggestedStatus = icpScoreToStatus(icpScore, 'new')

        await db.insert(companies).values({
          ...row,
          workspaceId: request.workspaceId,
          status: suggestedStatus === 'low_quality' ? 'low_quality' : 'new',
          enrichmentStatus: 'pending',
          icpScore,
          source: 'csv',
        })

        // Track newly inserted identifiers to prevent intra-batch duplicates
        if (row.inn) usedInns.add(row.inn)
        if (row.domain) usedDomains.add(row.domain)

        imported++
      } catch (err) {
        errors.push({
          index: i,
          reason: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    logger.info({
      event: 'companies.imported',
      workspaceId: request.workspaceId,
      imported,
      skipped,
      errors: errors.length,
    })

    return reply.status(207).send({ data: { imported, skipped, errors } })
  })

  /** GET /api/companies/:id/contacts — list contacts for a company */
  app.get('/:id/contacts', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = getDb()

    // Verify company belongs to workspace
    const company = await db.query.companies.findFirst({
      where: and(
        eq(companies.id, id),
        eq(companies.workspaceId, request.workspaceId),
        isNull(companies.deletedAt),
      ),
      columns: { id: true },
    })
    if (!company) throw new CompanyNotFoundError()

    const rows = await db.query.contacts.findMany({
      where: and(
        eq(contacts.companyId, id),
        eq(contacts.workspaceId, request.workspaceId),
        isNull(contacts.deletedAt),
      ),
      orderBy: [desc(contacts.createdAt)],
    })

    return reply.send({ data: rows })
  })

  /** GET /api/companies/:id/activities — activity timeline */
  app.get('/:id/activities', async (request, reply) => {
    const { id } = request.params as { id: string }
    const query = z
      .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
      .parse(request.query)
    const db = getDb()

    const company = await db.query.companies.findFirst({
      where: and(
        eq(companies.id, id),
        eq(companies.workspaceId, request.workspaceId),
        isNull(companies.deletedAt),
      ),
      columns: { id: true },
    })
    if (!company) throw new CompanyNotFoundError()

    const rows = await db.query.activities.findMany({
      where: and(
        eq(activities.companyId, id),
        eq(activities.workspaceId, request.workspaceId),
      ),
      orderBy: [desc(activities.occurredAt)],
      limit: query.limit,
    })

    return reply.send({ data: rows })
  })

  /** POST /api/companies/:id/activities — log a manual activity (note, call, meeting) */
  app.post('/:id/activities', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = z
      .object({
        type: z.enum(['call', 'meeting', 'note']),
        subject: z.string().max(500).optional(),
        body: z.string().optional(),
        contactId: z.string().uuid().optional(),
      })
      .parse(request.body)
    const db = getDb()

    const company = await db.query.companies.findFirst({
      where: and(
        eq(companies.id, id),
        eq(companies.workspaceId, request.workspaceId),
        isNull(companies.deletedAt),
      ),
      columns: { id: true },
    })
    if (!company) throw new CompanyNotFoundError()

    const [activity] = await db
      .insert(activities)
      .values({
        workspaceId: request.workspaceId,
        companyId: id,
        contactId: body.contactId ?? null,
        type: body.type,
        direction: 'outbound',
        subject: body.subject ?? null,
        body: body.body ?? null,
        performedBy: request.userId,
        automated: false,
      })
      .returning()

    logger.info({
      event: 'activity.created',
      workspaceId: request.workspaceId,
      companyId: id,
      type: body.type,
    })

    return reply.status(201).send({ data: activity })
  })
}
