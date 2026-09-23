'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import AuthModal from './AuthModal'
import SlurMark from './slur/SlurMark'
import Bar from './slur/Bar'
import RoomPicture from './slur/RoomPicture'
import { C } from './slur/marks'
import '@/app/slur.css'

/* The page before you log in. No copy: a bar of music (five hairlines,
   whole notes in the house colours, one engraved slur tying them), the
   room you land in, and the door. Every edge is a curve. */

const WIDE = [
  { x: 250, step: 1, color: C.blue },
  { x: 440, step: 3, color: C.green, hollow: false },
  { x: 640, step: 6, color: C.orange },
  { x: 820, step: 8, color: C.rose, hollow: false },
  { x: 1010, step: 5, color: C.lilac },
  { x: 1200, step: 2, color: C.ink },
]
const NARROW = [
  { x: 60, step: 1, color: C.blue },
  { x: 150, step: 4, color: C.green, hollow: false },
  { x: 240, step: 7, color: C.orange },
  { x: 330, step: 3, color: C.rose, hollow: false },
]

export default function Landing () {
  const router = useRouter()
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')

  // Resolve platform after mount. In an "app" context (the Capacitor shell,
  // a phone or tablet browser, home-screen mode) there is nothing to
  // download, so the downloads link goes.
  const [isApp, setIsApp] = useState(false)
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const ua = navigator.userAgent
    setIsApp(
      Capacitor.isNativePlatform() ||
      /iPhone|iPod|iPad|Android/i.test(ua) ||
      (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ||   // iPadOS desktop UA
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true,
    )
    const mq = window.matchMedia('(max-width: 820px)')
    const sync = () => setNarrow(mq.matches)
    sync(); mq.addEventListener('change', sync)
    // /?door=signin or /?door=signup opens the door (links from /downloads)
    const door = new URLSearchParams(window.location.search).get('door')
    if (door === 'signin' || door === 'signup') { setAuthMode(door); setAuthOpen(true) }
    return () => mq.removeEventListener('change', sync)
  }, [])

  const open = (mode: 'signin' | 'signup') => { setAuthMode(mode); setAuthOpen(true) }

  return (
    <div className="sl">
      <div className="sl-grain" />

      <header className="sl-top">
        <a className="sl-logo" href="/" aria-label="slur studio"><SlurMark height={40} /><span>studio</span></a>
        <nav className="sl-nav">
          {!isApp && <a href="/downloads">downloads</a>}
          <button className="sl-word" onClick={() => open('signin')}>log in</button>
          <button className="sl-pill ink" onClick={() => open('signup')}>sign up</button>
        </nav>
      </header>

      <section className="sl-bar">
        {narrow
          ? <Bar key="n" w={390} h={760} y0={300} gap={34} s={28} notes={NARROW} />
          : <Bar key="w" w={1440} h={900} y0={330} gap={64} s={56} notes={WIDE} />}
      </section>

      <section className="sl-arch sl-room">
        <h2>slur</h2>
        <RoomPicture />
      </section>

      <footer className="sl-arch sl-foot">
        <div className="sl-foot-in">
          <SlurMark className="sl-foot-mark" height={300} ink={C.white} arm={C.orange} />
          <div className="sl-acts">
            <button className="sl-pill paper" onClick={() => open('signup')}>sign up</button>
            <button className="sl-pill ghost" onClick={() => open('signin')}>log in</button>
          </div>
        </div>
        <div className="sl-foot-row">
          {!isApp && <a href="/downloads">downloads</a>}
          <a href="/terms">terms</a>
          <a href="/privacy">privacy</a>
          <a href="mailto:wtsteven123@gmail.com?subject=copyright%20report">copyright</a>
          <span className="r">&copy; 2026 slur studio</span>
        </div>
      </footer>

      <AuthModal
        open={authOpen}
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
        onAuthed={() => router.replace('/app')}
      />
    </div>
  )
}
