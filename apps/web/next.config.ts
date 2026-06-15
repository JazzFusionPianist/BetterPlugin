import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Transpile the shared workspace package (raw .ts, no build step).
  transpilePackages: ['@orb/core'],
  // Lint/types are enforced via the workspace typecheck script; don't fail
  // the Vercel build on warnings here.
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
