import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'

// Short commit hash baked into the bundle so the running UI can say which
// build it is (settings panel footer). Vercel exposes the sha as an env
// var; local builds ask git; worst case we ship "dev".
function buildId (): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA
  if (sha) return sha.slice(0, 7)
  try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'dev' }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __BUILD_ID__: JSON.stringify(buildId()),
  },
  server: {
    port: 5173,
  },
})
