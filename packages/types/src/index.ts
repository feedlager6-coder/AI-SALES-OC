/**
 * Shared TypeScript types across the AI Sales OS monorepo.
 * These are canonical — if another file disagrees, this file wins.
 */

// ─── Primitives ───────────────────────────────────────────────────────────────

export type UUID = string
export type ISO8601 = string
export type Email = string

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number
  limit?: number
  cursor?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    hasNextPage: boolean
    nextCursor?: string
  }
}

// ─── Workspace ────────────────────────────────────────────────────────────────

export type WorkspacePlan = 'trial' | 'starter' | 'pro' | 'enterprise'
export type WorkspaceSubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled'

export interface Workspace {
  id: UUID
  name: string
  slug: string
  plan: WorkspacePlan
  settings: WorkspaceSettings
  subscriptionStatus: WorkspaceSubscriptionStatus
  trialEndsAt: ISO8601 | null
  createdAt: ISO8601
  updatedAt: ISO8601
}

export interface WorkspaceSettings {
  featureFlags?: Record<string, boolean>
  dailyEmailLimit?: number
  uiPrefs?: Record<string, unknown>
}

// ─── User ─────────────────────────────────────────────────────────────────────

export type UserRole = 'owner' | 'admin' | 'manager' | 'sdr'
export type UserStatus = 'active' | 'suspended' | 'deleted'

export interface User {
  id: UUID
  workspaceId: UUID
  email: Email
  name: string | null
  role: UserRole
  avatarUrl: string | null
  telegramChatId: string | null
  status: UserStatus
  lastLoginAt: ISO8601 | null
  createdAt: ISO8601
}

// ─── Company ──────────────────────────────────────────────────────────────────

export type CompanyStatus =
  | 'new'
  | 'enriching'
  | 'enriched'
  | 'qualified'
  | 'low_quality'
  | 'contacted'
  | 'replied'
  | 'meeting'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'closed_lost'
  | 'paused_30d'
  | 'opted_out'

export type CompanySource = '2gis' | 'hhru' | 'csv' | 'manual' | 'api'
export type EnrichmentStatus = 'pending' | 'in_progress' | 'done' | 'failed'
export type EmployeesCount = '1-10' | '10-50' | '50-200' | '200-1000' | '1000+'

export interface EnrichmentSource {
  source: string
  fields: string[]
  at: ISO8601
}

export interface Company {
  id: UUID
  workspaceId: UUID

  // Identifiers
  inn: string | null
  ogrn: string | null
  domain: string | null

  // Core data
  name: string
  legalName: string | null
  industry: string | null
  okvedCode: string | null
  city: string | null
  region: string | null
  address: string | null

  // Size
  employeesCount: EmployeesCount | null
  revenueRub: number | null

  // Contacts
  phones: string[]
  emails: string[]
  website: string | null

  // Social
  linkedinUrl: string | null
  vkUrl: string | null
  telegramUrl: string | null

  // Sales
  status: CompanyStatus
  icpScore: number

  // Enrichment
  enrichmentStatus: EnrichmentStatus
  enrichedAt: ISO8601 | null
  enrichmentSources: EnrichmentSource[]

  // AI insights
  painPoints: string[]
  techStack: string[]
  growthSignals: string[]
  aiSummary: string | null

  // Meta
  source: CompanySource
  sourceId: string | null
  customFields: Record<string, unknown>
  tags: string[]

  // Soft delete
  deletedAt: ISO8601 | null
  createdAt: ISO8601
  updatedAt: ISO8601
}

// ─── Contact ──────────────────────────────────────────────────────────────────

export type ContactSeniority = 'c_level' | 'vp' | 'director' | 'manager' | 'individual'
export type EmailStatus = 'valid' | 'invalid' | 'catch_all' | 'unknown'

export interface Contact {
  id: UUID
  workspaceId: UUID
  companyId: UUID | null

  firstName: string | null
  lastName: string | null
  fullName: string | null
  title: string | null
  seniority: ContactSeniority | null
  department: string | null

  email: Email | null
  emailStatus: EmailStatus | null
  emailConfidence: number | null
  emailSource: string | null
  phone: string | null
  linkedinUrl: string | null
  telegram: string | null

  enrichmentStatus: EnrichmentStatus
  enrichedAt: ISO8601 | null

  optedOut: boolean
  optedOutAt: ISO8601 | null

  customFields: Record<string, unknown>
  tags: string[]
  deletedAt: ISO8601 | null
  createdAt: ISO8601
  updatedAt: ISO8601
}

// ─── Deal ─────────────────────────────────────────────────────────────────────

export type DealStage = 'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'

export interface Deal {
  id: UUID
  workspaceId: UUID
  companyId: UUID | null
  contactId: UUID | null
  assignedTo: UUID | null

  title: string
  valueRub: number | null
  stage: DealStage
  probability: number
  expectedClose: string | null

  lostReason: string | null
  wonAt: ISO8601 | null
  lostAt: ISO8601 | null

  customFields: Record<string, unknown>
  tags: string[]
  deletedAt: ISO8601 | null
  createdAt: ISO8601
  updatedAt: ISO8601
}

