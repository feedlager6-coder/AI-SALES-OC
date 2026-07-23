/**
 * Hunt — central entity of the Discover flow.
 *
 * Every user search request is persisted as a Hunt before the actual
 * search kicks off. This gives us:
 *   • full audit trail of every search session
 *   • a stable ID to attach search results and future provider logs to
 *   • a lifecycle to drive async enrichment workers
 *
 * Status machine:
 *   draft → confirmed → searching → completed
 *                    ↘               ↗
 *                      → failed ────
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { workspaces } from './workspaces.js'
import { users } from './users.js'

export const huntStatusEnum = pgEnum('hunt_status', [
  'draft',
  'confirmed',
  'searching',
  'completed',
  'failed',
])

export const hunts = pgTable(
  'hunts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** The raw natural-language query the user typed. */
    rawQuery: text('raw_query').notNull(),

    /**
     * Structured intent extracted by the Intent Interpreter.
     * Schema: { industry, region, companySize, clarifyingAnswer }
     */
    intentJson: jsonb('intent_json').notNull().default(sql`'{}'`),

    status: huntStatusEnum('status').notNull().default('draft'),

    // Search Engine V4 — summary of which providers were queried and their outcome
    searchPlanSummary: jsonb('search_plan_summary').default(sql`'{}'`),

    // Search Engine V4 — per-company rejection feedback from the user (adjusts ICP weights)
    rejectionFeedback: jsonb('rejection_feedback').notNull().default(sql`'[]'`),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [
    index('hunts_workspace_idx').on(table.workspaceId),
    index('hunts_created_by_idx').on(table.createdBy),
    index('hunts_status_idx').on(table.status),
  ],
)

export type Hunt = typeof hunts.$inferSelect
export type NewHunt = typeof hunts.$inferInsert
