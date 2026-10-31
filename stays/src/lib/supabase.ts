import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

function isPublicKey(value: string): boolean {
  if (value.startsWith('sb_publishable_')) return true
  try {
    const payload = value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload)).role === 'anon'
  } catch { return false }
}

// Fail closed if a backend secret is accidentally supplied to the browser.
export const supabase = url && key && isPublicKey(key)
  ? createClient(url, key)
  : null

export function browserSupabase() {
  if (!supabase) throw new Error('Sign-in is not configured. Set the public Supabase URL and anon/publishable key, then rebuild the app.')
  return supabase
}
