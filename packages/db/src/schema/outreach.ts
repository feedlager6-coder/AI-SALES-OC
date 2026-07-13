/**
 * Outreach tables: campaigns, sequences, enrollments, email_sends, email_accounts
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  smallint,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { workspaces } from './workspaces.js'
import { users } from './users.js'
import { companies } from './companies.js'
import { contacts } from './contacts.js'

// ─── Campaigns ────────────────────────────────────────────────────────────────

export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft',
  'active',
  'paused',
  'completed',
  'archived',
])

export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),

    name: varchar('name', { length: 255 }).notNull(),
    status: campaignStatusEnum('status').notNull().default('draft'),
    vertical: varchar('vertical', { length: 100 }),

    icpFilter: jsonb('icp_filter').notNull().default(sql`'{}'`),
    sendingSettings: jsonb('sending_settings').notNull().default(sql`'{
      "days": [1,2,3,4,5],
      "time_from": "09:00",
      "time_to": "18:00",
      "timezone": "Europe/Moscow",
      "daily_limit": 100
    }'`),
    stats: jsonb('stats').notNull().default(sql`'{
      "enrolled": 0, "sent": 0, "opened": 0,
      "clicked": 0, "replied": 0, "meetings": 0
    }'`),

    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [
    index('campaigns_workspace_idx').on(table.workspaceId),
    index('campaigns_status_idx').on(table.workspaceId, table.status),
  ],
)

// ─── Sequences ────────────────────────────────────────────────────────────────

export const sequences = pgTable(
  'sequences',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    steps: jsonb('steps').notNull().default(sql`'[]'`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [index('sequences_campaign_idx').on(table.campaignId)],
)

// ─── Sequence Enrollments ─────────────────────────────────────────────────────

export const enrollmentStatusEnum = pgEnum('enrollment_status', [
  'active',
  'paused',
  'completed',
  'replied',
  'unsubscribed',
  'bounced',
  'stopped',
])

export const replyClassificationEnum = pgEnum('reply_classification', [
  'interested',
  'not_now',
  'not_interested',
  'out_of_office',
  'question',
  'other',
])

export const sequenceEnrollments = pgTable(
  'sequence_enrollments',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    sequenceId: uuid('sequence_id').references(() => sequences.id, { onDelete: 'restrict' }),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'restrict' }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),

    status: enrollmentStatusEnum('status').notNull().default('active'),
    currentStep: smallint('current_step').notNull().default(0),

    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().default(sql`now()`),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    replyAt: timestamp('reply_at', { withTimezone: true }),
    replyClassification: replyClassificationEnum('reply_classification'),
    pauseUntil: timestamp('pause_until', { withTimezone: true }),
  },
  (table) => [
    // A company can only be enrolled once per sequence
    uniqueIndex('enrollments_sequence_company_idx').on(table.sequenceId, table.companyId),
    index('enrollments_workspace_idx').on(table.workspaceId),
    index('enrollments_active_idx')
      .on(table.workspaceId, table.currentStep)
      .where(sql`${table.status} = 'active'`),
    index('enrollments_company_idx').on(table.companyId),
  ],
)

// ─── Email Sends ──────────────────────────────────────────────────────────────

export const emailSendStatusEnum = pgEnum('email_send_status', [
  'queued',
  'sent',
  'delivered',
  'bounced',
  'complained',
])

export const emailProviderEnum = pgEnum('email_provider', [
  'mailgun',
  'brevo',
  'ses',
  'smtp',
])

export const bounceTypeEnum = pgEnum('bounce_type', ['hard', 'soft'])

export const emailSends = pgTable(
  'email_sends',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull(),
    enrollmentId: uuid('enrollment_id').references(() => sequenceEnrollments.id, {
      onDelete: 'restrict',
    }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),

    stepNumber: smallint('step_number').notNull(),
    subject: text('subject'),
    bodyHtml: text('body_html'),
    bodyText: text('body_text'),
    fromEmail: varchar('from_email', { length: 255 }).notNull(),
    toEmail: varchar('to_email', { length: 255 }).notNull(),

    providerId: text('provider_id').unique(),
    provider: emailProviderEnum('provider'),

    status: emailSendStatusEnum('status').notNull().default('queued'),
    bounceType: bounceTypeEnum('bounce_type'),

    openedAt: timestamp('opened_at', { withTimezone: true }),
    clickedAt: timestamp('clicked_at', { withTimezone: true }),
    repliedAt: timestamp('replied_at', { withTimezone: true }),
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [
    index('email_sends_enrollment_idx').on(table.enrollmentId),
    index('email_sends_provider_id_idx').on(table.providerId, table.provider),
    index('email_sends_workspace_idx').on(table.workspaceId),
  ],
)

// ─── Email Accounts ───────────────────────────────────────────────────────────

export const warmupStatusEnum = pgEnum('warmup_status', [
  'not_started',
  'in_progress',
  'completed',
])

export const emailAccounts = pgTable(
  'email_accounts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    email: varchar('email', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }),
    provider: emailProviderEnum('provider').notNull(),
    credentialsEncrypted: text('credentials_encrypted'), // AES-256-GCM

    warmupEnabled: boolean('warmup_enabled').notNull().default(false),
    warmupStatus: warmupStatusEnum('warmup_status').notNull().default('not_started'),
    reputationScore: smallint('reputation_score'),

    dailyLimit: smallint('daily_limit').notNull().default(50),
    // sent_today is managed in Redis (RISK-001: race condition prevention)

    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [
    index('email_accounts_workspace_idx').on(table.workspaceId),
    uniqueIndex('email_accounts_workspace_email_idx').on(table.workspaceId, table.email),
  ],
)

export type Campaign = typeof campaigns.$inferSelect
export type NewCampaign = typeof campaigns.$inferInsert
export type Sequence = typeof sequences.$inferSelect
export type NewSequence = typeof sequences.$inferInsert
export type SequenceEnrollment = typeof sequenceEnrollments.$inferSelect
export type NewSequenceEnrollment = typeof sequenceEnrollments.$inferInsert
export type EmailSend = typeof emailSends.$inferSelect
export type NewEmailSend = typeof emailSends.$inferInsert
export type EmailAccount = typeof emailAccounts.$inferSelect
export type NewEmailAccount = typeof emailAccounts.$inferInsert
