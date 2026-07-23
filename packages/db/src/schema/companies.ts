import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  smallint,
  bigint,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { workspaces } from './workspaces.js'

export const companyStatusEnum = pgEnum('company_status', [
  'new',
  'enriching',
  'enriched',
  'qualified',
  'low_quality',
  'contacted',
  'replied',
  'meeting',
  'proposal',
  'negotiation',
  'won',
  'closed_lost',
  'paused_30d',
  'opted_out',
])

export const companySourceEnum = pgEnum('company_source', [
  '2gis',
  'hhru',
  'csv',
  'manual',
  'api',
])

export const enrichmentStatusEnum = pgEnum('enrichment_status', [
  'pending',
  'in_progress',
  'done',
  'failed',
])

export const companies = pgTable(
  'companies',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),

    // Russian legal identifiers
    inn: varchar('inn', { length: 12 }),
    ogrn: varchar('ogrn', { length: 15 }),
    domain: varchar('domain', { length: 255 }),

    // Core
    name: varchar('name', { length: 500 }).notNull(),
    legalName: varchar('legal_name', { length: 500 }),
    industry: varchar('industry', { length: 100 }),
    okvedCode: varchar('okved_code', { length: 20 }),
    city: varchar('city', { length: 255 }),
    region: varchar('region', { length: 255 }),
    address: text('address'),

    // Size
    employeesCount: varchar('employees_count', { length: 50 }),
    revenueRub: bigint('revenue_rub', { mode: 'number' }),

    // Contacts
    phones: text('phones').array().notNull().default(sql`'{}'`),
    emails: text('emails').array().notNull().default(sql`'{}'`),
    website: text('website'),

    // Social
    linkedinUrl: text('linkedin_url'),
    vkUrl: text('vk_url'),
    telegramUrl: text('telegram_url'),

    // Sales pipeline
    status: companyStatusEnum('status').notNull().default('new'),
    icpScore: smallint('icp_score').notNull().default(0),

    // Enrichment
    enrichmentStatus: enrichmentStatusEnum('enrichment_status').notNull().default('pending'),
    enrichedAt: timestamp('enriched_at', { withTimezone: true }),
    enrichmentSources: jsonb('enrichment_sources').notNull().default(sql`'[]'`),

    // AI insights
    painPoints: text('pain_points').array().notNull().default(sql`'{}'`),
    techStack: text('tech_stack').array().notNull().default(sql`'{}'`),
    growthSignals: text('growth_signals').array().notNull().default(sql`'{}'`),
    aiSummary: text('ai_summary'),

    // Search Engine V4 — structured signals (full domain model with dates/weights/confidence)
    // Coexists with growthSignals (legacy text tags). signals is the V4 canonical store.
    signals: jsonb('signals').notNull().default(sql`'[]'`),

    // Search Engine V4 — denormalized contact candidates from Contact Discovery waterfall
    contacts: jsonb('contacts').notNull().default(sql`'[]'`),

    // Search Engine V4 — field-level provenance (which provider supplied each field)
    fieldProvenance: jsonb('field_provenance').notNull().default(sql`'{}'`),

    // Search Engine V4 — alternative names collected during dedup merges (ребрендинг etc.)
    aliases: jsonb('aliases').notNull().default(sql`'[]'`),

    // Meta
    source: companySourceEnum('source').notNull().default('manual'),
    sourceId: varchar('source_id', { length: 500 }),
    customFields: jsonb('custom_fields').notNull().default(sql`'{}'`),
    tags: text('tags').array().notNull().default(sql`'{}'`),

    // Soft delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [
    uniqueIndex('companies_workspace_inn_idx').on(table.workspaceId, table.inn).where(
      sql`${table.inn} IS NOT NULL`,
    ),
    uniqueIndex('companies_workspace_domain_idx').on(table.workspaceId, table.domain).where(
      sql`${table.domain} IS NOT NULL`,
    ),
    index('companies_workspace_idx').on(table.workspaceId),
    index('companies_icp_score_idx').on(table.workspaceId, table.icpScore),
    index('companies_industry_idx').on(table.workspaceId, table.industry),
    index('companies_city_idx').on(table.workspaceId, table.city),
    index('companies_status_idx').on(table.workspaceId, table.status),
    index('companies_enrichment_pending_idx')
      .on(table.workspaceId, table.createdAt)
      .where(sql`${table.enrichmentStatus} = 'pending'`),
    // Full-text search on Russian company names
    index('companies_fts_idx').using(
      'gin',
      sql`to_tsvector('russian', ${table.name} || ' ' || COALESCE(${table.legalName}, ''))`,
    ),
  ],
)

export type Company = typeof companies.$inferSelect
export type NewCompany = typeof companies.$inferInsert
