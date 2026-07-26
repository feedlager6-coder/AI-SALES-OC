/**
 * Runtime API proxy — catches all /api/* requests that are NOT handled by a
 * more-specific route handler (e.g. /api/vip-login) and forwards them to the
 * Fastify API server.
 *
 * Why a Route Handler instead of next.config.ts rewrites():
 *   rewrites() destinations are evaluated at BUILD time. On Railway, if
 *   INTERNAL_API_URL is not set during the build, the destination is baked as
 *   http://localhost:3001 — which doesn't exist in the web container — and every
 *   auth request times out. A Route Handler reads process.env at REQUEST time,
 *   so it always uses the correct runtime value.
 *
 * Specificity rule (Next.js App Router):
 *   More-specific routes win over [...path] catch-alls, so
 *   /api/vip-login/route.ts is served by its own handler and never reaches here.
 */

import type { NextRequest } from 'next/server'

// Read at module load time — but module is loaded on first request in the
// running container (runtime), so process.env reflects the current environment,
// not the build environment.
const API_BASE = (process.env.INTERNAL_API_URL ?? 'http://localhost:3001').replace(/\/$/, '')

// Headers that must not be forwarded between server-side hops.
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

async function proxyToApi(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params

  // Build the target URL, preserving the query string.
  const targetUrl = new URL(`/api/${path.join('/')}`, API_BASE)
  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value)
  })

  // ── Request headers ────────────────────────────────────────────────────────
  // Forward most headers. Strip only:
  //   - hop-by-hop headers (HTTP semantics)
  //   - 'host' — must be the target host, not the Next.js host
  //
  // 'origin' MUST be forwarded: Better Auth validates it against trustedOrigins
  // for all POST requests and rejects with 403 if it is absent or untrusted.
  // In dev, 'http://localhost:5000' is in trustedOrigins. In production on
  // Railway, set WEB_URL on the API service so the web domain is trusted.
  const forwardHeaders = new Headers()
  request.headers.forEach((value, key) => {
    const k = key.toLowerCase()
    if (k === 'host' || HOP_BY_HOP.has(k)) return
    forwardHeaders.set(key, value)
  })

  // ── Request body ───────────────────────────────────────────────────────────
  const hasBody = !['GET', 'HEAD'].includes(request.method.toUpperCase())
  let body: ArrayBuffer | undefined
  if (hasBody) {
    body = await request.arrayBuffer()
  }

  // ── Upstream fetch ─────────────────────────────────────────────────────────
  let upstreamResponse: Response
  try {
    upstreamResponse = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: forwardHeaders,
      body: body && body.byteLength > 0 ? body : undefined,
      // Pass redirects through to the browser rather than following them.
      redirect: 'manual',
    })
  } catch (err) {
    console.error('[api-proxy] upstream fetch failed', { url: targetUrl.toString(), err })
    return new Response(
      JSON.stringify({ error: { code: 'API_UNREACHABLE', message: 'API server is not reachable', statusCode: 502 } }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // ── Response headers ───────────────────────────────────────────────────────
  const responseHeaders = new Headers()

  // Forward all regular headers (skip hop-by-hop).
  upstreamResponse.headers.forEach((value, key) => {
    const k = key.toLowerCase()
    if (k === 'set-cookie' || HOP_BY_HOP.has(k)) return
    responseHeaders.append(key, value)
  })

  // Set-Cookie requires special handling: Headers.forEach joins multiple values
  // with ', ' which breaks cookies. Use getSetCookie() (Node 20+) to get each
  // Set-Cookie header value individually.
  const cookies = upstreamResponse.headers.getSetCookie?.() ?? []
  for (const cookie of cookies) {
    responseHeaders.append('set-cookie', cookie)
  }

  const responseBody = await upstreamResponse.arrayBuffer()

  return new Response(responseBody.byteLength > 0 ? responseBody : null, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  })
}

// Export all methods so Next.js routes all verbs through the proxy.
export const GET = proxyToApi
export const POST = proxyToApi
export const PUT = proxyToApi
export const PATCH = proxyToApi
export const DELETE = proxyToApi
export const HEAD = proxyToApi
export const OPTIONS = proxyToApi
