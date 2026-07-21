import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, or, eq, isNull, desc, ilike, count } from 'drizzle-orm'
import { getDb, contacts, companies } from '@ai-sales-os/db'
import { ContactNotFoundError, BadRequestError } from '@ai-sales-os/errors'
import { workspaceContextPlugin } from '../plugins/workspace-context.js'
import { createLogger } from '@ai-sales-os/logger'

const logger = createLogger({ name: 'api:contacts' })

const CreateContactSchema = z.object({
  companyId: z.string().uuid().optional(),
  firstName: z.string().max(255).optional(),
  lastName: z.string().max(255).optional(),
  fullName: z.string().max(500).optional(),
  title: z.string().max(255).optional(),
  seniority: z.enum(['c_level', 'vp', 'director', 'manager', 'individual']).optional(),
  department: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  linkedinUrl: z.string().url().optional(),
  telegram: z.string().max(100).optional(),
  tags: z.array(z.string()).default([]),
})

const UpdateContactSchema = CreateContactSchema.partial()

const ListContactsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  companyId: z.string().uuid().optional(),
  search: z.string().optional(),
})

export const contactsRoutes: FastifyPluginAsync = async (app) => {
  await app.register(workspaceContextPlugin)

  /** GET /api/contacts — list with pagination and filtering */
  app.get('/', async (request, reply) => {
    const query = ListContactsSchema.parse(request.query)
    const db = getDb()

    const conditions = [
      eq(contacts.workspaceId, request.workspaceId),
      isNull(contacts.deletedAt),
    ]

    if (query.companyId) {
      conditions.push(eq(contacts.companyId, query.companyId))
    }

    if (query.search) {
      const term = `%${query.search}%`
      // Search by name, email, and phone so users can find contacts by email address too
      // or() returns SQL | undefined; we know it's defined because we pass non-empty args
      const searchExpr = or(
        ilike(contacts.fullName, term),
        ilike(contacts.email, term),
        ilike(contacts.phone, term),
      )
      if (searchExpr) conditions.push(searchExpr)
    }

    const offset = (query.page - 1) * query.limit

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(contacts)
        .where(and(...conditions))
        .orderBy(desc(contacts.createdAt))
        .limit(query.limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(contacts)
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

  /** GET /api/contacts/:id — single contact */
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = getDb()

    const contact = await db.query.contacts.findFirst({
      where: and(
        eq(contacts.id, id),
        eq(contacts.workspaceId, request.workspaceId),
        isNull(contacts.deletedAt),
      ),
    })

    if (!contact) throw new ContactNotFoundError()

    return reply.send({ data: contact })
  })

  /** POST /api/contacts — create contact */
  app.post('/', async (request, reply) => {
    const body = CreateContactSchema.parse(request.body)
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

    // Check email uniqueness in workspace (if email provided)
    if (body.email) {
      const existing = await db.query.contacts.findFirst({
        where: and(
          eq(contacts.workspaceId, request.workspaceId),
          eq(contacts.email, body.email),
          isNull(contacts.deletedAt),
        ),
        columns: { id: true },
      })
      if (existing) {
        throw new BadRequestError('A contact with this email already exists in the workspace', 'CONTACT_DUPLICATE')
      }
    }

    // Derive fullName if not provided
    const derivedName = [body.firstName, body.lastName].filter(Boolean).join(' ') || null
    const fullName = body.fullName ?? derivedName

    const [contact] = await db
      .insert(contacts)
      .values({
        ...body,
        fullName: fullName ?? undefined,
        workspaceId: request.workspaceId,
        enrichmentStatus: 'pending',
      })
      .returning()

    logger.info({
      event: 'contact.created',
      workspaceId: request.workspaceId,
      contactId: contact.id,
      companyId: body.companyId,
    })

    return reply.status(201).send({ data: contact })
  })

  /** PATCH /api/contacts/:id — update contact */
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateContactSchema.parse(request.body)
    const db = getDb()

    const existing = await db.query.contacts.findFirst({
      where: and(
        eq(contacts.id, id),
        eq(contacts.workspaceId, request.workspaceId),
        isNull(contacts.deletedAt),
      ),
    })
    if (!existing) throw new ContactNotFoundError()

    // Check email uniqueness if changed
    if (body.email && body.email !== existing.email) {
      const duplicate = await db.query.contacts.findFirst({
        where: and(
          eq(contacts.workspaceId, request.workspaceId),
          eq(contacts.email, body.email),
          isNull(contacts.deletedAt),
        ),
        columns: { id: true },
      })
      if (duplicate) {
        throw new BadRequestError('A contact with this email already exists in the workspace', 'CONTACT_DUPLICATE')
      }
    }

    // Recompute fullName if first/last name changed
    const firstName = body.firstName ?? existing.firstName
    const lastName = body.lastName ?? existing.lastName
    let fullName: string | null | undefined
    if (body.fullName !== undefined) {
      fullName = body.fullName
    } else if (body.firstName !== undefined || body.lastName !== undefined) {
      fullName = [firstName, lastName].filter(Boolean).join(' ') || null
    } else {
      fullName = undefined
    }

    const [updated] = await db
      .update(contacts)
      .set({
        ...body,
        ...(fullName !== undefined ? { fullName } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(contacts.id, id),
          eq(contacts.workspaceId, request.workspaceId),
        ),
      )
      .returning()

    logger.info({
      event: 'contact.updated',
      workspaceId: request.workspaceId,
      contactId: id,
    })

    return reply.send({ data: updated })
  })

  /** DELETE /api/contacts/:id — soft delete */
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = getDb()

    const [updated] = await db
      .update(contacts)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(contacts.id, id),
          eq(contacts.workspaceId, request.workspaceId),
          isNull(contacts.deletedAt),
        ),
      )
      .returning({ id: contacts.id })

    if (!updated) throw new ContactNotFoundError()

    return reply.status(204).send()
  })
}
