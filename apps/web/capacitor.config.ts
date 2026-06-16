import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.orb.app',
  appName: 'Orb',
  // Static export output; bundled into the native app as the offline
  // fallback. During development `server.url` overrides this with the
  // live dev server (hot reload inside the native shell).
  webDir: 'out',
  server: {
    // ── DEV: load the live Next dev server so edits hot-reload in the app.
    //    iOS simulator can reach the Mac's localhost directly. For a real
    //    device, swap to your Mac's LAN IP (e.g. http://192.168.x.x:3000).
    //    Comment this whole `server` block out for a production build —
    //    then the app serves the bundled `out/` instead.
    url: 'http://localhost:3000',
    cleartext: true,
  },
}

export default config
