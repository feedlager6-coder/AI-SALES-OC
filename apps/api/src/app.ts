import Fastify, { type FastifyError } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import cookie from '@fastify/cookie'
import { ZodError } from 'zod'
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
import { emailAccountsRoutes } from './routes/email-accounts.js'
import { campaignsRoutes } from './routes/campaigns.js'
import { sequencesRoutes } from './routes/sequences.js'
import { webhooksRoutes } from './routes/webhooks.js'

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
    global: true,
    max: 200,
    timeWindow: '1 minute',
    // Per-route overrides are set via route `config.rateLimit`
    errorResponseBuilder: (_request, context) => ({
      error: {
        code: 'RATE_LIMITED',
        message: `Too many requests — retry after ${Math.ceil(context.ttl / 1000)}s`,
        statusCode: 429,
      },
    }),
  })

  await app.register(cookie, {
    secret: env.BETTER_AUTH_SECRET,
  })

  // ─── Error Handler ─────────────────────────────────────────────────────────

  app.setErrorHandler((error: FastifyError | Error, _request, reply) => {
    if (isAppError(error)) {
      logger.warn({
        event: 'request.error',
        code: (error as { code: string }).code,
        statusCode: (error as { statusCode: number }).statusCode,
        message: error.message,
      })
      return reply
        .status((error as { statusCode: number }).statusCode)
        .send((error as { toJSON: () => unknown }).toJSON())
    }

    // Zod validation error — routes that call z.schema.parse() throw this
    if (error instanceof ZodError) {
      logger.debug({ event: 'request.zod_error', issues: error.issues })
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues[0]?.message ?? 'Validation error',
          statusCode: 400,
          issues: error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
      })
    }

    // Fastify JSON-schema validation error (ajv)
    if ((error as FastifyError).validation) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          statusCode: 400,
          details: (error as FastifyError).validation,
        },
      })
    }

    // Unexpected error
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
  await app.register(emailAccountsRoutes, { prefix: '/api/email-accounts' })
  await app.register(campaignsRoutes, { prefix: '/api/campaigns' })
  await app.register(sequencesRoutes, { prefix: '/api/sequences' })
  await app.register(webhooksRoutes, { prefix: '/api/webhooks' })

  return app
}
