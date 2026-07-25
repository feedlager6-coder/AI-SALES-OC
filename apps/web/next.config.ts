import type { NextConfig } from 'next'

// Replit's iframe proxy serves the app from a dynamic *.replit.dev domain,
// which differs from the dev server's own origin — Next.js blocks
// cross-origin dev requests (assets, HMR) unless explicitly allowlisted.
const replitDevOrigins = [
  process.env.REPLIT_DEV_DOMAIN,
  ...(process.env.REPLIT_DOMAINS?.split(',') ?? []),
].filter((origin): origin is string => Boolean(origin))

// Internal URL of the Fastify API server.
// On Replit/local dev: http://localhost:3001
// On Railway: set INTERNAL_API_URL to the Railway-internal URL of the API service
//             (e.g. https://<api-service>.railway.internal or the public API URL)
const internalApiUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:3001'

const nextConfig: NextConfig = {
  // Allow requests from the Replit preview proxy host and local IP (screenshot tooling)
  allowedDevOrigins:
    replitDevOrigins.length > 0 ? [...replitDevOrigins, '127.0.0.1'] : ['*'],
  serverExternalPackages: [],
  // Standalone output bundles only the files needed to run the server —
  // required for Railway and Docker deployments.
  output: 'standalone',
  images: {
    domains: [],
  },
  // Transpile workspace packages
  transpilePackages: ['@ai-sales-os/types'],
  // Proxy /api/* to the Fastify server so the browser talks to one same-origin
  // host and avoids cross-port CORS/cookie issues. The destination is
  // configurable via INTERNAL_API_URL for production multi-service deployments.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${internalApiUrl}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
