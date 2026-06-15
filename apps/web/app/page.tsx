'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Landing from '@/components/Landing'

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  // If already signed in, skip the landing and go straight to the app.
  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      if (data.session) router.replace('/app')
      else setChecking(false)
    })
    return () => { alive = false }
  }, [router])

  if (checking) {
    return <div className="splash"><div className="spinner" /></div>
  }
  return <Landing />
}
