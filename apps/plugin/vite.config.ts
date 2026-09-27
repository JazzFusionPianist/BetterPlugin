import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Short commit hash baked into the bundle so the running UI can say which
// build it is (settings panel footer). Vercel exposes the sha as an env
// var; local builds ask git; worst case we ship "dev".
function buildId (): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA
  if (sha) return sha.slice(0, 7)
  try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'dev' }
}

const pkgVersion = (): string => {
  try { return (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version?: string }).version ?? '0.0.0' }
  catch { return '0.0.0' }
}

/** dist/build.json — which build this is. The plugin carries a copy of the site and compares this with the site's to know
 *  whether the site is newer than what it carries. */
function buildStamp () {
  return {
    name: 'build-stamp',
    generateBundle (this: { emitFile: (f: { type: 'asset'; fileName: string; source: string }) => void }) {
      this.emitFile({ type: 'asset', fileName: 'build.json', source: JSON.stringify({ build: buildId(), version: pkgVersion(), at: new Date().toISOString() }) })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), buildStamp(), {
    name: 'require-auth-configuration',
    apply: 'build',
    configResolved(config) {
      if (!config.env.VITE_SUPABASE_URL?.startsWith('https://') || !config.env.VITE_SUPABASE_ANON_KEY || config.env.VITE_SUPABASE_ANON_KEY === 'your-supabase-anon-key-here') {
        throw new Error('Login configuration missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before building the plugin.')
      }
    },
  }],
  define: {
    __BUILD_ID__: JSON.stringify(buildId()),
    __APP_VERSION__: JSON.stringify(pkgVersion()),
  },
  server: {
    port: 5173,
  },
})
