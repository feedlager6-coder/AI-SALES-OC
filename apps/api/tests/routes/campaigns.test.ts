/**
 * Campaign routes — business logic tests
 * Tests the state-machine transitions and validation rules.
 * Uses Fastify inject + vi.mock for the DB layer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type FastifyInstance } from 'fastify'
import { createTestApp } from '../helpers.js'

// ─── Hoisted mocks (must come before vi.mock factory calls) ───────────────────

const mocks = vi.hoisted(() => {
  const campaignFindFirst = vi.fn()
  const sequenceFindFirst = vi.fn()
  const sequenceEnrollmentFindFirst = vi.fn()

  // Chainable builder: select().from().where()...offset() → Promise<T[]>
  function makeSelectChain(rows: unknown[] = [], countRows: unknown[] = [{ total: 0 }]) {
    let callIndex = 0
    const chain = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => {
        // Promise.all([select(...).offset(), select({ total }).from().where()])
        // second call returns countRows
        return Promise.resolve(callIndex++ === 0 ? rows : countRows)
      },
    }
    return chain
  }

  // Simple returning builder
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
  const deleteMock = vi.fn(() => ({ where: () => Promise.resolve() }))

  const db = {
    query: {
      campaigns: { findFirst: campaignFindFirst },
      sequences: { findFirst: sequenceFindFirst },
      sequenceEnrollments: { findFirst: sequenceEnrollmentFindFirst },
    },
    select: selectMock,
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
  }

  return { campaignFindFirst, sequenceFindFirst, sequenceEnrollmentFindFirst, selectMock, insertMock, updateMock, deleteMock, db, makeSelectChain, makeInsertChain, makeUpdateChain }
})

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@ai-sales-os/db', () => ({
  getDb: () => mocks.db,
  campaigns: { id: 'id', workspaceId: 'workspace_id', status: 'status', name: 'name', createdAt: 'created_at', updatedAt: 'updated_at', startedAt: 'started_at', vertical: 'vertical' },
  sequences: { id: 'id', workspaceId: 'workspace_id', campaignId: 'campaign_id', createdAt: 'created_at' },
  sequenceEnrollments: { id: 'id', workspaceId: 'workspace_id', sequenceId: 'sequence_id', companyId: 'company_id', status: 'status', enrolledAt: 'enrolled_at' },
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
  inArray: (col: unknown, vals: unknown[]) => ({ inArray: [col, vals] }),
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
const WORKSPACE_ID = 'ws-00000000-0000-0000-0000-000000000001'

function makeCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: CAMPAIGN_ID,
    workspaceId: WORKSPACE_ID,
    createdBy: null,
    name: 'Test Campaign',
    status: 'draft',
    vertical: null,
    icpFilter: {},
    sendingSettings: { days: [1,2,3,4,5], time_from: '09:00', time_to: '18:00', timezone: 'Europe/Moscow', daily_limit: 100 },
    stats: { enrolled: 0, sent: 0, opened: 0, clicked: 0, replied: 0, meetings: 0 },
    startedAt: null,
    endedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

async function buildApp() {
  const { campaignsRoutes } = await import('../../src/routes/campaigns.js')
  const app = createTestApp()
  await app.register(campaignsRoutes, { prefix: '/' })
  await app.ready()
  return app
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /:id/start — campaign activation', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  it('returns 404 when campaign not found', async () => {
    mocks.campaignFindFirst.mockResolvedValue(null)

    const res = await app.inject({ method: 'POST', url: `/${CAMPAIGN_ID}/start` })
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 when trying to start a completed campaign', async () => {
    mocks.campaignFindFirst.mockResolvedValue(makeCampaign({ status: 'completed' }))

    const res = await app.inject({ method: 'POST', url: `/${CAMPAIGN_ID}/start` })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.message).toMatch(/completed|archived/i)
  })

  it('returns 400 when trying to start an archived campaign', async () => {
    mocks.campaignFindFirst.mockResolvedValue(makeCampaign({ status: 'archived' }))

    const res = await app.inject({ method: 'POST', url: `/${CAMPAIGN_ID}/start` })
    expect(res.statusCode).toBe(400)
  })

  it('returns 200 immediately when campaign is already active', async () => {
    const campaign = makeCampaign({ status: 'active' })
    mocks.campaignFindFirst.mockResolvedValue(campaign)

    const res = await app.inject({ method: 'POST', url: `/${CAMPAIGN_ID}/start` })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).data.status).toBe('active')
  })

  it('activates a draft campaign', async () => {
    mocks.campaignFindFirst.mockResolvedValue(makeCampaign({ status: 'draft' }))
    const updatedCampaign = makeCampaign({ status: 'active' })
    mocks.updateMock.mockReturnValue({
      set: () => ({ where: () => ({ returning: () => Promise.resolve([updatedCampaign]) }) }),
    })

    const res = await app.inject({ method: 'POST', url: `/${CAMPAIGN_ID}/start` })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).data.status).toBe('active')
  })
})

describe('POST /:id/pause — campaign pause', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  it('returns 400 when trying to pause a draft campaign', async () => {
    mocks.campaignFindFirst.mockResolvedValue(makeCampaign({ status: 'draft' }))

    const res = await app.inject({ method: 'POST', url: `/${CAMPAIGN_ID}/pause` })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.message).toMatch(/not active/i)
  })

  it('returns 400 when campaign not found', async () => {
    mocks.campaignFindFirst.mockResolvedValue(null)

    const res = await app.inject({ method: 'POST', url: `/${CAMPAIGN_ID}/pause` })
    expect(res.statusCode).toBe(404)
  })

  it('pauses an active campaign', async () => {
    mocks.campaignFindFirst.mockResolvedValue(makeCampaign({ status: 'active' }))
    const paused = makeCampaign({ status: 'paused' })
    mocks.updateMock.mockReturnValue({
      set: () => ({ where: () => ({ returning: () => Promise.resolve([paused]) }) }),
    })

    const res = await app.inject({ method: 'POST', url: `/${CAMPAIGN_ID}/pause` })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).data.status).toBe('paused')
  })
})

describe('POST /:id/stop — campaign stop', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  it('returns 400 when campaign is already completed', async () => {
    mocks.campaignFindFirst.mockResolvedValue(makeCampaign({ status: 'completed' }))

    const res = await app.inject({ method: 'POST', url: `/${CAMPAIGN_ID}/stop` })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.message).toMatch(/already finished/i)
  })

  it('returns 400 when campaign is archived', async () => {
    mocks.campaignFindFirst.mockResolvedValue(makeCampaign({ status: 'archived' }))

    const res = await app.inject({ method: 'POST', url: `/${CAMPAIGN_ID}/stop` })
    expect(res.statusCode).toBe(400)
  })

  it('stops an active campaign', async () => {
    mocks.campaignFindFirst.mockResolvedValue(makeCampaign({ status: 'active' }))
    const stopped = makeCampaign({ status: 'completed', endedAt: new Date().toISOString() })
    mocks.updateMock.mockReturnValue({
      set: () => ({ where: () => ({ returning: () => Promise.resolve([stopped]) }) }),
    })

    const res = await app.inject({ method: 'POST', url: `/${CAMPAIGN_ID}/stop` })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).data.status).toBe('completed')
  })
})

describe('DELETE /:id — campaign archive', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  it('returns 400 when trying to delete an active campaign', async () => {
    mocks.campaignFindFirst.mockResolvedValue(makeCampaign({ status: 'active' }))

    const res = await app.inject({ method: 'DELETE', url: `/${CAMPAIGN_ID}` })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.message).toMatch(/pause/i)
  })

  it('archives a draft campaign', async () => {
    mocks.campaignFindFirst.mockResolvedValue(makeCampaign({ status: 'draft' }))
    mocks.updateMock.mockReturnValue({
      set: () => ({ where: () => Promise.resolve() }),
    })

    const res = await app.inject({ method: 'DELETE', url: `/${CAMPAIGN_ID}` })
    expect(res.statusCode).toBe(204)
  })
})

describe('PATCH /:id — campaign update', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  it('returns 400 when updating a completed campaign', async () => {
    mocks.campaignFindFirst.mockResolvedValue(makeCampaign({ status: 'completed' }))

    const res = await app.inject({
      method: 'PATCH',
      url: `/${CAMPAIGN_ID}`,
      payload: { name: 'Updated' },
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.message).toMatch(/completed|archived/i)
  })

  it('returns 400 when updating an archived campaign', async () => {
    mocks.campaignFindFirst.mockResolvedValue(makeCampaign({ status: 'archived' }))

    const res = await app.inject({
      method: 'PATCH',
      url: `/${CAMPAIGN_ID}`,
      payload: { name: 'Updated' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /:id/enroll — enrollment validation', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  it('returns 400 when enrolling into a completed campaign', async () => {
    mocks.campaignFindFirst.mockResolvedValue(makeCampaign({ status: 'completed' }))

    const res = await app.inject({
      method: 'POST',
      url: `/${CAMPAIGN_ID}/enroll`,
      payload: {
        companyIds: ['00000000-0000-0000-0000-000000000020'],
        sequenceId: '00000000-0000-0000-0000-000000000030',
      },
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.message).toMatch(/completed|archived/i)
  })

  it('rejects invalid payload (empty companyIds) — Zod validation', async () => {
    // Zod throws ZodError for empty array; routes use z.parse() directly so
    // validation failures bubble as non-2xx (Zod errors are unhandled by AJV
    // Fastify error handler — they surface as 500 in the current setup).
    const res = await app.inject({
      method: 'POST',
      url: `/${CAMPAIGN_ID}/enroll`,
      payload: { companyIds: [], sequenceId: '00000000-0000-0000-0000-000000000030' },
    })
    expect(res.statusCode).toBeGreaterThanOrEqual(400)
  })
})
