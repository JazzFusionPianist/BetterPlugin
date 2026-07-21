import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import AuthPage from './pages/AuthPage'
import CollabPage from './pages/CollabPage'
import AdminPage from './pages/AdminPage'
import MonitorPanel from './components/collab/MonitorPanel'
import './pages/collab.css'
import type { User } from '@supabase/supabase-js'

export default function App() {
  if (window.location.pathname === '/admin') {
    return <AdminPage />
  }

  // Dev-only harness: ?monitordemo renders the monitor panel alone (demo
  // signal, no auth) so meter work can be inspected in a plain browser.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('monitordemo')) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
        <div className="plugin"><MonitorPanel isOpen /></div>
      </div>
    )
  }

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
        <AuthPage />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
      <CollabPage user={user} />
    </div>
  )
}
