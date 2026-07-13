import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  numeric,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { workspaces } from './workspaces.js'
import { companies } from './companies.js'
import { enrichmentStatusEnum } from './companies.js'

export const contactSeniorityEnum = pgEnum('contact_seniority', [
  'c_level',
  'vp',
  'director',
  'manager',
  'individual',
])

export const emailStatusEnum = pgEnum('email_status', [
  'valid',
  'invalid',
  'catch_all',
  'unknown',
])

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),

    firstName: varchar('first_name', { length: 255 }),
    lastName: varchar('last_name', { length: 255 }),
    fullName: varchar('full_name', { length: 500 }),
    title: varchar('title', { length: 255 }),
    seniority: contactSeniorityEnum('seniority'),
    department: varchar('department', { length: 100 }),

    email: varchar('email', { length: 255 }),
    emailStatus: emailStatusEnum('email_status'),
    emailConfidence: numeric('email_confidence', { precision: 3, scale: 2 }),
    emailSource: varchar('email_source', { length: 50 }),
    phone: varchar('phone', { length: 50 }),
    linkedinUrl: text('linkedin_url'),
    telegram: varchar('telegram', { length: 100 }),

    enrichmentStatus: enrichmentStatusEnum('enrichment_status').notNull().default('pending'),
    enrichedAt: timestamp('enriched_at', { withTimezone: true }),

    optedOut: boolean('opted_out').notNull().default(false),
    optedOutAt: timestamp('opted_out_at', { withTimezone: true }),

    customFields: jsonb('custom_fields').notNull().default(sql`'{}'`),
    tags: text('tags').array().notNull().default(sql`'{}'`),

    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [
    uniqueIndex('contacts_workspace_email_idx').on(table.workspaceId, table.email).where(
      sql`${table.email} IS NOT NULL`,
    ),
    index('contacts_workspace_idx').on(table.workspaceId),
    index('contacts_company_idx').on(table.companyId),
    index('contacts_email_idx').on(table.workspaceId, table.email),
  ],
)

export type Contact = typeof contacts.$inferSelect
export type NewContact = typeof contacts.$inferInsert
