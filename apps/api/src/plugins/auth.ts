/**
 * Better Auth integration for Fastify.
 * Provides: session extraction, workspace context injection.
 */
import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { getDb } from '@ai-sales-os/db'
import * as schema from '@ai-sales-os/db/schema'
import { getEnv } from '@ai-sales-os/config'

// Use `ReturnType` so the type follows the actual options shape
type AuthInstance = ReturnType<typeof betterAuth>

let _auth: AuthInstance | null = null

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
    trustedOrigins: [env.BETTER_AUTH_URL],
  }

  _auth = betterAuth(options)
  return _auth
}
