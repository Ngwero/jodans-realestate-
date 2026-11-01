import './env.js'
import nodemailer from 'nodemailer'
if(!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !process.env.MAIL_FROM) {
  console.error('Set MAIL_FROM, SMTP_HOST, SMTP_USER, and SMTP_PASSWORD before enabling account email.')
  process.exitCode=1
} else {
  const port=Number(process.env.SMTP_PORT || 465)
  const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure:port===465,requireTLS:port!==465,
    auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000})
  try {await transport.verify();console.log('SMTP connection and authentication verified. No email was sent.')}
  catch {console.error('SMTP verification failed. Check the mailbox credentials and provider access.');process.exitCode=1}
  finally{transport.close()}
}