// ─── Activity ────────────────────────────────────────────────────────────────

export type ActivityType =
  | 'email_sent'
  | 'email_opened'
  | 'email_clicked'
  | 'email_replied'
  | 'email_bounced'
  | 'call'
  | 'meeting'
  | 'note'
  | 'status_change'
  | 'enrichment_completed'
  | 'ai_classified'
  | 'task_created'
  | 'deal_created'
  | 'deal_stage_changed'

export type ActivityDirection = 'outbound' | 'inbound' | 'internal'

export interface Activity {
  id: UUID
  workspaceId: UUID
  companyId: UUID | null
  contactId: UUID | null
  dealId: UUID | null

  type: ActivityType
  direction: ActivityDirection | null
  subject: string | null
  body: string | null
  metadata: Record<string, unknown>

  performedBy: UUID | null
  automated: boolean
  occurredAt: ISO8601
}

// ─── Campaign ────────────────────────────────────────────────────────────────

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived'

export interface CampaignSendingSettings {
  days: number[] // 0=Sun, 1=Mon, ..., 6=Sat
  timeFrom: string // 'HH:MM'
  timeTo: string // 'HH:MM'
  timezone: string // IANA tz e.g. 'Europe/Moscow'
  dailyLimit: number
}

export interface CampaignStats {
  enrolled: number
  sent: number
  opened: number
  clicked: number
  replied: number
  meetings: number
}

export interface Campaign {
  id: UUID
  workspaceId: UUID
  createdBy: UUID

  name: string
  status: CampaignStatus
  vertical: string | null
  icpFilter: Record<string, unknown>
  sendingSettings: CampaignSendingSettings
  stats: CampaignStats

  startedAt: ISO8601 | null
  endedAt: ISO8601 | null
  createdAt: ISO8601
}

// ─── Sequence ─────────────────────────────────────────────────────────────────

export interface SequenceStep {
  order: number
  type: 'email' | 'task' | 'wait'
  delayDays: number
  delayHours?: number
  condition?: {
    if: 'opened' | 'not_opened' | 'clicked'
    then: 'continue' | 'skip' | 'stop'
  }
  // For type='email'
  subjectTemplate?: string
  bodyTemplate?: string
  aiPersonalize?: boolean
  fromAccountId?: UUID
}

export interface Sequence {
  id: UUID
  workspaceId: UUID
  campaignId: UUID
  name: string
  steps: SequenceStep[]
}

// ─── SequenceEnrollment ───────────────────────────────────────────────────────

export type EnrollmentStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'replied'
  | 'unsubscribed'
  | 'bounced'
  | 'stopped'

export type ReplyClassification =
  | 'interested'
  | 'not_now'
  | 'not_interested'
  | 'out_of_office'
  | 'question'
  | 'other'

export interface SequenceEnrollment {
  id: UUID
  workspaceId: UUID
  sequenceId: UUID
  companyId: UUID
  contactId: UUID | null

  status: EnrollmentStatus
  currentStep: number

  enrolledAt: ISO8601
  completedAt: ISO8601 | null
  replyAt: ISO8601 | null
  replyClassification: ReplyClassification | null
  pauseUntil: ISO8601 | null
}

// ─── EmailSend ────────────────────────────────────────────────────────────────

export type EmailSendStatus = 'queued' | 'sent' | 'delivered' | 'bounced' | 'complained'
export type EmailProvider = 'mailgun' | 'brevo' | 'ses' | 'smtp'
export type BounceType = 'hard' | 'soft'

export interface EmailSend {
  id: UUID
  workspaceId: UUID
  enrollmentId: UUID
  contactId: UUID | null

  stepNumber: number
  subject: string | null
  bodyHtml: string | null
  bodyText: string | null
  fromEmail: Email
  toEmail: Email

  providerId: string | null
  provider: EmailProvider | null

  status: EmailSendStatus
  bounceType: BounceType | null

  openedAt: ISO8601 | null
  clickedAt: ISO8601 | null
  repliedAt: ISO8601 | null
  unsubscribedAt: ISO8601 | null
  sentAt: ISO8601 | null
  createdAt: ISO8601
}

// ─── Task ────────────────────────────────────────────────────────────────────

export type TaskType = 'call' | 'email' | 'meeting' | 'proposal' | 'follow_up' | 'custom'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'snoozed' | 'cancelled'

export interface Task {
  id: UUID
  workspaceId: UUID
  assignedTo: UUID | null
  createdBy: UUID | null
  companyId: UUID | null
  contactId: UUID | null

  type: TaskType
  title: string
  description: string | null
  priority: TaskPriority
  status: TaskStatus

  dueAt: ISO8601 | null
  completedAt: ISO8601 | null
  snoozedUntil: ISO8601 | null
  createdAt: ISO8601
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiError {
  error: {
    code: string
    message: string
    statusCode: number
    details?: unknown
  }
}

export interface ApiSuccess<T = void> {
  data: T
  meta?: Record<string, unknown>
}
