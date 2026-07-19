/**
 * Shared test utilities for Fastify route testing.
 * Registers the same error handler used in production so test assertions
 * can check the canonical { error: { code, message, statusCode } } shape.
 */
import Fastify, { type FastifyInstance, type FastifyError } from 'fastify'
import { isAppError } from '@ai-sales-os/errors'

export function createTestApp(): FastifyInstance {
  const app = Fastify({ logger: false })

  // Mirror the production error handler from apps/api/src/app.ts
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (isAppError(error)) {
      return reply.status(error.statusCode).send(error.toJSON())
    }

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

    return reply.status(error.statusCode ?? 500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
        statusCode: error.statusCode ?? 500,
      },
    })
  })

  return app
}
