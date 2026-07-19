/**
 * Typed API client for communicating with the Fastify backend.
 * Uses fetch with credentials for session cookie forwarding.
 * BASE_URL is empty string so all requests go through the Next.js rewrite proxy.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

export class ApiError extends Error {
  readonly statusCode: number
  readonly code: string

  constructor(message: string, statusCode: number, code: string) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  // 204 No Content — do not attempt to parse an empty body
  if (response.status === 204) {
    if (!response.ok) {
      throw new ApiError('Request failed', response.status, 'UNKNOWN')
    }
    return undefined as unknown as T
  }

  const data = await response.json()

  if (!response.ok) {
    const err = data?.error
    throw new ApiError(
      err?.message ?? 'Unexpected error',
      response.status,
      err?.code ?? 'UNKNOWN',
    )
  }

  return data
}

// ─── Pagination meta ──────────────────────────────────────────────────────────

export interface PageMeta {
  total: number
  page: number
  limit: number
  hasNextPage: boolean
}

export interface PagedResponse<T> {
  data: T[]
  meta: PageMeta
}

// ─── Company types ────────────────────────────────────────────────────────────

export interface Company {
  id: string
  workspaceId: string
  name: string
  legalName: string | null
  inn: string | null
  ogrn: string | null
  domain: string | null
  industry: string | null
  city: string | null
  region: string | null
  address: string | null
  website: string | null
  phones: string[]
  emails: string[]
  status: string
  icpScore: number
  enrichmentStatus: string
  source: string
  tags: string[]
  employeesCount: string | null
  revenueRub: number | null
  enrichedAt: string | null
  createdAt: string
  updatedAt: string
  _counts?: { contacts: number; activities: number }
}

export interface CompanyFilters {
  page?: number
  limit?: number
  status?: string
  city?: string
  industry?: string
  search?: string
  icpMin?: number
  icpMax?: number
  source?: string
}

// ─── Lead source types ────────────────────────────────────────────────────────

export interface LeadSourceSearchBody {
  source: '2gis' | 'hhru'
  city: string
  industry?: string
  keywords?: string[]
  limit?: number
}

export interface LeadSearchJob {
  jobId: string
  source: string
  status: string
  city?: string
}

export interface LeadSearchJobStatus {
  jobId: string
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'
  progress: number
  result?: { companiesFound: number; companiesImported: number; companiesSkipped: number }
  failedReason?: string
  processedAt?: string
  finishedAt?: string
}

export interface CreateCompanyBody {
  name: string
  inn?: string
  domain?: string
  legalName?: string
  industry?: string
  city?: string
  region?: string
  address?: string
  website?: string
  phones?: string[]
  emails?: string[]
  source?: string
  tags?: string[]
  employeesCount?: string
  revenueRub?: number
}

// ─── Contact types ────────────────────────────────────────────────────────────

export interface Contact {
  id: string
  workspaceId: string
  companyId: string | null
  firstName: string | null
  lastName: string | null
  fullName: string | null
  title: string | null
  seniority: string | null
  department: string | null
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  telegram: string | null
  enrichmentStatus: string
  optedOut: boolean
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface CreateContactBody {
  companyId?: string
  firstName?: string
  lastName?: string
  fullName?: string
  title?: string
  seniority?: string
  department?: string
  email?: string
  phone?: string
  linkedinUrl?: string
  telegram?: string
  tags?: string[]
}

// ─── Deal types ───────────────────────────────────────────────────────────────

export interface Deal {
  id: string
  workspaceId: string
  companyId: string | null
  contactId: string | null
  title: string
  valueRub: number | null
  stage: string
  probability: number
  expectedClose: string | null
  lostReason: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

// ─── Activity types ───────────────────────────────────────────────────────────

export interface Activity {
  id: string
  workspaceId: string
  companyId: string | null
  contactId: string | null
  dealId: string | null
  type: string
  direction: string | null
  subject: string | null
  body: string | null
  automated: boolean
  occurredAt: string
}

// ─── Import result ────────────────────────────────────────────────────────────

export interface ImportResult {
  imported: number
  skipped: number
  errors: Array<{ index: number; reason: string }>
}

// ─── API methods ──────────────────────────────────────────────────────────────

export const api = {
  // Generic
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  // Companies
  companies: {
    list: (filters?: CompanyFilters) => {
      const params = new URLSearchParams()
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined && v !== '') params.set(k, String(v))
        })
      }
      const qs = params.toString()
      return request<PagedResponse<Company>>(`/api/companies${qs ? `?${qs}` : ''}`)
    },
    get: (id: string) => request<{ data: Company }>(`/api/companies/${id}`),
    create: (body: CreateCompanyBody) =>
      request<{ data: Company }>('/api/companies', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Partial<CreateCompanyBody>) =>
      request<{ data: Company }>(`/api/companies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id: string) => request<void>(`/api/companies/${id}`, { method: 'DELETE' }),
    enrich: (id: string) =>
      request<{ data: { id: string; enrichmentStatus: string } }>(`/api/companies/${id}/enrich`, {
        method: 'POST',
      }),
    import: (companies: CreateCompanyBody[]) =>
      request<{ data: ImportResult }>('/api/companies/import', {
        method: 'POST',
        body: JSON.stringify({ companies }),
      }),
    contacts: (id: string) =>
      request<{ data: Contact[] }>(`/api/companies/${id}/contacts`),
    activities: (id: string) =>
      request<{ data: Activity[] }>(`/api/companies/${id}/activities`),
    addActivity: (
      id: string,
      body: { type: 'call' | 'meeting' | 'note'; subject?: string; body?: string; contactId?: string },
    ) =>
      request<{ data: Activity }>(`/api/companies/${id}/activities`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },

  // Contacts
  contacts: {
    list: (filters?: { page?: number; limit?: number; companyId?: string; search?: string }) => {
      const params = new URLSearchParams()
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined && v !== '') params.set(k, String(v))
        })
      }
      const qs = params.toString()
      return request<PagedResponse<Contact>>(`/api/contacts${qs ? `?${qs}` : ''}`)
    },
    get: (id: string) => request<{ data: Contact }>(`/api/contacts/${id}`),
    create: (body: CreateContactBody) =>
      request<{ data: Contact }>('/api/contacts', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Partial<CreateContactBody>) =>
      request<{ data: Contact }>(`/api/contacts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id: string) => request<void>(`/api/contacts/${id}`, { method: 'DELETE' }),
  },

  // Deals
  deals: {
    list: (filters?: { page?: number; limit?: number; stage?: string; companyId?: string }) => {
      const params = new URLSearchParams()
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined) params.set(k, String(v))
        })
      }
      const qs = params.toString()
      return request<PagedResponse<Deal>>(`/api/deals${qs ? `?${qs}` : ''}`)
    },
    get: (id: string) => request<{ data: Deal }>(`/api/deals/${id}`),
    create: (body: {
      title: string
      companyId?: string
      stage?: string
      valueRub?: number
      probability?: number
    }) =>
      request<{ data: Deal }>('/api/deals', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Record<string, unknown>) =>
      request<{ data: Deal }>(`/api/deals/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id: string) => request<void>(`/api/deals/${id}`, { method: 'DELETE' }),
  },

  // Lead Sources (Sprint 1.3)
  leadSources: {
    search: (body: LeadSourceSearchBody) =>
      request<{ data: LeadSearchJob }>('/api/lead-sources/search', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    jobStatus: (jobId: string) =>
      request<{ data: LeadSearchJobStatus }>(`/api/lead-sources/jobs/${jobId}`),
    providers: () =>
      request<{ data: Array<{ id: string; name: string; description: string; requiresApiKey: boolean }> }>(
        '/api/lead-sources/providers',
      ),
  },

  // Email Accounts (Sprint 1.4)
  emailAccounts: {
    list: () => request<{ data: EmailAccount[] }>('/api/email-accounts'),
    get: (id: string) => request<{ data: EmailAccount }>(`/api/email-accounts/${id}`),
    create: (body: CreateEmailAccountBody) =>
      request<{ data: EmailAccount }>('/api/email-accounts', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: { displayName?: string; dailyLimit?: number; isActive?: boolean; credentials?: CreateEmailAccountBody['credentials'] }) =>
      request<{ data: EmailAccount }>(`/api/email-accounts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id: string) => request<void>(`/api/email-accounts/${id}`, { method: 'DELETE' }),
  },

  // Campaigns (Sprint 1.4)
  campaigns: {
    list: (filters?: CampaignFilters) => {
      const params = new URLSearchParams()
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined && v !== '') params.set(k, String(v))
        })
      }
      const qs = params.toString()
      return request<PagedResponse<Campaign>>(`/api/campaigns${qs ? `?${qs}` : ''}`)
    },
    get: (id: string) => request<{ data: Campaign & { sequences: Sequence[] } }>(`/api/campaigns/${id}`),
    create: (body: CreateCampaignBody) =>
      request<{ data: Campaign }>('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Partial<CreateCampaignBody>) =>
      request<{ data: Campaign }>(`/api/campaigns/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id: string) => request<void>(`/api/campaigns/${id}`, { method: 'DELETE' }),
    start: (id: string) => request<{ data: Campaign }>(`/api/campaigns/${id}/start`, { method: 'POST' }),
    pause: (id: string) => request<{ data: Campaign }>(`/api/campaigns/${id}/pause`, { method: 'POST' }),
    stop: (id: string) => request<{ data: Campaign }>(`/api/campaigns/${id}/stop`, { method: 'POST' }),
    enrollments: (id: string, filters?: { page?: number; limit?: number; status?: string }) => {
      const params = new URLSearchParams()
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined) params.set(k, String(v))
        })
      }
      const qs = params.toString()
      return request<PagedResponse<SequenceEnrollment>>(`/api/campaigns/${id}/enrollments${qs ? `?${qs}` : ''}`)
    },
    enroll: (id: string, body: { companyIds: string[]; sequenceId: string; contactId?: string }) =>
      request<{ data: { enrolled: number; skipped: number; total: number } }>(`/api/campaigns/${id}/enroll`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },

  // Sequences (Sprint 1.4)
  sequences: {
    list: (filters?: { page?: number; limit?: number; campaignId?: string }) => {
      const params = new URLSearchParams()
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined) params.set(k, String(v))
        })
      }
      const qs = params.toString()
      return request<PagedResponse<Sequence>>(`/api/sequences${qs ? `?${qs}` : ''}`)
    },
    get: (id: string) => request<{ data: Sequence }>(`/api/sequences/${id}`),
    create: (body: CreateSequenceBody) =>
      request<{ data: Sequence }>('/api/sequences', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Partial<CreateSequenceBody>) =>
      request<{ data: Sequence }>(`/api/sequences/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id: string) => request<void>(`/api/sequences/${id}`, { method: 'DELETE' }),
  },

  // Workspace
  workspace: {
    me: () => request<{ data: { id: string; name: string; plan: string } }>('/api/workspaces/me'),
  },
}

// ─── Sprint 1.4 types ─────────────────────────────────────────────────────────

export interface EmailAccount {
  id: string
  workspaceId: string
  email: string
  displayName: string | null
  provider: 'mailgun' | 'brevo' | 'ses' | 'smtp'
  dailyLimit: number
  warmupStatus: string
  reputationScore: number | null
  isActive: boolean
  createdAt: string
}

export interface CreateEmailAccountBody {
  email: string
  displayName?: string
  provider: 'mailgun' | 'brevo' | 'ses' | 'smtp'
  credentials: {
    apiKey?: string
    domain?: string
    smtpHost?: string
    smtpPort?: number
    smtpUser?: string
    smtpPassword?: string
    smtpSecure?: boolean
  }
  dailyLimit?: number
}

export interface Campaign {
  id: string
  workspaceId: string
  createdBy: string | null
  name: string
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived'
  vertical: string | null
  icpFilter: Record<string, unknown>
  sendingSettings: {
    days: number[]
    time_from: string
    time_to: string
    timezone: string
    daily_limit: number
  }
  stats: {
    enrolled: number
    sent: number
    opened: number
    clicked: number
    replied: number
    meetings: number
  }
  startedAt: string | null
  endedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CampaignFilters {
  page?: number
  limit?: number
  status?: string
}

export interface CreateCampaignBody {
  name: string
  vertical?: string
  icpFilter?: Record<string, unknown>
  sendingSettings?: {
    days?: number[]
    time_from?: string
    time_to?: string
    timezone?: string
    daily_limit?: number
  }
}

export interface SequenceStep {
  stepNumber: number
  type: 'email' | 'wait'
  subject?: string
  bodyHtml?: string
  bodyText?: string
  delayDays?: number
  delayHours?: number
  stopOnReply?: boolean
  stopOnClick?: boolean
}

export interface Sequence {
  id: string
  workspaceId: string
  campaignId: string | null
  name: string
  steps: SequenceStep[]
  createdAt: string
  updatedAt: string
}

export interface CreateSequenceBody {
  name: string
  campaignId: string
  steps: SequenceStep[]
}

export interface SequenceEnrollment {
  id: string
  workspaceId: string
  sequenceId: string | null
  companyId: string | null
  contactId: string | null
  status: 'active' | 'paused' | 'completed' | 'replied' | 'unsubscribed' | 'bounced' | 'stopped'
  currentStep: number
  enrolledAt: string
  completedAt: string | null
  replyAt: string | null
  replyClassification: string | null
}
