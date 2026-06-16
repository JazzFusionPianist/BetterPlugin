import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Static export — produces `out/` that Capacitor bundles into the native
  // app, and serves as a fast static SPA on the web too. The app is fully
  // client-rendered (client-side Supabase auth), so there's nothing
  // server-only to lose.
  output: 'export',
  images: { unoptimized: true },
  // Transpile the shared workspace package (raw .ts, no build step).
  transpilePackages: ['@orb/core'],
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
