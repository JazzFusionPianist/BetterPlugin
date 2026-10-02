import type { Metadata, Viewport } from 'next'
import './globals.css'
import './games.css'

export const metadata: Metadata = {
  title: 'Slur Studio',
  description: 'Slur, Patch on Slur and the rest of the Slur Studio plug-ins.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: '/apple-touch-icon.png',
  },
  // "Add to Home Screen" on iOS opens slur full-screen, no Safari chrome.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'slur',
  },
}

export const viewport: Viewport = {
  themeColor: '#FBFAF7',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap"
          rel="stylesheet"
        />
        {/* Korean: Pretendard everywhere (Steven, 2026-08-11 — one family
            for Hangul across both voices; Latin stays Instrument).
            Dynamic subset — only the glyphs on screen are fetched. */}
        <link
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
