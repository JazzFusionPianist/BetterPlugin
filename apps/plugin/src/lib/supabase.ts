import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isConfigured =
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  supabaseAnonKey !== 'your-supabase-anon-key-here'

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export { isConfigured }
