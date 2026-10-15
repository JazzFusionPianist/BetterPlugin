import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'

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
      this.emitFile({ type: 'asset', fileName: 'build.json', source: JSON.stringify({ build: buildId(), version: pkgVersion(), at: new Date().toISOString(),
        regionSharing: 1, regionDawproject: 1, regionVstXml: 1, regionLuna: 1, stemDownloads: 1, regionPlacement: 1, trackExportPolicy: 'pro-tools-only' }) })
    },
  }
}

/** Which product's page this build is: unset = the site (index.html, every surface behind ?surface=); sounds | chat | games
 *  = that product's own page (sounds.html …), written to dist-<product>, which the plugin carries. */
const PRODUCT = process.env.VITE_PRODUCT ?? ''
if (PRODUCT && !['sounds', 'chat', 'games'].includes(PRODUCT)) throw new Error(`VITE_PRODUCT must be sounds, chat or games (got ${PRODUCT})`)

/** dist/modules.json — every source file this page is made of (relative to the repo root), sorted. A product's release
 *  refuses to go out while one of THESE is uncommitted, and ignores the rest of the tree. */
function modulesList () {
  const root = resolve(process.cwd(), '../..')
  return {
    name: 'modules-list',
    generateBundle (this: { emitFile: (f: { type: 'asset'; fileName: string; source: string }) => void }, _o: unknown, bundle: Record<string, { type: string; modules?: Record<string, unknown> }>) {
      const files = new Set<string>()
      for (const chunk of Object.values(bundle)) if (chunk.type === 'chunk' && chunk.modules) for (const id of Object.keys(chunk.modules)) {
        const p = id.split('?')[0]
        if (p.startsWith('\0') || p.includes('/node_modules/') || !p.startsWith('/')) continue
        files.add(relative(root, p))
      }
      this.emitFile({ type: 'asset', fileName: 'modules.json', source: JSON.stringify([...files].sort(), null, 1) })
    },
  }
}

export default defineConfig({
  build: PRODUCT ? { outDir: `dist-${PRODUCT}`, rollupOptions: { input: resolve(process.cwd(), `${PRODUCT}.html`) } } : undefined,
  plugins: [react(), tailwindcss(), buildStamp(), modulesList(), {
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
