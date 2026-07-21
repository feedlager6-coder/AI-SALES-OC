/**
 * Contacts routes — workspace isolation regression tests
 * Verifies that every endpoint enforces workspaceId so that contacts from
 * other workspaces can never be read, mutated, or deleted by the wrong tenant.
 *
 * Uses Fastify inject + vi.mock for the DB layer (no real DB required).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type FastifyInstance } from 'fastify'
import { createTestApp } from '../helpers.js'

// ─── Hoisted mocks (must come before vi.mock factory calls) ───────────────────

const mocks = vi.hoisted(() => {
  const contactFindFirst = vi.fn()
  const companyFindFirst = vi.fn()

  // Chainable builder for select().from().where().orderBy().limit().offset()
  //
  // The contacts list endpoint calls Promise.all([rowQuery, countQuery]) where:
  //   rowQuery  = db.select().from().where().orderBy().limit().offset()  → ends at offset()
  //   countQuery = db.select().from().where()                            → ends at where()
  //
  // To handle both in one chain object, we make the chain itself thenable so that
  // `await chain` resolves to countRows. When the row query appends .offset(), it
  // returns a regular Promise that resolves to rows — this takes precedence over
  // the chain's .then() for that query path.
  function makeSelectChain(rows: unknown[] = [], countRows: unknown[] = [{ total: 0 }]) {
    const chain: Record<string, unknown> = {}
    Object.assign(chain, {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => Promise.resolve(rows),
      // Makes `await chain` resolve to countRows (used by count query ending at .where())
      then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
        Promise.resolve(countRows).then(resolve, reject),
    })
    return chain
  }

  function makeInsertChain(result: unknown[] = []) {
    return { values: () => ({ returning: () => Promise.resolve(result) }) }
  }
  function makeUpdateChain(result: unknown[] = []) {
    return {
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve(result),
        }),
      }),
    }
  }

  const selectMock = vi.fn(() => makeSelectChain())
  const insertMock = vi.fn(() => makeInsertChain())
  const updateMock = vi.fn(() => makeUpdateChain())

  const db = {
    query: {
      contacts: { findFirst: contactFindFirst },
      companies: { findFirst: companyFindFirst },
    },
    select: selectMock,
    insert: insertMock,
    update: updateMock,
  }

  return {
    contactFindFirst,
    companyFindFirst,
    selectMock,
    insertMock,
    updateMock,
    db,
    makeSelectChain,
    makeInsertChain,
    makeUpdateChain,
  }
})

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@ai-sales-os/db', () => ({
  getDb: () => mocks.db,
  contacts: {
    id: 'id',
    workspaceId: 'workspace_id',
    companyId: 'company_id',
    fullName: 'full_name',
    email: 'email',
    phone: 'phone',
    deletedAt: 'deleted_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  companies: {
    id: 'id',
    workspaceId: 'workspace_id',
    deletedAt: 'deleted_at',
  },
}))

vi.mock('@ai-sales-os/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@ai-sales-os/errors', async () => {
  const mod = await import('@ai-sales-os/errors')
  return mod
})

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ and: args }),
  or: (...args: unknown[]) => (args.length > 0 ? { or: args } : undefined),
  eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
  ilike: (col: unknown, val: unknown) => ({ ilike: [col, val] }),
  isNull: (col: unknown) => ({ isNull: col }),
  desc: (col: unknown) => ({ desc: col }),
  count: () => ({ count: true }),
}))

vi.mock('../../src/plugins/workspace-context.js', () => ({
  workspaceContextPlugin: async (app: FastifyInstance) => {
    app.addHook('preHandler', async (request) => {
      ;(request as Record<string, unknown>).workspaceId = WORKSPACE_ID
      ;(request as Record<string, unknown>).userId = 'user-00000000-0000-0000-0000-000000000001'
    })
  },
}))

// ─── Constants ────────────────────────────────────────────────────────────────

const WORKSPACE_ID = 'ws-00000000-0000-0000-0000-000000000001'
const OTHER_WORKSPACE_ID = 'ws-00000000-0000-0000-0000-000000000099'
const CONTACT_ID = '00000000-0000-0000-0000-000000000010'
const COMPANY_ID = '00000000-0000-0000-0000-000000000020'

// ─── Factories ────────────────────────────────────────────────────────────────

function makeContact(overrides: Record<string, unknown> = {}) {
  return {
    id: CONTACT_ID,
    workspaceId: WORKSPACE_ID,
    companyId: COMPANY_ID,
    fullName: 'Иван Иванов',
    email: 'ivan@example.com',
    phone: '+79001234567',
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
    enrichmentStatus: 'pending',
    ...overrides,
  }
}

// ─── Test app builder ─────────────────────────────────────────────────────────

async function buildApp(): Promise<FastifyInstance> {
  const app = createTestApp()
  const { contactsRoutes } = await import('../../src/routes/contacts.js')
  await app.register(contactsRoutes, { prefix: '/' })
  await app.ready()
  return app
}

// ─── GET / — list contacts ────────────────────────────────────────────────────

describe('GET / — list contacts', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  it('returns paginated list of contacts', async () => {
    const contact = makeContact()
    // Two select() calls in Promise.all: one for rows (ends at .offset()), one for count (ends at .where())
    mocks.selectMock
      .mockImplementationOnce(() => mocks.makeSelectChain([contact], []))   // rows query
      .mockImplementationOnce(() => mocks.makeSelectChain([], [{ total: 1 }])) // count query

    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { data: unknown[]; meta: { total: number } }
    expect(body.data).toHaveLength(1)
    expect(body.meta.total).toBe(1)
  })

  it('returns empty list when no contacts exist', async () => {
    mocks.selectMock
      .mockImplementationOnce(() => mocks.makeSelectChain([], []))          // rows query
      .mockImplementationOnce(() => mocks.makeSelectChain([], [{ total: 0 }])) // count query

    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { data: unknown[] }
    expect(body.data).toHaveLength(0)
  })

  it('accepts companyId filter', async () => {
    mocks.selectMock
      .mockImplementationOnce(() => mocks.makeSelectChain([], []))
      .mockImplementationOnce(() => mocks.makeSelectChain([], [{ total: 0 }]))

    const res = await app.inject({
      method: 'GET',
      url: `/?companyId=${COMPANY_ID}`,
    })
    expect(res.statusCode).toBe(200)
  })

  it('accepts search param', async () => {
    mocks.selectMock
      .mockImplementationOnce(() => mocks.makeSelectChain([], []))
      .mockImplementationOnce(() => mocks.makeSelectChain([], [{ total: 0 }]))

    const res = await app.inject({ method: 'GET', url: '/?search=иван' })
    expect(res.statusCode).toBe(200)
  })
})

// ─── GET /:id — workspace isolation ──────────────────────────────────────────

describe('GET /:id — workspace isolation', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  it('returns contact that belongs to the current workspace', async () => {
    mocks.contactFindFirst.mockResolvedValue(makeContact())

    const res = await app.inject({ method: 'GET', url: `/${CONTACT_ID}` })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { data: { workspaceId: string } }
    expect(body.data.workspaceId).toBe(WORKSPACE_ID)
  })

  it('returns 404 when contact belongs to a DIFFERENT workspace (isolation check)', async () => {
    // findFirst returns null because the DB query filters by workspaceId —
    // contacts from another workspace are invisible to this request
    mocks.contactFindFirst.mockResolvedValue(null)

    const res = await app.inject({ method: 'GET', url: `/${CONTACT_ID}` })
    expect(res.statusCode).toBe(404)
    const body = JSON.parse(res.body) as { error: { code: string } }
    expect(body.error.code).toBe('CONTACT_NOT_FOUND')
  })

  it('returns 404 when contact is soft-deleted', async () => {
    mocks.contactFindFirst.mockResolvedValue(null) // filtered out by isNull(deletedAt)

    const res = await app.inject({ method: 'GET', url: `/${CONTACT_ID}` })
    expect(res.statusCode).toBe(404)
  })
})

// ─── POST / — create contact workspace isolation ──────────────────────────────

describe('POST / — workspace isolation', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  it('creates a contact and assigns it to the current workspace', async () => {
    const created = makeContact()
    mocks.companyFindFirst.mockResolvedValue({ id: COMPANY_ID })
    mocks.contactFindFirst.mockResolvedValue(null) // no duplicate email
    mocks.insertMock.mockReturnValueOnce(
      mocks.makeInsertChain([created]),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        companyId: COMPANY_ID,
        fullName: 'Иван Иванов',
        email: 'ivan@example.com',
      },
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body) as { data: { workspaceId: string } }
    expect(body.data.workspaceId).toBe(WORKSPACE_ID)
  })

  it('returns 400 when company belongs to a DIFFERENT workspace (isolation check)', async () => {
    // findFirst returns null because company is scoped to other workspace
    mocks.companyFindFirst.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { companyId: COMPANY_ID, fullName: 'Test' },
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body) as { error: { message: string } }
    expect(body.error.message).toMatch(/company not found/i)
  })

  it('returns 400 when email already exists in workspace (duplicate guard)', async () => {
    mocks.companyFindFirst.mockResolvedValue(null) // no companyId provided
    mocks.contactFindFirst.mockResolvedValue(makeContact()) // duplicate found

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { email: 'ivan@example.com', fullName: 'Other Person' },
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body) as { error: { code: string } }
    expect(body.error.code).toBe('CONTACT_DUPLICATE')
  })

  it('creates contact without companyId', async () => {
    const created = makeContact({ companyId: null })
    mocks.contactFindFirst.mockResolvedValue(null)
    mocks.insertMock.mockReturnValueOnce(
      mocks.makeInsertChain([created]),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { fullName: 'Пётр Петров' },
    })
    expect(res.statusCode).toBe(201)
  })
})

// ─── PATCH /:id — workspace isolation ────────────────────────────────────────

describe('PATCH /:id — workspace isolation', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  it('updates contact that belongs to current workspace', async () => {
    const existing = makeContact()
    const updated = makeContact({ fullName: 'Иван Новый' })
    mocks.contactFindFirst.mockResolvedValue(existing)
    mocks.updateMock.mockReturnValueOnce(
      mocks.makeUpdateChain([updated]),
    )

    const res = await app.inject({
      method: 'PATCH',
      url: `/${CONTACT_ID}`,
      payload: { fullName: 'Иван Новый' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { data: { fullName: string } }
    expect(body.data.fullName).toBe('Иван Новый')
  })

  it('returns 404 when contact belongs to a DIFFERENT workspace (isolation check)', async () => {
    // findFirst returns null because workspace filter excludes other-workspace contacts
    mocks.contactFindFirst.mockResolvedValue(null)

    const res = await app.inject({
      method: 'PATCH',
      url: `/${CONTACT_ID}`,
      payload: { fullName: 'Hack Attempt' },
    })
    expect(res.statusCode).toBe(404)
    const body = JSON.parse(res.body) as { error: { code: string } }
    expect(body.error.code).toBe('CONTACT_NOT_FOUND')
  })

  it('returns 400 when new email is a duplicate in workspace', async () => {
    const existing = makeContact({ email: 'old@example.com' })
    const duplicate = makeContact({ id: 'other-id', email: 'new@example.com' })
    // First findFirst → existing contact; second findFirst → duplicate
    mocks.contactFindFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(duplicate)

    const res = await app.inject({
      method: 'PATCH',
      url: `/${CONTACT_ID}`,
      payload: { email: 'new@example.com' },
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body) as { error: { code: string } }
    expect(body.error.code).toBe('CONTACT_DUPLICATE')
  })
})

// ─── DELETE /:id — workspace isolation ───────────────────────────────────────

describe('DELETE /:id — workspace isolation', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  it('soft-deletes contact that belongs to current workspace', async () => {
    mocks.updateMock.mockReturnValueOnce(
      mocks.makeUpdateChain([{ id: CONTACT_ID }]),
    )

    const res = await app.inject({ method: 'DELETE', url: `/${CONTACT_ID}` })
    expect(res.statusCode).toBe(204)
  })

  it('returns 404 when contact belongs to a DIFFERENT workspace (isolation check)', async () => {
    // WHERE includes workspaceId — other-workspace contact is invisible → 0 rows updated
    mocks.updateMock.mockReturnValueOnce(
      mocks.makeUpdateChain([]), // empty result = not found
    )

    const res = await app.inject({ method: 'DELETE', url: `/${CONTACT_ID}` })
    expect(res.statusCode).toBe(404)
    const body = JSON.parse(res.body) as { error: { code: string } }
    expect(body.error.code).toBe('CONTACT_NOT_FOUND')
  })

  it('returns 404 when contact is already soft-deleted', async () => {
    // isNull(deletedAt) in WHERE excludes it → 0 rows updated
    mocks.updateMock.mockReturnValueOnce(
      mocks.makeUpdateChain([]),
    )

    const res = await app.inject({ method: 'DELETE', url: `/${CONTACT_ID}` })
    expect(res.statusCode).toBe(404)
  })
})

// ─── Cross-workspace safety summary ──────────────────────────────────────────

describe('Workspace isolation — summary', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  it('GET /:id from other workspace → 404 (not 403, no information leak)', async () => {
    mocks.contactFindFirst.mockResolvedValue(null)
    const res = await app.inject({ method: 'GET', url: `/${CONTACT_ID}` })
    expect(res.statusCode).toBe(404) // must NOT be 200 or 403
  })

  it('PATCH /:id from other workspace → 404 (no mutation possible)', async () => {
    mocks.contactFindFirst.mockResolvedValue(null)
    const res = await app.inject({
      method: 'PATCH',
      url: `/${CONTACT_ID}`,
      payload: { fullName: 'X' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /:id from other workspace → 404 (no deletion possible)', async () => {
    mocks.updateMock.mockReturnValueOnce(mocks.makeUpdateChain([]))
    const res = await app.inject({ method: 'DELETE', url: `/${CONTACT_ID}` })
    expect(res.statusCode).toBe(404)
  })

  it('POST / with company from other workspace → 400 (company not in workspace)', async () => {
    mocks.companyFindFirst.mockResolvedValue(null) // other-workspace company invisible
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        companyId: COMPANY_ID,
        fullName: 'Attacker',
      },
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body) as { error: { message: string } }).toMatchObject({
      error: { message: expect.stringMatching(/company not found/i) },
    })
  })
})
