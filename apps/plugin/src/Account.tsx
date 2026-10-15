import { useEffect, useState, type ReactNode } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { authSessionStorage, supabase } from './lib/supabase'
import AuthPage from './pages/AuthPage'

/*  The signed-in account, for a product page that needs one (Slur, Slur Games). Waits for the session, shows the door
    while there is none, then hands the user to the page. (The site's App.tsx keeps its own copy of this flow for the
    combined page; the product pages are built apart from it so each ships only what it uses.)                        */

export default function Account ({ children }: { children: (client: SupabaseClient, user: User) => ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession()
      .then(({ data: { session } }) => { setUser(session?.user ?? null) })
      .catch(() => {})
      .finally(() => setLoading(false))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !authSessionStorage.hasSession()) return
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />
      </div>
    )
  }
  if (!user || !supabase) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
        <AuthPage />
      </div>
    )
  }
  return <>{children(supabase, user)}</>
}
