import type { FastifyPluginAsync } from 'fastify'
import { getDb } from '@ai-sales-os/db'
import { sql } from 'drizzle-orm'
import { getRedisConnection } from '@ai-sales-os/queue'

export const healthRoutes: FastifyPluginAsync = async (app) => {
  /** Basic liveness probe — always returns 200 if server is up */
  app.get('/live', async (_request, reply) => {
    return reply.status(200).send({ status: 'ok' })
  })

  /** Readiness probe — checks DB and Redis connectivity */
  app.get('/ready', async (_request, reply) => {
    const checks: Record<string, 'ok' | 'error'> = {}
    let allOk = true

    // Check PostgreSQL
    try {
      const db = getDb()
      await db.execute(sql`SELECT 1`)
      checks.database = 'ok'
    } catch {
      checks.database = 'error'
      allOk = false
    }

    // Check Redis
    try {
      const redis = getRedisConnection()
      await redis.ping()
      checks.redis = 'ok'
    } catch {
      checks.redis = 'error'
      allOk = false
    }

    const status = allOk ? 200 : 503
    return reply.status(status).send({
      status: allOk ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    })
  })
}
