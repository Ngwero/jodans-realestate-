import './env.js'
import { createSupabaseAdmin } from './supabase.js'
import { createApp } from './app.js'
import { fileURLToPath } from 'node:url'

const supabase = createSupabaseAdmin()
const { error } = await supabase.from('app_credentials').select('profile_id').limit(1)
if (error) throw new Error('Supabase database unavailable. Check environment settings and run the SQL migrations first.')
const { error: accountError } = await supabase.rpc('app_auth_identity', { p_id: '__configuration_check__' })
if (accountError) throw new Error('Apply the account-email SQL migration before starting this release.')
const port = Number(process.env.PORT || 4000)
const webDirectory = process.env.NODE_ENV === 'production'
  ? fileURLToPath(new URL('../dist/', import.meta.url))
  : undefined
const app = createApp(supabase, { webDirectory })
app.locals.mailWorker.start()
app.listen(port, '0.0.0.0', () => {
  console.log(`Jodans Bloka API on port ${port} (Supabase)`)
})
