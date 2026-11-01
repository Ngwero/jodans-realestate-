import crypto from 'node:crypto'
import nodemailer from 'nodemailer'

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
export function emailContent({ kind, url }) {
  const content = {
    verify: { title:'Confirm your Jodans account', button:'Confirm email', body:'Confirm your email address to finish creating your host account.', expiry:'This link expires in 24 hours.' },
    reset: { title:'Reset your Jodans password', button:'Reset password', body:'Use this link to choose a new password for your Jodans account.', expiry:'This link expires in 30 minutes.' },
    changed: { title:'Your Jodans password was changed', body:'Your account password was just changed. If this was not you, use Forgot password on the Jodans sign-in page immediately.', button:'Go to Jodans', expiry:'' },
  }[kind]
  if (!content) throw new Error('Unknown email type')
  const footer=kind==='changed'?'If you did not make this change, reset your password immediately.':'If you did not request this, ignore this email.'
  return {
    subject:content.title,
    text:`${content.title}\n\n${content.body}\n\n${url}\n\n${content.expiry}\n${footer}\nJodans Concepts`,
    html:`<!doctype html><html><body style="margin:0;background:#f5f5f3;font-family:Arial,sans-serif;color:#162b25"><main style="max-width:540px;margin:32px auto;padding:36px;background:#fff;border-radius:12px"><p style="font-weight:bold;letter-spacing:2px">JODANS CONCEPTS</p><h1 style="font-size:26px">${escape(content.title)}</h1><p>${escape(content.body)}</p><p style="margin:30px 0"><a href="${escape(url)}" style="display:inline-block;background:#173e30;color:#fff;padding:14px 22px;border-radius:6px;text-decoration:none">${content.button}</a></p><p>${content.expiry}</p><p style="font-size:13px;color:#666">${escape(footer)} Never share this link or your password.</p></main></body></html>`,
  }
}

export function createMailTransport(settings = process.env) {
  const from = settings.MAIL_FROM
  if (from && settings.RESEND_API_KEY) return {
    ready:true,
    async send(message,id) {
      const response=await fetch('https://api.resend.com/emails',{method:'POST',
        headers:{Authorization:`Bearer ${settings.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`jodans-${id}`},
        body:JSON.stringify({from,to:[message.to],...emailContent(message)}),signal:AbortSignal.timeout(15000)})
      if(!response.ok) throw new Error(`email_provider_http_${response.status}`)
    },
  }
  if (from && settings.SMTP_HOST && settings.SMTP_USER && settings.SMTP_PASSWORD) {
    const port=Number(settings.SMTP_PORT || 587)
    const transport=nodemailer.createTransport({host:settings.SMTP_HOST,port,secure:port===465,
      requireTLS:port!==465,auth:{user:settings.SMTP_USER,pass:settings.SMTP_PASSWORD},
      connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,
      disableFileAccess:true,disableUrlAccess:true})
    return {ready:true,async send(message,id) {
      await transport.sendMail({from,to:message.to,...emailContent(message),messageId:`<${id}@${new URL(settings.APP_URL || 'https://www.jodansconcepts.com').hostname}>`})
    }}
  }
  return {ready:false,async send(){throw new Error('email_not_configured')}}
}

export function createMailWorker(supabase,transport,secret) {
  const key=Buffer.from(crypto.hkdfSync('sha256',secret,'jodans-bloka','email-outbox-v1',32))
  let running, timer
  const encrypt = message => {
    const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv)
    const encrypted=Buffer.concat([cipher.update(JSON.stringify(message),'utf8'),cipher.final()])
    return [iv,cipher.getAuthTag(),encrypted].map(value=>value.toString('base64url')).join('.')
  }
  async function rpc(name,args) { const {data,error}=await supabase.rpc(name,args); if(error)throw error; return data }
  async function run() {
    if(!transport.ready)return
    for(let i=0;i<20;i++) {
      const item=await rpc('app_claim_email')
      if(!item)return
      let success=false
      const errorCode='delivery_failed'
      try {
        const [iv,tag,payload]=item.payload.split('.').map(value=>Buffer.from(value,'base64url'))
        const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag)
        const message=JSON.parse(Buffer.concat([decipher.update(payload),decipher.final()]).toString('utf8'))
        await transport.send(message,item.id)
        success=true
      } catch {console.error('Account email delivery failed; queued for retry.')}
      await rpc('app_finish_email',{p_id:item.id,p_lease:item.lease,p_success:success,p_error:errorCode})
    }
  }
  const drain=()=>running || (running=run().finally(()=>{running=null}))
  const kick=()=>{void drain().catch(()=>console.error('Email queue temporarily unavailable.'))}
  return {ready:transport.ready,encrypt,drain,kick,
    start(){if(transport.ready){kick();timer=setInterval(kick,30000);timer.unref()}},stop(){clearInterval(timer)}}
}
