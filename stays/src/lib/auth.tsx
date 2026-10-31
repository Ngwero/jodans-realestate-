import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, type SessionUser } from './api'
import { browserSupabase, supabase } from './supabase'

type AuthState = {
  user: SessionUser | null
  token: string | null
  loading: boolean
  authError: string
  login: (email: string, password: string, role?: 'admin' | 'host') => Promise<SessionUser>
  registerHost: (name: string, email: string, password: string) => Promise<SessionUser | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    // Old custom tokens are deliberately not accepted by the new API.
    localStorage.removeItem('jb_token')
    localStorage.removeItem('jb_user')
    if (!supabase) return
    let alive = true
    let sequence = 0
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const current = ++sequence
      setToken(session?.access_token ?? null)
      if (!session) {
        setUser(null)
        setLoading(false)
        return
      }
      // Run outside the auth callback to avoid locking Supabase's session manager.
      setTimeout(() => {
        if (!alive || current !== sequence) return
        api.me().then(({ user: profile }) => {
          if (alive && current === sequence) { setUser(profile); setAuthError('') }
        }).catch((error: Error) => {
          if (alive && current === sequence) { setUser(null); setAuthError(error.message) }
        }).finally(() => {
          if (alive && current === sequence) setLoading(false)
        })
      }, 0)
    })
    return () => { alive = false; subscription.unsubscribe() }
  }, [])

  const value = useMemo<AuthState>(() => ({
    user, token, loading, authError,
    async login(email, password, role) {
      const client = browserSupabase()
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) throw error
      try {
        const { user: profile } = await api.me()
        if (role === 'admin' && profile.role !== 'admin') throw new Error('This account does not have admin access.')
        setUser(profile)
        setAuthError('')
        return profile
      } catch (error) {
        await client.auth.signOut({ scope: 'local' })
        throw error
      }
    },
    async registerHost(name, email, password) {
      const { data, error } = await browserSupabase().auth.signUp({
        email, password,
        options: { data: { name }, emailRedirectTo: `${window.location.origin}/host/login` },
      })
      if (error) throw error
      if (!data.session) return null
      const { user: profile } = await api.me()
      setUser(profile)
      return profile
    },
    async logout() {
      const { error } = await browserSupabase().auth.signOut({ scope: 'local' })
      if (error) { setAuthError(error.message); return }
      setUser(null)
      setToken(null)
    },
  }), [user, token, loading, authError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth requires AuthProvider')
  return ctx
}
