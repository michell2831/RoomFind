import { createClient } from '@supabase/supabase-js'

const urlFromEnv = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Temporary fallback (use your real project URL here). Remove after debugging.
const FALLBACK_URL = 'https://dtgglwbaarfoooyityca.supabase.co'
const url = (urlFromEnv && urlFromEnv.length ? urlFromEnv : FALLBACK_URL) as string

// Debug: log which URL is being used at runtime (do NOT log the key)
try {
	// eslint-disable-next-line no-console
	console.log('VITE_SUPABASE_URL (env) =', urlFromEnv);
	// eslint-disable-next-line no-console
	console.log('Supabase client using URL =', url);
} catch (e) {
	// ignore
}

export const supabase = createClient(url, key)

export default supabase
