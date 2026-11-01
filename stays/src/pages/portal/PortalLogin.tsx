import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../../components/BrandLogo'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'

type Props = { role:'admin'|'host'; title:string; subtitle:string; redirectTo:string; allowRegister?:boolean }
export function PortalLogin({role,title,subtitle,redirectTo,allowRegister}:Props) {
  const {user,login,registerHost,loading:authLoading}=useAuth()
  const navigate=useNavigate()
  const [mode,setMode]=useState<'login'|'register'|'forgot'>('login')
  const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('')
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(false)
  if(authLoading)return <p role="status">Loading your account…</p>
  if(user?.role===role || role==='host' && user?.role==='admin')return <Navigate to={redirectTo} replace />
  const changeMode=(next:typeof mode)=>{setMode(next);setError('');setNotice('')}
  async function submit(event:FormEvent) {
    event.preventDefault();setError('');setNotice('');setLoading(true)
    try {
      if(mode==='forgot'){setNotice((await api.requestPasswordReset(email)).message);return}
      if(mode==='register'){setNotice(await registerHost(name,email,password));setPassword('');return}
      await login(email,password,role);navigate(redirectTo)
    } catch(error){setError(error instanceof Error?error.message:'Could not complete this request')}
    finally{setLoading(false)}
  }
  async function resend() {
    setError('');setNotice('');setLoading(true)
    try{setNotice((await api.resendVerification(email)).message)}
    catch(error){setError(error instanceof Error?error.message:'Could not send email')}
    finally{setLoading(false)}
  }
  return <div className={`portal-shell ${role}`}><div className="portal-card">
    <Link to="/" className="portal-brand"><BrandLogo compact /></Link>
    <p className="portal-kicker">{role==='admin'?'Admin portal':'Host portal'}</p>
    <h1>{mode==='forgot'?'Reset your password':mode==='register'?'Create a host account':title}</h1>
    <p className="portal-sub">{mode==='forgot'?'Enter your account email and we’ll send a reset link.':mode==='register'?'Confirm your email to submit properties for approval.':subtitle}</p>
    {allowRegister && <div className="portal-tabs">
      <button type="button" className={mode==='login'?'on':''} onClick={()=>changeMode('login')}>Sign in</button>
      <button type="button" className={mode==='register'?'on':''} onClick={()=>changeMode('register')}>Create host account</button>
    </div>}
    <form className="portal-form" onSubmit={submit}>
      {mode==='register' && <label>Full name<input autoComplete="name" maxLength={120} value={name} onChange={event=>setName(event.target.value)} required /></label>}
      <label>Email<input type="email" autoComplete="username" maxLength={254} value={email} onChange={event=>setEmail(event.target.value)} required /></label>
      {mode!=='forgot' && <label>Password<input type="password" autoComplete={mode==='register'?'new-password':'current-password'} minLength={mode==='register'?8:undefined} maxLength={1024} value={password} onChange={event=>setPassword(event.target.value)} required /></label>}
      {notice && <p className="account-notice" role="status">{notice}</p>}
      {error && <p className="portal-error" role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={loading}>{loading?'Please wait…':mode==='forgot'?'Send reset link':mode==='register'?'Create account':'Sign in'}</button>
    </form>
    <div className="account-links">
      <button type="button" disabled={loading} onClick={()=>changeMode(mode==='forgot'?'login':'forgot')}>{mode==='forgot'?'Back to sign in':'Forgot password?'}</button>
      {mode!=='forgot' && <button type="button" disabled={loading || !email} onClick={resend}>Resend confirmation email</button>}
    </div>
    <Link to="/" className="portal-back">← Back to marketplace</Link>
  </div></div>
}
