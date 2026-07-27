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
 */

import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

export const { GET, POST } = toNextJsHandler(auth)
