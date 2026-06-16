'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import OrbBackground from './OrbBackground'
import AuthModal from './AuthModal'

export default function Landing() {
  const router = useRouter()
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')

  // Resolve platform after mount to avoid a hydration mismatch (static HTML
  // is pre-rendered as web). On native we show a focused welcome/auth gate
  // instead of the marketing download CTA.
  const [isNative, setIsNative] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform())
    setReady(true)
  }, [])

  const open = (mode: 'signin' | 'signup') => { setAuthMode(mode); setAuthOpen(true) }

  return (
    <>
      <OrbBackground />
      <div className="grain" />
      <div className="veil" />

      <div className="shell">
        <div className="top">
          <span className="word"><span className="mark" />Orb</span>
          {/* On native the welcome CTAs already cover sign-in, so the
              top-right link is redundant — show it on web only. */}
          {ready && !isNative && (
            <button className="login" onClick={() => open('signin')}>Log in</button>
          )}
        </div>

        <main className="stage">
          <h1>Make music together.</h1>
          <p className="sub">Your crew, your sessions, your sound — in your DAW and on the web.</p>

          {ready && (
            isNative ? (
              <div className="actions actions-native">
                <button className="download" onClick={() => open('signup')}>Get started</button>
                <button className="ghost-link" onClick={() => open('signin')}>
                  Already have an account? <span>Log in</span>
                </button>
              </div>
            ) : (
              <div className="actions">
                <button className="download" onClick={() => alert('Plugin download coming soon.')}>
                  Download for Mac
                </button>
              </div>
            )
          )}
        </main>

        <div className="bottom">
          <span>© 2026 Orb</span>
        </div>
      </div>

      <AuthModal
        open={authOpen}
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
        onAuthed={() => router.replace('/app')}
      />
    </>
  )
}
