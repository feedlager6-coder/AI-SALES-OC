import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, isNull, isNotNull, and, gte, count } from 'drizzle-orm'
import { getDb, workspaces, companies, emailSends } from '@ai-sales-os/db'
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

  /**
   * GET /api/workspaces/stats — dashboard summary statistics
   * Returns: total companies, enriched companies, emails sent (30d), reply rate (30d)
   */
  app.get('/stats', async (request, reply) => {
    const db = getDb()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const wsId = request.workspaceId

    const [
      totalResult,
      enrichedResult,
      sentResult,
      repliedResult,
    ] = await Promise.all([
      // Total non-deleted companies
      db
        .select({ value: count() })
        .from(companies)
        .where(and(eq(companies.workspaceId, wsId), isNull(companies.deletedAt))),

      // Companies with enrichment done
      db
        .select({ value: count() })
        .from(companies)
        .where(
          and(
            eq(companies.workspaceId, wsId),
            isNull(companies.deletedAt),
            eq(companies.enrichmentStatus, 'done'),
          ),
        ),

      // Emails sent in last 30 days
      db
        .select({ value: count() })
        .from(emailSends)
        .where(
          and(
            eq(emailSends.workspaceId, wsId),
            isNotNull(emailSends.sentAt),
            gte(emailSends.sentAt, thirtyDaysAgo),
          ),
        ),

      // Emails with reply in last 30 days
      db
        .select({ value: count() })
        .from(emailSends)
        .where(
          and(
            eq(emailSends.workspaceId, wsId),
            isNotNull(emailSends.repliedAt),
            gte(emailSends.sentAt, thirtyDaysAgo),
          ),
        ),
    ])

    const totalCompanies = Number(totalResult[0]?.value ?? 0)
    const enrichedCompanies = Number(enrichedResult[0]?.value ?? 0)
    const emailsSent30d = Number(sentResult[0]?.value ?? 0)
    const repliesCount = Number(repliedResult[0]?.value ?? 0)

    const replyRate =
      emailsSent30d > 0 ? Math.round((repliesCount / emailsSent30d) * 1000) / 10 : 0

    return reply.send({
      data: {
        totalCompanies,
        enrichedCompanies,
        emailsSent30d,
        replyRate, // percentage, e.g. 4.2
        repliesCount,
      },
    })
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
