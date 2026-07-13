/**
 * CRM tables: deals, activities, tasks
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  smallint,
  bigint,
  boolean,
  date,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { workspaces } from './workspaces.js'
import { users } from './users.js'
import { companies } from './companies.js'
import { contacts } from './contacts.js'

// ─── Deals ────────────────────────────────────────────────────────────────────

export const dealStageEnum = pgEnum('deal_stage', [
  'new',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost',
])

export const deals = pgTable(
  'deals',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),

    title: varchar('title', { length: 500 }).notNull(),
    valueRub: bigint('value_rub', { mode: 'number' }),
    stage: dealStageEnum('stage').notNull().default('new'),
    probability: smallint('probability').notNull().default(0),
    expectedClose: date('expected_close'),

    lostReason: text('lost_reason'),
    wonAt: timestamp('won_at', { withTimezone: true }),
    lostAt: timestamp('lost_at', { withTimezone: true }),

    customFields: jsonb('custom_fields').notNull().default(sql`'{}'`),
    tags: text('tags').array().notNull().default(sql`'{}'`),

    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [
    index('deals_workspace_idx').on(table.workspaceId),
    index('deals_company_idx').on(table.companyId),
    index('deals_stage_idx').on(table.workspaceId, table.stage),
  ],
)

// ─── Activities ───────────────────────────────────────────────────────────────

export const activityTypeEnum = pgEnum('activity_type', [
  'email_sent',
  'email_opened',
  'email_clicked',
  'email_replied',
  'email_bounced',
  'call',
  'meeting',
  'note',
  'status_change',
  'enrichment_completed',
  'ai_classified',
  'task_created',
  'deal_created',
  'deal_stage_changed',
])

export const activityDirectionEnum = pgEnum('activity_direction', [
  'outbound',
  'inbound',
  'internal',
])

export const activities = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),

    type: activityTypeEnum('type').notNull(),
    direction: activityDirectionEnum('direction'),
    subject: text('subject'),
    body: text('body'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'`),

    performedBy: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
    automated: boolean('automated').notNull().default(false),

    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [
    index('activities_company_idx').on(table.companyId, table.occurredAt),
    index('activities_workspace_idx').on(table.workspaceId, table.occurredAt),
    index('activities_contact_idx').on(table.contactId),
  ],
)

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const taskTypeEnum = pgEnum('task_type', [
  'call',
  'email',
  'meeting',
  'proposal',
  'follow_up',
  'custom',
])

export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent'])
export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'in_progress',
  'completed',
  'snoozed',
  'cancelled',
])

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),

    type: taskTypeEnum('type').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    priority: taskPriorityEnum('priority').notNull().default('medium'),
    status: taskStatusEnum('status').notNull().default('pending'),

    dueAt: timestamp('due_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [
    index('tasks_workspace_idx').on(table.workspaceId),
    index('tasks_assigned_to_idx').on(table.assignedTo, table.status),
    index('tasks_company_idx').on(table.companyId),
  ],
)

export type Deal = typeof deals.$inferSelect
export type NewDeal = typeof deals.$inferInsert
export type Activity = typeof activities.$inferSelect
export type NewActivity = typeof activities.$inferInsert
export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
