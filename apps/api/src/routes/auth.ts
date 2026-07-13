import type { FastifyPluginAsync } from 'fastify'
import { getAuth } from '../plugins/auth.js'

/**
 * Proxies all Better Auth endpoints.
 * Better Auth handles: /sign-in/email, /sign-up/email, /sign-out, /session, etc.
 */
export const authRoutes: FastifyPluginAsync = async (app) => {
  app.all('/*', async (request, reply) => {
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
    const webRequest = new Request(url.toString(), {
      method: request.method,
      headers,
      ...(isBodyMethod ? { body: JSON.stringify(request.body) } : {}),
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
