import { createClient } from '@supabase/supabase-js'

const urlFromEnv = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Fallback URL if env var is not set
const FALLBACK_URL = 'https://dtgglwbaarfoooyityca.supabase.co'
const url = (urlFromEnv && urlFromEnv.length ? urlFromEnv : FALLBACK_URL) as string

// ⚠️ Debug logs removed for security — do not log Supabase URL or keys to the console

export const supabase = createClient(url, key)

export const createTempClient = () => createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
})

export default supabase
