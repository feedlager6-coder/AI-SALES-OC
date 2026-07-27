/**
 * Better Auth server instance — runs directly in the Next.js web process.
 *
 * Auth endpoints (/api/auth/*) are handled by Next.js Route Handlers,
 * not by the Fastify API server. This eliminates the proxy hop for auth,
 * removes INTERNAL_API_URL as a source of auth failures, and ensures cookies
 * are always set on the web domain without cross-domain tricks.
 *
 * The Fastify API keeps its own Better Auth instance (same DB, same secret)
 * solely for session validation on business routes via workspace-context.ts.
 */

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { getDb, workspaces } from '@ai-sales-os/db'
import * as schema from '@ai-sales-os/db/schema'

/**
 * Derive a unique workspace slug from the user's email.
 * e.g. user@company.com → company-a1b2
 */
function deriveWorkspaceSlug(email: string): string {
  const domain = email.split('@')[1] ?? email
  const base = domain
    .split('.')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20)
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  // On Railway: set BETTER_AUTH_URL to the web service public URL
  // (e.g. https://ai-sales-os-web.up.railway.app)
  // Locally: defaults to localhost:5000 (Replit dev port)
  baseURL: process.env.BETTER_AUTH_URL || process.env.WEB_URL || 'http://localhost:5000',

  database: drizzleAdapter(getDb(), {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24,       // refresh if > 1 day old
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,              // cache session for 5 min
    },
  },

  // Declare custom user fields so Better Auth passes them on INSERT.
  user: {
    additionalFields: {
      workspaceId: {
        type: 'string',
        required: false,
        fieldName: 'workspaceId',
      },
      role: {
        type: 'string',
        required: false,
        defaultValue: 'sdr',
        fieldName: 'role',
      },
      workspaceName: {
        type: 'string',
        required: false,
        fieldName: 'workspaceName',
        returned: false,
      },
    },
  },

  trustedOrigins: [
    process.env.BETTER_AUTH_URL,
    process.env.WEB_URL,
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
    ...(process.env.REPLIT_DEV_DOMAIN
      ? [`https://${process.env.REPLIT_DEV_DOMAIN}`]
      : []),
    ...(process.env.REPLIT_DOMAINS
      ? process.env.REPLIT_DOMAINS.split(',').map((d) => `https://${d.trim()}`)
      : []),
  ].filter((u): u is string => Boolean(u)),

  // Prevent Better Auth from generating its own IDs; let PostgreSQL
  // default (gen_random_uuid()) handle it so uuid columns stay valid.
  advanced: {
    database: {
      generateId: false,
    },
  },

  databaseHooks: {
    user: {
      create: {
        /**
         * Before creating the user, provision a workspace and inject
         * workspaceId into the user record to satisfy the NOT NULL constraint.
         */
        before: async (userData) => {
          const db = getDb()

          const trialEndsAt = new Date()
          trialEndsAt.setDate(trialEndsAt.getDate() + 14)

          const slug = deriveWorkspaceSlug(userData.email as string)
          const displayName =
            (userData.workspaceName as string | undefined)?.trim() ||
            (userData.name as string | undefined)?.trim() ||
            (userData.email as string).split('@')[0]

          const [workspace] = await db
            .insert(workspaces)
            .values({
              name: displayName,
              slug,
              plan: 'trial',
              trialEndsAt,
            })
            .returning()

          if (!workspace) {
            throw new Error('Failed to provision workspace during registration')
          }

          return {
            data: {
              ...userData,
              workspaceId: workspace.id,
              role: 'owner',
            },
          }
        },
      },
    },
  },
})
