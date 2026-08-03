import type { NextConfig } from 'next'

const APP_VERSION = '0.1.0'
// Vercel stamps the deploy's commit — locally this falls back to 'dev'.
const BUILD_SHA = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7)

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
    NEXT_PUBLIC_BUILD_SHA: BUILD_SHA,
  },
  // Static export — produces `out/` that Capacitor bundles into the native
  // app, and serves as a fast static SPA on the web too. The app is fully
  // client-rendered (client-side Supabase auth), so there's nothing
  // server-only to lose.
  output: 'export',
  // Parallel dev servers (multiple Claude sessions share this tree) clobber
  // each other's .next route manifests — an env-scoped distDir isolates them.
  // Defaults to '.next', so builds and deploys are unaffected.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: { unoptimized: true },
  // Transpile the shared workspace package (raw .ts, no build step).
  transpilePackages: ['@orb/core'],
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
