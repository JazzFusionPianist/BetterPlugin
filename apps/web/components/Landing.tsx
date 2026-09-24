'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import AuthModal from './AuthModal'
import SlurMark from './slur/SlurMark'
import Bar from './slur/Bar'
import Cover from './slur/Cover'
import TiedPhrase from './slur/TiedPhrase'
import { C } from './slur/marks'
import '@/app/slur.css'

/* The page before you log in. A cover first — one print on an empty
   ground turning its pages, under a pictogram nav, the name travelling
   along the floor — then one phrase, tied, over a bar of music whose notes
   sound when touched, then the door. Every edge is a curve. */

const WIDE = [
  { x: 180, step: 1, color: C.blue },
  { x: 390, step: 3, color: '#2F9A62', hollow: false },
  { x: 600, step: 6, color: C.orange },
  { x: 790, step: 8, color: C.rose, hollow: false },
  { x: 990, step: 5, color: C.lilac },
  { x: 1220, step: 2, color: C.ink },
]
const NARROW = [
  { x: 60, step: 1, color: C.blue },
  { x: 150, step: 4, color: '#2F9A62', hollow: false },
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

  // the phrase ties itself and the notes fall when it comes into view, not on load
  const phrase = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = phrase.current; if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('seen'); io.disconnect() } }, { threshold: .35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div className="sl">
      <div className="sl-grain" />

      <Cover nav={(
        <nav className="sl-cells">
          <a className="sl-cell hide-narrow" href="/downloads#slur">
            <svg width="30" height="30" viewBox="-15 -15 30 30" aria-hidden="true"><path d="M -12.98 -5.24 A 14 9.8 -22 1 0 12.98 5.24 A 14 9.8 -22 1 0 -12.98 -5.24 Z M -2.3 -5.4 A 5.9 7.3 38 1 1 2.3 5.4 A 5.9 7.3 38 1 1 -2.3 -5.4 Z" fill={C.green} fillRule="evenodd" /></svg>
            <span><b>slur</b><small>the room<br />chat stems dates</small></span>
          </a>
          <a className="sl-cell hide-narrow" href="/downloads#patch-on-slur">
            <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect x="2" y="2" width="26" height="26" fill="#8C5A3A" /><g fill="none" stroke={C.white} strokeWidth="1.1"><circle cx="15" cy="15" r="9" /><circle cx="15" cy="15" r="5.5" /><circle cx="15" cy="15" r="2.2" /></g></svg>
            <span><b>patch on slur</b><small>the wall<br />no account</small></span>
          </a>
          {!isApp && (
            <a className="sl-cell hide-narrow" href="/downloads">
              <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><path d="M 4 29 V 13 A 11 11 0 0 1 26 13 V 29 Z" fill="none" stroke={C.ink} strokeWidth="1.6" /><path d="M 15 11 V 22 M 10.5 17.5 L 15 22 L 19.5 17.5" fill="none" stroke={C.ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span><b>downloads</b><small>mac<br />au vst3 aax</small></span>
            </a>
          )}
          <button className="sl-cell" onClick={() => open('signin')}>
            <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><path d="M 2 29 V 1 H 16 A 13 14 0 0 1 16 29 Z" fill={C.lilac} /><circle cx="20" cy="15" r="1.8" fill={C.ink} /></svg>
            <span><b>log in</b><small>sign up<br />web</small></span>
          </button>
        </nav>
      )} />

      <section className="sl-arch sl-phrase" ref={phrase}>
        <TiedPhrase />
        <div className="sl-phrase-bar">
          {narrow
            ? <Bar key="n" w={390} h={300} y0={130} gap={30} s={24} notes={NARROW} line="rgba(26,25,23,.22)" />
            : <Bar key="w" w={1440} h={420} y0={110} gap={46} s={40} notes={WIDE} line="rgba(26,25,23,.22)" />}
        </div>
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
