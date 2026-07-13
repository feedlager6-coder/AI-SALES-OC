import type { NextConfig } from 'next'

// Replit's iframe proxy serves the app from a dynamic *.replit.dev domain,
// which differs from the dev server's own origin — Next.js blocks
// cross-origin dev requests (assets, HMR) unless explicitly allowlisted.
const replitDevOrigins = [
  process.env.REPLIT_DEV_DOMAIN,
  ...(process.env.REPLIT_DOMAINS?.split(',') ?? []),
].filter((origin): origin is string => Boolean(origin))

const nextConfig: NextConfig = {
  // Allow requests from the Replit preview proxy host
  allowedDevOrigins: replitDevOrigins.length > 0 ? replitDevOrigins : ['*'],
  serverExternalPackages: [],
  images: {
    domains: [],
  },
  // Transpile workspace packages
  transpilePackages: ['@ai-sales-os/types'],
  // Replit only exposes one port (5000) publicly. Proxy /api/* to the
  // Fastify server (localhost:3001) so the browser only ever talks to a
  // single same-origin host — avoids cross-port CORS/cookie issues.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ]
  },
}

export default nextConfig
