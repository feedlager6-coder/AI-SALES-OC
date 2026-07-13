/**
 * System tables: enrichment_jobs, api_keys, ai_logs, audit_logs
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  smallint,
  integer,
  boolean,
  decimal,
  jsonb,
  char,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { workspaces } from './workspaces.js'
import { users } from './users.js'
import { companies } from './companies.js'
import { contacts } from './contacts.js'
import { enrichmentStatusEnum } from './companies.js'

// ─── Enrichment Jobs ──────────────────────────────────────────────────────────

export const enrichmentJobs = pgTable(
  'enrichment_jobs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'cascade' }),

    status: enrichmentStatusEnum('status').notNull().default('pending'),
    providersTried: jsonb('providers_tried').notNull().default(sql`'[]'`),
    results: jsonb('results').notNull().default(sql`'{}'`),
    error: text('error'),
    retryCount: smallint('retry_count').notNull().default(0),

    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [
    index('enrichment_jobs_workspace_idx').on(table.workspaceId),
    index('enrichment_jobs_company_idx').on(table.companyId),
    index('enrichment_jobs_status_idx').on(table.workspaceId, table.status),
  ],
)

// ─── API Keys (workspace-specific external API keys) ──────────────────────────

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    service: varchar('service', { length: 100 }).notNull(), // '2gis', 'openai', 'hunter', etc.
    keyEncrypted: text('key_encrypted').notNull(), // AES-256 encrypted
    label: varchar('label', { length: 255 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [
    uniqueIndex('api_keys_workspace_service_idx').on(table.workspaceId, table.service),
    index('api_keys_workspace_idx').on(table.workspaceId),
  ],
)

// ─── AI Logs ──────────────────────────────────────────────────────────────────

export const aiAgentEnum = pgEnum('ai_agent', [
  'writer',
  'classifier',
  'extractor',
  'icp_scorer',
  'custom',
])

export const aiLogs = pgTable(
  'ai_logs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull(),

    agent: aiAgentEnum('agent').notNull(),
    model: varchar('model', { length: 100 }).notNull(),
    provider: varchar('provider', { length: 50 }).notNull(),

    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    costUsd: decimal('cost_usd', { precision: 10, scale: 6 }).notNull().default('0'),
    latencyMs: integer('latency_ms').notNull().default(0),

    success: boolean('success').notNull().default(true),
    errorCode: varchar('error_code', { length: 100 }),

    inputHash: char('input_hash', { length: 64 }), // SHA-256 of prompt for dedup
    outputPreview: text('output_preview'), // First 300 chars

    entityType: varchar('entity_type', { length: 50 }), // 'company' | 'contact' | 'enrollment'
    entityId: uuid('entity_id'),

    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [
    index('ai_logs_workspace_idx').on(table.workspaceId, table.occurredAt),
    index('ai_logs_agent_idx').on(table.workspaceId, table.agent),
  ],
)

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

    action: varchar('action', { length: 100 }).notNull(), // 'company.create', 'campaign.start', etc.
    entityType: varchar('entity_type', { length: 50 }),
    entityId: uuid('entity_id'),

    oldValue: jsonb('old_value'),
    newValue: jsonb('new_value'),

    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),

    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [
    index('audit_logs_workspace_idx').on(table.workspaceId, table.occurredAt),
    index('audit_logs_entity_idx').on(table.entityType, table.entityId),
    index('audit_logs_user_idx').on(table.userId),
  ],
)

export type EnrichmentJob = typeof enrichmentJobs.$inferSelect
export type NewEnrichmentJob = typeof enrichmentJobs.$inferInsert
export type ApiKey = typeof apiKeys.$inferSelect
export type NewApiKey = typeof apiKeys.$inferInsert
export type AiLog = typeof aiLogs.$inferSelect
export type NewAiLog = typeof aiLogs.$inferInsert
export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
