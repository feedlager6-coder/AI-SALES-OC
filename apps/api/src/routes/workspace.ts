import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb, workspaces } from '@ai-sales-os/db'
import { WorkspaceNotFoundError, ForbiddenError } from '@ai-sales-os/errors'
import { workspaceContextPlugin } from '../plugins/workspace-context.js'

const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  settings: z.record(z.unknown()).optional(),
})

export const workspaceRoutes: FastifyPluginAsync = async (app) => {
  await app.register(workspaceContextPlugin)

  /** GET /api/workspaces/me — current workspace details */
  app.get('/me', async (request, reply) => {
    const db = getDb()
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, request.workspaceId),
    })

    if (!workspace) throw new WorkspaceNotFoundError()

    return reply.send({ data: workspace })
  })

  /** PATCH /api/workspaces/me — update workspace settings */
  app.patch('/me', async (request, reply) => {
    if (!['owner', 'admin'].includes(request.userRole)) {
      throw new ForbiddenError('Only owners and admins can update workspace settings')
    }

    const body = UpdateWorkspaceSchema.parse(request.body)
    const db = getDb()

    const [updated] = await db
      .update(workspaces)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, request.workspaceId))
      .returning()

    if (!updated) throw new WorkspaceNotFoundError()

    return reply.send({ data: updated })
  })
}
