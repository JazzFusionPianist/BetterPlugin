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
  plugins: [react(), tailwindcss()],
  define: {
    __BUILD_ID__: JSON.stringify(buildId()),
    __APP_VERSION__: JSON.stringify(pkgVersion()),
  },
  server: {
    port: 5173,
  },
})
