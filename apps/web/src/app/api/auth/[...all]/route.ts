/**
 * Better Auth Next.js Route Handler.
 *
 * Handles all /api/auth/* endpoints directly in the Next.js web process:
 *   POST /api/auth/sign-up/email
 *   POST /api/auth/sign-in/email
 *   POST /api/auth/sign-out
 *   GET  /api/auth/get-session
 *   ...and all other Better Auth endpoints
 *
 * This route takes priority over the catch-all /api/[...path] proxy in
 * Next.js App Router (more specific path wins), so auth requests never
 * reach the Fastify proxy — eliminating INTERNAL_API_URL as a failure point
 * for authentication.
 *
 * getAuth() is called inside the handler (request time) rather than at module
 * load time so the build succeeds even when DATABASE_URL is absent from the
 * build environment.
 */

import { getAuth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'
import type { NextRequest } from 'next/server'

async function authHandler(request: NextRequest) {
  const { GET, POST } = toNextJsHandler(getAuth())
  return request.method === 'GET' ? GET(request) : POST(request)
}

export { authHandler as GET, authHandler as POST }
