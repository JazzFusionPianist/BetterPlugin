import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.slur.app',
  appName: 'Slur',
  // Bundle the static web app so the installed app opens without a dev server.
  webDir: 'out',
  // Android enables native HTTPS in MainActivity; iOS keeps its existing transport.
  plugins: { CapacitorHttp: { enabled: false } },
  // Optional live reload: CAPACITOR_DEV_SERVER_URL=http://localhost:3000 pnpm cap:sync
  ...(process.env.CAPACITOR_DEV_SERVER_URL ? {
    server: {
      url: process.env.CAPACITOR_DEV_SERVER_URL,
      cleartext: process.env.CAPACITOR_DEV_SERVER_URL.startsWith('http://'),
    },
  } : {}),
}

export default config
