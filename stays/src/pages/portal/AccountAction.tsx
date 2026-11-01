import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '../../components/BrandLogo'
import { api } from '../../lib/api'

export function AccountAction({kind}: {kind:'verify'|'reset'}) {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '')
  const [password,setPassword] = useState('')
  const [confirm,setConfirm] = useState('')
  const [error,setError] = useState('')
  const [message,setMessage] = useState('')
  const [busy,setBusy] = useState(false)
  useEffect(() => {
    // Remove sensitive link material before third-party links can be followed.
    window.history.replaceState(null,'',window.location.pathname)
  },[])
  async function submit(event: FormEvent) {
    event.preventDefault();setError('')
    if(kind==='reset' && password!==confirm){setError('Passwords do not match.');return}
    setBusy(true)
    try {
      const result=kind==='verify'?await api.verifyEmail(token):await api.resetPassword(token,password)
      setMessage(result.message)
    } catch(error){setError(error instanceof Error?error.message:'Could not complete this request.')}
    finally{setBusy(false)}
  }
  return <div className="portal-shell host"><div className="portal-card">
    <Link to="/" className="portal-brand" aria-label="Jodans Concepts home"><BrandLogo compact /></Link>
    <p className="portal-kicker">Account</p><h1>{kind==='verify'?'Confirm your email':'Choose a new password'}</h1>
    {message?<p className="account-notice" role="status">{message}</p>:!token?
      <p className="portal-error" role="alert">This link is missing or expired. Request another from the sign-in page.</p>:
      <form className="portal-form" onSubmit={submit}>
        <p className="portal-sub">{kind==='verify'?'Confirm your email address to finish setting up your account.':'Use at least 8 characters. Your previous sessions will be signed out.'}</p>
        {kind==='reset' && <>
          <label>New password<input type="password" autoComplete="new-password" required minLength={8} maxLength={1024} value={password} onChange={event=>setPassword(event.target.value)} /></label>
          <label>Confirm password<input type="password" autoComplete="new-password" required minLength={8} maxLength={1024} value={confirm} onChange={event=>setConfirm(event.target.value)} /></label>
        </>}
        {error && <p className="portal-error" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy?'Please wait…':kind==='verify'?'Confirm email':'Save new password'}</button>
      </form>}
    <p className="account-links"><Link to="/host/login">Host sign in</Link><Link to="/admin/login">Admin sign in</Link></p>
  </div></div>
}
