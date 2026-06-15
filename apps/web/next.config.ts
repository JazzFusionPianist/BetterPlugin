import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Lint/types are enforced via the workspace typecheck script; don't fail
  // the Vercel build on warnings here.
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
