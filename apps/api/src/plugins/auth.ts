/**
 * Better Auth integration for Fastify.
 * Provides: session extraction, workspace provisioning on first sign-up.
 *
 * On user creation (sign-up), a workspace is automatically created and
 * the user is assigned as its owner via databaseHooks.user.create.before.
 */
import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { getDb, workspaces } from '@ai-sales-os/db'
import * as schema from '@ai-sales-os/db/schema'
import { getEnv } from '@ai-sales-os/config'
import { createLogger } from '@ai-sales-os/logger'

const logger = createLogger({ name: 'api:auth' })

// Use `ReturnType` so the type follows the actual options shape
type AuthInstance = ReturnType<typeof betterAuth>

let _auth: AuthInstance | null = null

/**
 * Derive a unique workspace slug from the user's email or name.
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

export function getAuth(): AuthInstance {
  if (_auth) return _auth

  const env = getEnv()
  const db = getDb()

  const options: BetterAuthOptions = {
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
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
      requireEmailVerification: false, // Enable in production after SMTP setup
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // Refresh session if > 1 day old
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // Cache session for 5 min
      },
    },
    // Declare custom user fields so Better Auth passes them to the DB on INSERT.
    // Without this, fields injected by databaseHooks.user.create.before are silently dropped.
    user: {
      additionalFields: {
        workspaceId: {
          type: 'string',
          required: false, // injected server-side by databaseHooks.user.create.before
          fieldName: 'workspaceId', // must match the Drizzle schema object key (camelCase)
        },
        role: {
          type: 'string',
          required: false,
          defaultValue: 'member',
          fieldName: 'role',
        },
        // Passed from the register form so the first workspace gets a meaningful name
        workspaceName: {
          type: 'string',
          required: false,
          fieldName: 'workspaceName',
          returned: false, // don't expose in session/user responses
        },
      },
    },
    trustedOrigins: [
      env.BETTER_AUTH_URL,
      // Trust local dev origins (including 127.0.0.1 for dev tooling / screenshot browsers)
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5000',
      // Trust Replit preview proxy domains in all environments
      ...(process.env.REPLIT_DEV_DOMAIN
        ? [`https://${process.env.REPLIT_DEV_DOMAIN}`]
        : []),
      ...(process.env.REPLIT_DOMAINS
        ? process.env.REPLIT_DOMAINS.split(',').map((d) => `https://${d.trim()}`)
        : []),
    ],
    // Our schema generates IDs at the DB level (uuid default gen_random_uuid()).
    // Without this, Better Auth generates its own non-UUID string IDs, which
    // fail to insert into the uuid-typed primary key columns.
    advanced: {
      database: {
        generateId: false,
      },
    },
    databaseHooks: {
      user: {
        create: {
          /**
           * Before creating the user, provision a workspace and inject the
           * workspaceId into the user record so the NOT NULL constraint is
           * satisfied. The first user in a workspace is always 'owner'.
           */
          before: async (userData) => {
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

            logger.info({
              event: 'workspace.provisioned',
              workspaceId: workspace.id,
              slug: workspace.slug,
              email: userData.email,
            })

            // workspaceName is declared in additionalFields and has a
            // corresponding workspace_name column in users (nullable).
            // Better Auth merges { ...originalData, ...result.data }, so we
            // cannot strip it here. The column absorbs the value harmlessly.
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
  }

  _auth = betterAuth(options)
  return _auth
}
