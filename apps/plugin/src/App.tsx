import { ChatSession } from '@orb/core/components/ChatSession.tsx'
import { useEffect, useState } from 'react'
import { authSessionStorage, supabase } from './lib/supabase'
import AuthPage from './pages/AuthPage'
import CollabPage from './pages/CollabPage'
import AdminPage from './pages/AdminPage'
import StudioShell from './pages/StudioShell'
import SoundsPage from './pages/SoundsPage'
import SoundsGraphDemo from './pages/SoundsGraphDemo'
import GamesPage from './pages/GamesPage'
import type { User } from '@supabase/supabase-js'

/** Split-out single-purpose builds load the page with ?surface=<name>.
 *  Orb Sounds needs no account — it boots straight into the fx room,
 *  before auth. Orb Chat and Orb Games keep the auth flow and branch
 *  below it (StudioShell / GamesPage). */
const SURFACE = new URLSearchParams(window.location.search).get('surface')

export default function App() {
  if (window.location.pathname === '/admin') {
    return <AdminPage />
  }
  if (SURFACE === 'sounds') {
    return <SoundsPage />
  }
  if (new URLSearchParams(window.location.search).has('soundsdemo')) {
    return <SoundsGraphDemo />
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
        if (session && !authSessionStorage.hasSession()) return
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

  // Orb Chat surface (?surface=chat) gets the Studio workspace.
  if (supabase && new URLSearchParams(window.location.search).get('surface') === 'chat') {
    return <ChatSession client={supabase} userId={user.id}><StudioShell supabase={supabase} user={user} /></ChatSession>
  }
  // Orb Games surface (?surface=games) — the CD wall, nothing else.
  if (supabase && SURFACE === 'games') {
    return <ChatSession client={supabase} userId={user.id}><GamesPage supabase={supabase} user={user} /></ChatSession>
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
      {supabase && <ChatSession client={supabase} userId={user.id}><CollabPage user={user} /></ChatSession>}
    </div>
  )
}
