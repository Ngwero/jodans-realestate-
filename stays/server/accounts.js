import crypto from 'node:crypto'
import { hashPassword, verifyPassword, signToken } from './auth.js'

const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
const validEmail=value=>typeof value==='string' && value.length<=254 && emailPattern.test(value.trim())
const validPassword=value=>typeof value==='string' && value.length>=8 && value.length<=1024
const validToken=value=>typeof value==='string' && /^[A-Za-z0-9_-]{43}$/.test(value)
const digest=value=>crypto.createHash('sha256').update(value).digest('hex')
export function installAccountRoutes(app,{supabase,readDb,secret,auth,worker,appUrl}) {
  const origin=new URL(appUrl).origin
  if(process.env.NODE_ENV==='production' && !origin.startsWith('https://'))throw new Error('APP_URL must use HTTPS in production')
  const rpc=async(name,args)=>{const {data,error}=await supabase.rpc(name,args);if(error)throw error;return data}
  const available=(_req,res,next)=>worker.ready ? next() : res.status(503).json({error:'Account emails are temporarily unavailable. Please try again later.'})
  async function limit(req,email) {
    const key=value=>crypto.createHmac('sha256',secret).update(value).digest('hex')
    const ip=await rpc('app_auth_take_limit',{p_key:key(`account-ip:${req.ip}`),p_max:30,p_seconds:900})
    const address=await rpc('app_auth_take_limit',{p_key:key(`account-email:${email}`),p_max:5,p_seconds:3600})
    return ip && address
  }
  const actionMail=(email,kind)=>{
    const token=crypto.randomBytes(32).toString('base64url')
    const path=kind==='verify'?'/verify-email':'/reset-password'
    return {hash:digest(token),payload:worker.encrypt({to:email,kind,url:`${origin}${path}#token=${token}`})}
  }
  const sessionResponse=user=>({token:signToken(user,secret),user:{id:user.id,email:user.email,name:user.name,role:user.role}})

  app.post('/api/auth/login',async(req,res)=>{
    const {email,password,role}=req.body || {}
    if(!validEmail(email) || typeof password!=='string' || !password || password.length>1024)return res.status(400).json({error:'Email and password required'})
    const db=await readDb()
    const user=db.users.find(row=>row.email.toLowerCase()===email.trim().toLowerCase())
    if(!user || !await verifyPassword(password,user.password) || (role && user.role!==role && user.role!=='admin'))return res.status(401).json({error:'Invalid email or password'})
    const identity=await rpc('app_auth_identity',{p_id:user.id})
    if(!identity || !identity.active)return res.status(403).json({error:'Account disabled'})
    if(!identity.emailVerified)return res.status(403).json({error:'Confirm your email before signing in. You can resend the confirmation email below.',code:'EMAIL_NOT_VERIFIED'})
    res.json(sessionResponse(identity))
  })

  app.post('/api/auth/register-host',available,async(req,res)=>{
    const {email,password,name}=req.body || {}
    if(!validEmail(email) || !validPassword(password) || typeof name!=='string' || !name.trim() || name.length>120)return res.status(400).json({error:'Name, valid email, and a password of at least 8 characters required'})
    const normalized=email.trim().toLowerCase()
    if(!await limit(req,normalized))return res.status(429).json({error:'Too many requests. Please try again later.'})
    const mail=actionMail(normalized,'verify')
    await rpc('app_register_pending',{p_id:crypto.randomUUID(),p_email:normalized,p_name:name.trim(),p_password:await hashPassword(password),p_hash:mail.hash,p_payload:mail.payload})
    worker.kick()
    res.status(202).json({message:'Check your email to confirm your account. If you already have an account, sign in or reset your password.'})
  })

  for(const [path,kind] of [['forgot-password','reset'],['resend-verification','verify']]) {
    app.post(`/api/auth/${path}`,available,async(req,res)=>{
      const email=req.body?.email
      if(!validEmail(email))return res.status(400).json({error:'Enter a valid email address'})
      const normalized=email.trim().toLowerCase()
      if(!await limit(req,normalized))return res.status(429).json({error:'Too many requests. Please try again later.'})
      const mail=actionMail(normalized,kind)
      await rpc('app_request_account_email',{p_email:normalized,p_kind:kind,p_hash:mail.hash,p_payload:mail.payload})
      worker.kick()
      res.status(202).json({message:kind==='reset'?'If an eligible account exists, you will receive a password reset email.':'If confirmation is needed, you will receive a confirmation email.'})
    })
  }

  app.post('/api/auth/verify-email',async(req,res)=>{
    const token=req.body?.token
    if(!validToken(token))return res.status(400).json({error:'This confirmation link is invalid or expired. Request a new one.'})
    const valid=await rpc('app_consume_account_token',{p_hash:digest(token),p_kind:'verify'})
    if(!valid)return res.status(400).json({error:'This confirmation link is invalid or expired. Request a new one.'})
    res.json({message:'Email confirmed. You can now sign in.'})
  })

  app.post('/api/auth/reset-password',async(req,res)=>{
    const {token,password}=req.body || {}
    if(!validToken(token) || !validPassword(password))return res.status(400).json({error:'Use a valid reset link and a password of at least 8 characters.'})
    const rateKey=crypto.createHmac('sha256',secret).update(`reset-submit:${req.ip}`).digest('hex')
    if(!await rpc('app_auth_take_limit',{p_key:rateKey,p_max:20,p_seconds:900}))return res.status(429).json({error:'Too many requests. Please try again later.'})
    const hash=digest(token)
    const email=await rpc('app_account_token_email',{p_hash:hash})
    if(!email)return res.status(400).json({error:'This reset link is invalid or expired. Request a new one.'})
    const payload=worker.encrypt({to:email,kind:'changed',url:`${origin}/host/login`})
    const valid=await rpc('app_consume_account_token',{p_hash:hash,p_kind:'reset',p_password:await hashPassword(password),p_payload:payload})
    if(!valid)return res.status(400).json({error:'This reset link is invalid or expired. Request a new one.'})
    worker.kick()
    res.json({message:'Password updated. Sign in with your new password. Previous sessions have been signed out.'})
  })

  app.get('/api/auth/me',auth(),(req,res)=>{
    const {sub:id,name,email,role}=req.user
    res.json({user:{id,name,email,role}})
  })
}
