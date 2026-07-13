import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const workspacePlanEnum = pgEnum('workspace_plan', [
  'trial',
  'starter',
  'pro',
  'enterprise',
])

export const workspaceSubscriptionStatusEnum = pgEnum('workspace_subscription_status', [
  'trialing',
  'active',
  'past_due',
  'canceled',
])

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  plan: workspacePlanEnum('plan').notNull().default('trial'),
  settings: jsonb('settings').notNull().default(sql`'{}'`),
  subscriptionStatus: workspaceSubscriptionStatusEnum('subscription_status')
    .notNull()
    .default('trialing'),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
})

export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert
