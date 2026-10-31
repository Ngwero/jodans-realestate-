import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { browserSupabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

export function PasswordReset() {
  const { token, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setSaving(true)
    try {
      const { error } = await browserSupabase().auth.updateUser({ password })
      if (error) throw error
      setDone(true)
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not reset password.') }
    finally { setSaving(false) }
  }
  return <div className="portal-shell host"><div className="portal-card">
    <h1>Set your password</h1>
    {loading ? <p role="status">Checking your reset link…</p> : done ? <p role="status">Password updated.</p> : !token ?
      <p>This reset link is missing or expired. Request another from the sign-in page.</p> :
      <form className="portal-form" onSubmit={submit}>
        <label>New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></label>
        <label>Confirm password<input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={event => setConfirm(event.target.value)} /></label>
        {error && <p role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save password'}</button>
      </form>}
    <Link to="/host/login">Host sign in</Link> · <Link to="/admin/login">Admin sign in</Link>
  </div></div>
}
