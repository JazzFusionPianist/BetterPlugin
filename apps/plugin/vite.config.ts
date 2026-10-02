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

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'require-auth-configuration',
    apply: 'build',
    configResolved(config) {
      const url = config.env.VITE_SUPABASE_URL
      const key = config.env.VITE_SUPABASE_ANON_KEY
      if (!url?.startsWith('https://') || !key || key === 'your-supabase-anon-key-here') {
        throw new Error('Login configuration missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before building the plugin.')
      }
    },
  }, {
    name: 'orb-native-region-qa',
    configureServer(server) {
      if (!['1', 'tracks'].includes(process.env.ORB_REGION_QA ?? '')) return
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost')
        if (url.pathname !== '/' || url.searchParams.get('qa') === 'off') return next()
        const page = process.env.ORB_REGION_QA === 'tracks' ? 'track-export' : 'region-bundle'
        res.writeHead(302, { Location: `/tests/${page}.html${url.search}` })
        res.end()
      })
    },
  }],
  define: {
    __BUILD_ID__: JSON.stringify(buildId()),
    __APP_VERSION__: JSON.stringify(pkgVersion()),
  },
  server: {
    port: 5173,
    proxy: process.env.ORB_DEV_API_URL ? {
      '/api': { target: process.env.ORB_DEV_API_URL, changeOrigin: true },
    } : undefined,
  },
})
