'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import OrbBackground from './OrbBackground'
import AuthModal from './AuthModal'

export default function Landing() {
  const router = useRouter()
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <>
      <OrbBackground />
      <div className="grain" />
      <div className="veil" />

      <div className="shell">
        <div className="top">
          <span className="word"><span className="mark" />Orb</span>
          <button className="login" onClick={() => setAuthOpen(true)}>Log in</button>
        </div>

        <main className="stage">
          <h1>Make music together.</h1>
          <p className="sub">Your crew, your sessions, your sound — in your DAW and on the web.</p>
          <div className="actions">
            <button className="download" onClick={() => alert('Plugin download coming soon.')}>
              Download for Mac
            </button>
            <button className="secondary" onClick={() => setAuthOpen(true)}>or open in browser</button>
          </div>
        </main>

        <div className="bottom">
          <span className="meta"><span className="dot" /> Early access · macOS</span>
          <span>© 2026 Orb</span>
        </div>
      </div>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthed={() => router.replace('/app')}
      />
    </>
  )
}
