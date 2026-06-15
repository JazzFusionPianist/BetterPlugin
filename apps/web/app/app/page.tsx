'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import OrbBackground from '@/components/OrbBackground'

/**
 * Placeholder app shell — the logged-in home. The real product surfaces
 * (chat, friends, calendar, music community) get ported in here from the
 * plugin app, one at a time. This whole web app is what Capacitor wraps
 * for mobile.
 */
export default function AppHome() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      if (!data.session) { router.replace('/'); return }
      setUser(data.session.user)
      setChecking(false)
    })
    // React to sign-out from anywhere.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace('/')
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [router])

  if (checking) {
    return <div className="splash"><div className="spinner" /></div>
  }

  const name = (user?.user_metadata?.display_name as string | undefined)
    ?? user?.email?.split('@')[0] ?? 'there'

  return (
    <>
      <OrbBackground />
      <div className="grain" />
      <div className="veil" />
      <div className="appshell">
        <span className="word"><span className="mark" />Orb</span>
        <h2>You&rsquo;re in, {name}.</h2>
        <p>The web app is taking shape — chat, your crew, sessions, and more are coming here next.</p>
        <div className="who">{user?.email}</div>
        <button className="signout" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </>
  )
}
