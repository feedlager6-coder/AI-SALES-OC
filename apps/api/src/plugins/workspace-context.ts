/**
 * Workspace context Fastify plugin.
 *
 * Extracts workspace_id from the authenticated session and:
 * 1. Attaches it to request.workspaceId
 * 2. Sets PostgreSQL session variable for RLS (app.current_workspace_id)
 *
 * This plugin must be registered AFTER auth validation on protected routes.
 */
import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { getDb } from '@ai-sales-os/db'
import { sql } from 'drizzle-orm'
import { UnauthorizedError, ForbiddenError } from '@ai-sales-os/errors'
import { getAuth } from './auth.js'

// Extend Fastify request with workspace context
declare module 'fastify' {
  interface FastifyRequest {
    workspaceId: string
    userId: string
    userRole: string
  }
}

export const workspaceContextPlugin: FastifyPluginAsync = fp(async (app) => {
  app.decorateRequest('workspaceId', '')
  app.decorateRequest('userId', '')
  app.decorateRequest('userRole', '')

  app.addHook('preHandler', async (request: FastifyRequest, _reply) => {
    // Skip health checks and auth routes
    if (
      request.url.startsWith('/health') ||
      request.url.startsWith('/api/auth')
    ) {
      return
    }

    const auth = getAuth()

    // Convert Fastify headers to plain Record<string, string> for Better Auth
    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries(request.headers)) {
      if (v !== undefined) {
        headers[k] = Array.isArray(v) ? v.join(', ') : v
      }
    }

    const session = await auth.api.getSession({ headers })

    if (!session?.user) {
      throw new UnauthorizedError()
    }

    const user = session.user as { id: string; workspaceId?: string; role?: string }

    if (!user.workspaceId) {
      throw new ForbiddenError('User is not associated with a workspace')
    }

    request.userId = user.id
    request.workspaceId = user.workspaceId
    request.userRole = user.role ?? 'sdr'

    // Set PostgreSQL RLS context
    const db = getDb()
    await db.execute(
      sql`SELECT set_config('app.current_workspace_id', ${request.workspaceId}, true)`,
    )
  })
})
