import { createClient } from '@supabase/supabase-js'
import { authStorageKey, createAuthSessionStorage } from '@orb/core/lib/authSessionStorage.ts'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isConfigured =
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  supabaseAnonKey !== 'your-supabase-anon-key-here'

export const authSessionStorage = createAuthSessionStorage(isConfigured ? authStorageKey(supabaseUrl) : 'slur-unconfigured-auth')

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { storage: authSessionStorage.storage, persistSession: true, autoRefreshToken: true } })
  : null

export { isConfigured }
