import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, eq, isNull, desc, ilike, count, type SQL } from 'drizzle-orm'
import { getDb, companies } from '@ai-sales-os/db'
import type { CompanyStatus } from '@ai-sales-os/types'
import { CompanyNotFoundError, CompanyDuplicateError } from '@ai-sales-os/errors'
import { workspaceContextPlugin } from '../plugins/workspace-context.js'

const CreateCompanySchema = z.object({
  name: z.string().min(1).max(500),
  inn: z.string().length(10).or(z.string().length(12)).optional(),
  domain: z.string().max(255).optional(),
  legalName: z.string().max(500).optional(),
  industry: z.string().max(100).optional(),
  city: z.string().max(255).optional(),
  region: z.string().max(255).optional(),
  website: z.string().url().optional(),
  phones: z.array(z.string()).default([]),
  emails: z.array(z.string().email()).default([]),
  source: z.enum(['2gis', 'hhru', 'csv', 'manual', 'api']).default('manual'),
  tags: z.array(z.string()).default([]),
})

const ListCompaniesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  city: z.string().optional(),
  industry: z.string().optional(),
  search: z.string().optional(),
})

export const companiesRoutes: FastifyPluginAsync = async (app) => {
  await app.register(workspaceContextPlugin)

  /** GET /api/companies — list with filtering and pagination */
  app.get('/', async (request, reply) => {
    const query = ListCompaniesSchema.parse(request.query)
    const db = getDb()

    const conditions = [
      eq(companies.workspaceId, request.workspaceId),
      isNull(companies.deletedAt),
    ]

    if (query.status) {
      // Cast via SQL to avoid strict enum overload mismatch at compile time
      conditions.push(eq(companies.status, query.status as CompanyStatus) as unknown as SQL)
    }
    if (query.city) {
      conditions.push(ilike(companies.city, `%${query.city}%`))
    }
    if (query.industry) {
      conditions.push(ilike(companies.industry, `%${query.industry}%`))
    }

    const offset = (query.page - 1) * query.limit

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(companies)
        .where(and(...conditions))
        .orderBy(desc(companies.createdAt))
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

  /** GET /api/companies/:id — single company */
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

    return reply.send({ data: company })
  })

  /** POST /api/companies — create company */
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

    const [company] = await db
      .insert(companies)
      .values({
        ...body,
        workspaceId: request.workspaceId,
        status: 'new',
        enrichmentStatus: 'pending',
      })
      .returning()

    return reply.status(201).send({ data: company })
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

    return reply.status(204).send()
  })
}
