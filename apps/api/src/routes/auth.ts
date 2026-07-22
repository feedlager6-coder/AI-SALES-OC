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

    const response = await auth.handler(webRequest)

    // Forward response headers
    response.headers.forEach((value, key) => {
      reply.header(key, value)
    })

    const body = await response.text()
    return reply.status(response.status).send(body)
  })
}
