import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow requests from any host (required for Replit proxy)
  allowedDevOrigins: ['*'],
  serverExternalPackages: [],
  images: {
    domains: [],
  },
  // Transpile workspace packages
  transpilePackages: ['@ai-sales-os/types'],
}

export default nextConfig
