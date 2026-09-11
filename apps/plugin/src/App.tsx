import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import AuthPage from './pages/AuthPage'
import CollabPage from './pages/CollabPage'
import AdminPage from './pages/AdminPage'
import WorkspaceDemo from './pages/WorkspaceDemo'
import StudioShell from './pages/StudioShell'
import type { User } from '@supabase/supabase-js'

export default function App() {
  if (window.location.pathname === '/admin') {
    return <AdminPage />
  }

  // TEMP mockup branch — DELETE before commit.
  if (new URLSearchParams(window.location.search).has('workdemo')) {
    return <WorkspaceDemo />
  }

  // TEMP smoke route — StudioShell with a mock user (anon client, empty
  // data) so the browser preview can exercise the real shell. Private
  // branch only; remove before merging to main.
  if (new URLSearchParams(window.location.search).has('studiodemo') && supabase) {
    const mockUser = { id: '00000000-0000-0000-0000-000000000000', email: 'demo@orb.app' } as User
    return <StudioShell supabase={supabase} user={mockUser} />
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

  // Orb Chat surface (?surface=chat) gets the Studio workspace.
  if (supabase && new URLSearchParams(window.location.search).get('surface') === 'chat') {
    return <StudioShell supabase={supabase} user={user} />
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
      <CollabPage user={user} />
    </div>
  )
}
