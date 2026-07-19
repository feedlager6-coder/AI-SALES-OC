/**
 * Sequences routes — business logic tests
 * Tests step-number uniqueness validation and campaign ownership.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type FastifyInstance } from 'fastify'
import { createTestApp } from '../helpers.js'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const sequenceFindFirst = vi.fn()
  const campaignFindFirst = vi.fn()

  function makeInsertChain(result: unknown[] = []) {
    return { values: () => ({ returning: () => Promise.resolve(result) }) }
  }
  function makeUpdateChain(result: unknown[] = []) {
    return {
      set: () => ({ where: () => ({ returning: () => Promise.resolve(result) }) }),
    }
  }

  const selectMock = vi.fn(() => ({
    from: () => ({ where: () => ({ orderBy: () => ({ limit: () => ({ offset: () => Promise.resolve([]) }) }) }) }),
  }))
  const insertMock = vi.fn(() => makeInsertChain())
  const updateMock = vi.fn(() => makeUpdateChain())
  const deleteMock = vi.fn(() => ({ where: () => Promise.resolve() }))

  const db = {
    query: {
      sequences: { findFirst: sequenceFindFirst },
      campaigns: { findFirst: campaignFindFirst },
    },
    select: selectMock,
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
  }

  return { sequenceFindFirst, campaignFindFirst, selectMock, insertMock, updateMock, deleteMock, db }
})

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@ai-sales-os/db', () => ({
  getDb: () => mocks.db,
  sequences: { id: 'id', workspaceId: 'workspace_id', campaignId: 'campaign_id', createdAt: 'created_at' },
  campaigns: { id: 'id', workspaceId: 'workspace_id', status: 'status' },
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
  eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
  desc: (col: unknown) => ({ desc: col }),
  count: () => ({ count: true }),
}))

vi.mock('../../src/plugins/workspace-context.js', () => ({
  workspaceContextPlugin: async (app: FastifyInstance) => {
    app.addHook('preHandler', async (request) => {
      ;(request as Record<string, unknown>).workspaceId = 'ws-00000000-0000-0000-0000-000000000001'
      ;(request as Record<string, unknown>).userId = 'user-00000000-0000-0000-0000-000000000001'
    })
  },
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CAMPAIGN_ID = '00000000-0000-0000-0000-000000000010'
const SEQUENCE_ID = '00000000-0000-0000-0000-000000000020'
const WORKSPACE_ID = 'ws-00000000-0000-0000-0000-000000000001'

function makeSequence(overrides: Record<string, unknown> = {}) {
  return {
    id: SEQUENCE_ID,
    workspaceId: WORKSPACE_ID,
    campaignId: CAMPAIGN_ID,
    name: 'Test Sequence',
    steps: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeCampaign(status = 'draft') {
  return {
    id: CAMPAIGN_ID,
    workspaceId: WORKSPACE_ID,
    name: 'Test Campaign',
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

const validSteps = [
  { stepNumber: 1, type: 'email', subject: 'Hello', bodyHtml: '<p>Hi</p>', stopOnReply: true, stopOnClick: false },
  { stepNumber: 2, type: 'wait', delayDays: 3, stopOnReply: true, stopOnClick: false },
  { stepNumber: 3, type: 'email', subject: 'Follow-up', bodyHtml: '<p>Still there?</p>', stopOnReply: true, stopOnClick: false },
]

async function buildApp() {
  const { sequencesRoutes } = await import('../../src/routes/sequences.js')
  const app = createTestApp()
  await app.register(sequencesRoutes, { prefix: '/' })
  await app.ready()
  return app
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST / — create sequence', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  it('returns 400 when step numbers are not unique', async () => {
    mocks.campaignFindFirst.mockResolvedValue(makeCampaign('draft'))

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        name: 'Dup Steps',
        campaignId: CAMPAIGN_ID,
        steps: [
          { stepNumber: 1, type: 'email', subject: 'A', bodyHtml: '<p>A</p>', stopOnReply: true, stopOnClick: false },
          { stepNumber: 1, type: 'email', subject: 'B', bodyHtml: '<p>B</p>', stopOnReply: true, stopOnClick: false },
        ],
      },
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.message).toMatch(/unique step numbers/i)
  })

  it('returns 400 when adding a sequence to a completed campaign', async () => {
    mocks.campaignFindFirst.mockResolvedValue(makeCampaign('completed'))

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { name: 'Test', campaignId: CAMPAIGN_ID, steps: validSteps },
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.message).toMatch(/completed|archived/i)
  })

  it('returns 400 when campaign not found', async () => {
    mocks.campaignFindFirst.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { name: 'Test', campaignId: CAMPAIGN_ID, steps: validSteps },
    })
    expect(res.statusCode).toBe(404)
  })

  it('creates sequence when campaign is active and steps are valid', async () => {
    mocks.campaignFindFirst.mockResolvedValue(makeCampaign('active'))
    const seq = makeSequence({ steps: validSteps })
    mocks.insertMock.mockReturnValue({
      values: () => ({ returning: () => Promise.resolve([seq]) }),
    })

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { name: 'Valid Sequence', campaignId: CAMPAIGN_ID, steps: validSteps },
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body).data.name).toBe('Test Sequence')
  })
})

describe('PATCH /:id — update sequence', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  it('returns 404 when sequence not found', async () => {
    mocks.sequenceFindFirst.mockResolvedValue(null)

    const res = await app.inject({
      method: 'PATCH',
      url: `/${SEQUENCE_ID}`,
      payload: { name: 'Updated' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 when updated steps have duplicate step numbers', async () => {
    mocks.sequenceFindFirst.mockResolvedValue(makeSequence())

    const res = await app.inject({
      method: 'PATCH',
      url: `/${SEQUENCE_ID}`,
      payload: {
        steps: [
          { stepNumber: 1, type: 'email', subject: 'A', bodyHtml: '<p>A</p>', stopOnReply: true, stopOnClick: false },
          { stepNumber: 1, type: 'wait', delayDays: 2, stopOnReply: true, stopOnClick: false },
        ],
      },
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.message).toMatch(/unique step numbers/i)
  })

  it('updates sequence name when found', async () => {
    mocks.sequenceFindFirst.mockResolvedValue(makeSequence())
    const updated = makeSequence({ name: 'New Name' })
    mocks.updateMock.mockReturnValue({
      set: () => ({ where: () => ({ returning: () => Promise.resolve([updated]) }) }),
    })

    const res = await app.inject({
      method: 'PATCH',
      url: `/${SEQUENCE_ID}`,
      payload: { name: 'New Name' },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).data.name).toBe('New Name')
  })
})

describe('DELETE /:id — delete sequence', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  it('returns 404 when sequence not found', async () => {
    mocks.sequenceFindFirst.mockResolvedValue(null)

    const res = await app.inject({ method: 'DELETE', url: `/${SEQUENCE_ID}` })
    expect(res.statusCode).toBe(404)
  })

  it('deletes sequence when found', async () => {
    mocks.sequenceFindFirst.mockResolvedValue(makeSequence())

    const res = await app.inject({ method: 'DELETE', url: `/${SEQUENCE_ID}` })
    expect(res.statusCode).toBe(204)
  })
})
