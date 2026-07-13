import type { FastifyRequest, FastifyReply } from 'fastify'
import { ForbiddenError } from '@ai-sales-os/errors'
import type { UserRole } from '@ai-sales-os/types'

/**
 * Factory for role-based access control middleware.
 * Usage: app.addHook('preHandler', requireRole(['owner', 'admin']))
 */
export function requireRole(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!allowedRoles.includes(request.userRole as UserRole)) {
      throw new ForbiddenError(
        `This action requires one of: ${allowedRoles.join(', ')}`,
      )
    }
  }
}
