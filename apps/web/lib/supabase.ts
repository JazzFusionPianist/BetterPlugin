import { createClient } from '@supabase/supabase-js'
import { authStorageKey, createAuthSessionStorage } from '@orb/core/lib/authSessionStorage.ts'

// Same project as the plugin app — one backend for plugin / web / mobile.
// The anon key is public by design (RLS enforces access server-side).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
export const authSessionStorage = createAuthSessionStorage(authStorageKey(url))

export const supabase = createClient(url, key, {
  auth: {
    storage: authSessionStorage.storage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
