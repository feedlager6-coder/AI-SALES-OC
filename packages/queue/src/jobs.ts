/**
 * Canonical job type definitions.
 * All BullMQ queues and workers use these types.
 */

// ─── Queue Names ──────────────────────────────────────────────────────────────

export const QUEUES = {
  ENRICHMENT: 'enrichment-queue',
  EMAIL: 'email-queue',
  AI: 'ai-queue',
  SCRAPING: 'scraping-queue',
  NOTIFICATION: 'notification-queue',
  CONTACT_DISCOVERY: 'contact-discovery-queue',
} as const

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]

// ─── Job Names ────────────────────────────────────────────────────────────────

export const JOBS = {
  // Enrichment
  ENRICH_COMPANY: 'enrich_company',
  ENRICH_CONTACT: 'enrich_contact',
  RECALCULATE_ICP_SCORE: 'recalculate_icp_score',

  // Email
  SEND_EMAIL: 'send_email',
  PROCESS_WEBHOOK: 'process_webhook',
  SCHEDULE_SEQUENCE_STEP: 'schedule_sequence_step',

  // AI
  GENERATE_EMAIL: 'generate_email',
  CLASSIFY_REPLY: 'classify_reply',
  EXTRACT_COMPANY_INSIGHTS: 'extract_company_insights',

  // Scraping
  SEARCH_2GIS: 'search_2gis',
  SEARCH_HHRU: 'search_hhru',

  // Notifications
  NOTIFY_SDR: 'notify_sdr',

  // Contact Discovery (Pass 3)
  DISCOVER_CONTACTS: 'discover_contacts',
} as const

export type JobName = (typeof JOBS)[keyof typeof JOBS]

// ─── Job Payloads ─────────────────────────────────────────────────────────────

export interface EnrichCompanyPayload {
  workspaceId: string
  companyId: string
  priority?: 'normal' | 'high'
}

export interface EnrichContactPayload {
  workspaceId: string
  contactId: string
  companyId?: string
}

export interface RecalculateIcpScorePayload {
  workspaceId: string
  companyId: string
}

export interface SendEmailPayload {
  workspaceId: string
  enrollmentId: string
  stepNumber: number
  contactId: string
  emailAccountId: string
  scheduledAt: string // ISO8601
}

export interface ProcessWebhookPayload {
  provider: 'mailgun' | 'brevo' | 'ses'
  event: string
  messageId: string
  rawBody: unknown
}

export interface ScheduleSequenceStepPayload {
  workspaceId: string
  enrollmentId: string
  nextStep: number
  scheduledAt: string // ISO8601
  /** Preserve the original email account so follow-up steps use the same sender */
  emailAccountId?: string
}

export interface GenerateEmailPayload {
  workspaceId: string
  enrollmentId: string
  stepNumber: number
  companyId: string
  contactId: string
  templateSubject: string
  templateBody: string
}

export interface ClassifyReplyPayload {
  workspaceId: string
  enrollmentId: string
  emailSendId: string
  replyText: string
  replyFrom: string
}

export interface ExtractCompanyInsightsPayload {
  workspaceId: string
  companyId: string
  websiteContent?: string
  jobPostings?: string[]
}

export interface Search2GISPayload {
  workspaceId: string
  campaignId?: string
  rubrics: string[]
  city: string
  limit?: number
}

export interface SearchHHRuPayload {
  workspaceId: string
  campaignId?: string
  industries: string[]
  area?: string
  limit?: number
}

export interface NotifySdrPayload {
  workspaceId: string
  userId: string
  title: string
  message: string
  urgency: 'low' | 'normal' | 'high' | 'urgent'
  actions?: Array<{ label: string; action: string; data?: string }>
}

export interface ContactDiscoveryPayload {
  companyIds: string[]
  huntId: string
  workspaceId: string
  verticalContext: string
}

// ─── Job ID Factory ───────────────────────────────────────────────────────────

/**
 * Generates a deterministic job ID for deduplication.
 * BullMQ will reject a job if one with the same ID is already pending.
 */
export function makeJobId(jobName: JobName, ...parts: string[]): string {
  return `${jobName}:${parts.join(':')}`
}
