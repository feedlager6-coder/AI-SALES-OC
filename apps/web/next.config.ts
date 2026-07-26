import path from 'path'
import type { NextConfig } from 'next'

// Replit's iframe proxy serves the app from a dynamic *.replit.dev domain,
// which differs from the dev server's own origin — Next.js blocks
// cross-origin dev requests (assets, HMR) unless explicitly allowlisted.
const replitDevOrigins = [
  process.env.REPLIT_DEV_DOMAIN,
  ...(process.env.REPLIT_DOMAINS?.split(',') ?? []),
].filter((origin): origin is string => Boolean(origin))

const nextConfig: NextConfig = {
  // Allow requests from the Replit preview proxy host and local IP (screenshot tooling)
  allowedDevOrigins:
    replitDevOrigins.length > 0 ? [...replitDevOrigins, '127.0.0.1'] : ['*'],
  serverExternalPackages: [],
  // Standalone output bundles only the files needed to run the server —
  // required for Railway and Docker deployments.
  output: 'standalone',
  // In a pnpm monorepo, Next.js file-tracing must start from the repo root so
  // that workspace package files (packages/*) are included in the standalone
  // bundle. Without this, imports of @ai-sales-os/* packages fail at runtime.
  // Resulting server.js path: .next/standalone/apps/web/server.js
  outputFileTracingRoot: path.join(__dirname, '../../'),
  images: {
    domains: [],
  },
  // Transpile workspace packages
  transpilePackages: ['@ai-sales-os/types'],
  // NOTE: /api/* proxying is handled by apps/web/src/app/api/[...path]/route.ts
  // (a Next.js Route Handler), NOT by next.config.ts rewrites().
  //
  // rewrites() destinations are evaluated at BUILD time and baked into the
  // routes manifest. If INTERNAL_API_URL is not set during the Railway build
  // the destination would be http://localhost:3001 — which doesn't exist in
  // the web container — causing every auth and API request to time out.
  //
  // The Route Handler reads process.env.INTERNAL_API_URL at REQUEST time, so
  // it always uses the correct runtime value without any build-time coupling.
}

export default nextConfig
