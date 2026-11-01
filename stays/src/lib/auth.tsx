import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, type SessionUser } from './api'

type AuthState = {
  user: SessionUser | null
  token: string | null
  loading: boolean
  login: (email: string, password: string, role?: 'admin' | 'host') => Promise<SessionUser>
  registerHost: (name: string, email: string, password: string) => Promise<SessionUser>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

function loadUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem('jb_user')
    return raw ? (JSON.parse(raw) as SessionUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('jb_token'))
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('jb_token')))
  const [user, setUser] = useState<SessionUser | null>(() => loadUser())

  useEffect(() => {
    if (!token) return
    let alive = true
    api.me().then(({ user }) => {
      if (!alive) return
      localStorage.setItem('jb_user', JSON.stringify(user))
      setUser(user)
    }).catch(() => {
      if (!alive) return
      localStorage.removeItem('jb_token')
      localStorage.removeItem('jb_user')
      setLoading(false)
      setToken(null)
      setUser(null)
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [token])

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      loading,
      async login(email, password, role) {
        const res = await api.login(email, password, role)
        localStorage.setItem('jb_token', res.token)
        localStorage.setItem('jb_user', JSON.stringify(res.user))
        setToken(res.token)
        setUser(res.user)
        return res.user
      },
      async registerHost(name, email, password) {
        const res = await api.registerHost(name, email, password)
        localStorage.setItem('jb_token', res.token)
        localStorage.setItem('jb_user', JSON.stringify(res.user))
        setToken(res.token)
        setUser(res.user)
        return res.user
      },
      logout() {
        setLoading(false)
        localStorage.removeItem('jb_token')
        localStorage.removeItem('jb_user')
        setToken(null)
        setUser(null)
      },
    }),
    [token, user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth requires AuthProvider')
  return ctx
}
