'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import AuthModal from './AuthModal'
import Cover from './slur/Cover'
import PictoNav from './slur/PictoNav'
import '@/app/slur.css'

/* The page before you log in: one screen, no scroll — the cover (one print
   on an empty ground turning its pages) under the pictogram nav, the name
   travelling along the floor, and the door. */

export default function Landing () {
  const router = useRouter()
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')

  // Resolve platform after mount. In an "app" context (the Capacitor shell,
  // a phone or tablet browser, home-screen mode) there is nothing to
  // download, so the downloads cell goes.
  const [isApp, setIsApp] = useState(false)
  useEffect(() => {
    const ua = navigator.userAgent
    setIsApp(
      Capacitor.isNativePlatform() ||
      /iPhone|iPod|iPad|Android/i.test(ua) ||
      (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ||   // iPadOS desktop UA
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true,
    )
    // /?door=signin or /?door=signup opens the door (links from /downloads)
    const door = new URLSearchParams(window.location.search).get('door')
    if (door === 'signin' || door === 'signup') { setAuthMode(door); setAuthOpen(true) }
  }, [])

  return (
    <div className="sl sl-one">
      <div className="sl-grain" />
      <Cover nav={<PictoNav showDownloads={!isApp} onLogIn={() => { setAuthMode('signin'); setAuthOpen(true) }} />} />
      <AuthModal
        open={authOpen}
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
        onAuthed={() => router.replace('/app')}
      />
    </div>
  )
}
