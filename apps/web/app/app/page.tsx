'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/app/AppShell'
import StudioShell from '@/components/studio/StudioShell'
import { useMediaQuery } from '@/lib/useMediaQuery'

/**
 * Logged-in home. Auth-gated, then hands off to the hybrid AppShell
 * (orb-profile home + conversations rail). This whole app is what
 * Capacitor wraps for mobile, so the layout is responsive: wide on
 * desktop, single-column on narrow.
 */
export default function AppHome() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  // Desktop gets the studio workspace (the Orb Chat plug-in's layout);
  // phones keep the single-column shell. Decided on the client only.
  const wide = useMediaQuery('(min-width: 821px)')
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      if (!data.session) { router.replace('/'); return }
      setUser(data.session.user)
      setChecking(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace('/')
      else setUser(session.user)
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [router])

  if (checking || !user || !mounted) {
    return <div className="splash"><div className="spinner" /></div>
  }
  return wide ? <StudioShell user={user} /> : <AppShell user={user} />
}
