import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../../components/BrandLogo'
import { useAuth } from '../../lib/auth'

type Props = {
  role: 'admin' | 'host'
  title: string
  subtitle: string
  redirectTo: string
  allowRegister?: boolean
}

export function PortalLogin({ role, title, subtitle, redirectTo, allowRegister }: Props) {
  const { user, login, registerHost, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (authLoading) return <p role="status">Loading your account…</p>

  if (user?.role === role || (role === 'host' && user?.role === 'admin')) {
    return <Navigate to={redirectTo} replace />
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'register' && allowRegister) {
        await registerHost(name, email, password)
      } else {
        await login(email, password, role)
      }
      navigate(redirectTo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`portal-shell ${role}`}>
      <div className="portal-card">
        <Link to="/" className="portal-brand">
          <BrandLogo compact />
        </Link>
        <p className="portal-kicker">{role === 'admin' ? 'Admin portal' : 'Host portal'}</p>
        <h1>{title}</h1>
        <p className="portal-sub">{subtitle}</p>

        {allowRegister && (
          <div className="portal-tabs">
            <button
              type="button"
              className={mode === 'login' ? 'on' : ''}
              onClick={() => setMode('login')}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'on' : ''}
              onClick={() => setMode('register')}
            >
              Create host account
            </button>
          </div>
        )}

        <form className="portal-form" onSubmit={submit}>
          {mode === 'register' && (
            <label>
              Full name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              minLength={mode === 'register' ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="portal-error">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <Link to="/" className="portal-back">
          ← Back to marketplace
        </Link>
      </div>
    </div>
  )
}
