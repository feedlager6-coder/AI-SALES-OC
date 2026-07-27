import type { FastifyPluginAsync } from 'fastify'
import { getAuth } from '../plugins/auth.js'

/**
 * Proxies all Better Auth endpoints.
 * Better Auth handles: /sign-in/email, /sign-up/email, /sign-out, /session, etc.
 */
export const authRoutes: FastifyPluginAsync = async (app) => {
  // Better Auth's sign-out (and other endpoints) sends POST with empty body
  // and Content-Type: application/json. Fastify's default parser rejects this.
  // Override the parser within this plugin scope to accept empty JSON bodies.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body || body === '') {
      done(null, null)
      return
    }
    try {
      done(null, JSON.parse(body as string))
    } catch {
      done(new Error('Body must be valid JSON'))
    }
  })

  // Stricter rate limit for auth endpoints (sign-in brute-force protection)
  app.all('/*', {
    config: {
      rateLimit: {
        max: 15,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const auth = getAuth()

    // Convert Fastify request to Web API Request for Better Auth
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`)

    // Build headers as a plain object — avoids HeadersInit global type dependency
    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries(request.headers)) {
      if (v !== undefined) {
        headers[k] = Array.isArray(v) ? v.join(', ') : v
      }
    }

    const isBodyMethod = !['GET', 'HEAD'].includes(request.method)
    // request.body is null when the POST body is empty (sign-out etc.)
    const bodyPayload = isBodyMethod && request.body != null
      ? JSON.stringify(request.body)
      : undefined

    const webRequest = new Request(url.toString(), {
      method: request.method,
      headers,
      ...(bodyPayload !== undefined ? { body: bodyPayload } : {}),
    })

    // ── TEMPORARY DIAGNOSTIC LOGGING ──────────────────────────────────────────
    // Log every auth request so we can identify exceptions on Railway.
    // Remove after the root cause is confirmed.
    const isSignUp = request.url.includes('sign-up')
    if (isSignUp) {
      app.log.info({
        msg: '[auth-diag] sign-up request received',
        method: request.method,
        url: request.url,
        bodyKeys: request.body != null ? Object.keys(request.body as Record<string, unknown>) : null,
      })
    }

    let response: Response
    try {
      response = await auth.handler(webRequest)
    } catch (err: unknown) {
      // Catch any synchronous or async exception thrown by Better Auth or the
      // database hook before it becomes an unhandled rejection / silent 500.
      const error = err as Error & {
        code?: string
        constraint?: string
        table?: string
        detail?: string
        routine?: string
      }
      app.log.error({
        msg: '[auth-diag] EXCEPTION thrown by auth.handler',
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
        // PostgreSQL / pg driver fields
        pgCode: error?.code,
        pgConstraint: error?.constraint,
        pgTable: error?.table,
        pgDetail: error?.detail,
        pgRoutine: error?.routine,
      })
      // Re-throw so Fastify's error handler returns 500 (same behaviour as before,
      // but now we have the full stack in the logs).
      throw err
    }

    if (isSignUp) {
      app.log.info({
        msg: '[auth-diag] sign-up response from Better Auth',
        status: response.status,
      })
    }

    if (response.status >= 400) {
      const cloned = response.clone()
      const errBody = await cloned.text()
      app.log.warn({
        msg: '[auth-diag] Better Auth returned error response',
        url: request.url,
        status: response.status,
        body: errBody,
      })
    }
    // ── END TEMPORARY DIAGNOSTIC LOGGING ──────────────────────────────────────

    // Forward response headers
    response.headers.forEach((value, key) => {
      reply.header(key, value)
    })

    const body = await response.text()
    return reply.status(response.status).send(body)
  })
}
