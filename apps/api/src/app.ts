import Fastify, { type FastifyError } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import cookie from '@fastify/cookie'
import { getEnv } from '@ai-sales-os/config'
import { createLogger } from '@ai-sales-os/logger'
import { isAppError } from '@ai-sales-os/errors'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'
import { workspaceRoutes } from './routes/workspace.js'
import { companiesRoutes } from './routes/companies.js'
import { contactsRoutes } from './routes/contacts.js'
import { dealsRoutes } from './routes/deals.js'
import { leadSourcesRoutes } from './routes/lead-sources.js'

const logger = createLogger({ name: 'api:app' })

export async function buildApp() {
  const env = getEnv()

  const app = Fastify({
    logger: false, // We use our own Pino instance
    trustProxy: true,
    ajv: {
      customOptions: {
        removeAdditional: false,
        coerceTypes: false,
        allErrors: true,
      },
    },
  })

  // ─── Security ──────────────────────────────────────────────────────────────

  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
  })

  await app.register(cors, {
    origin: env.NODE_ENV === 'production'
      ? [env.BETTER_AUTH_URL]
      : true,
    credentials: true,
  })

  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests, please slow down',
        statusCode: 429,
      },
    }),
  })

  await app.register(cookie, {
    secret: env.BETTER_AUTH_SECRET,
  })

  // ─── Error Handler ─────────────────────────────────────────────────────────

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (isAppError(error)) {
      logger.warn({
        event: 'request.error',
        code: error.code,
        statusCode: error.statusCode,
        message: error.message,
      })
      return reply.status(error.statusCode).send(error.toJSON())
    }

    // Fastify validation error
    if (error.validation) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          statusCode: 400,
          details: error.validation,
        },
      })
    }

    // Unexpected error — FastifyError always has .message and .stack
    logger.error({
      event: 'request.unhandled_error',
      error: error.message,
      stack: error.stack,
    })

    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
        statusCode: 500,
      },
    })
  })

  // ─── Routes ────────────────────────────────────────────────────────────────

  await app.register(healthRoutes, { prefix: '/health' })
  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(workspaceRoutes, { prefix: '/api/workspaces' })
  await app.register(companiesRoutes, { prefix: '/api/companies' })
  await app.register(contactsRoutes, { prefix: '/api/contacts' })
  await app.register(dealsRoutes, { prefix: '/api/deals' })
  await app.register(leadSourcesRoutes, { prefix: '/api/lead-sources' })

  return app
}
