import './env.js'
import { createSupabaseAdmin } from './supabase.js'
import { createApp } from './app.js'
import { fileURLToPath } from 'node:url'

const supabase = createSupabaseAdmin()
const { error } = await supabase.from('app_profiles').select('id').limit(1)
if (error) throw new Error('Supabase database unavailable. Check environment settings and run the SQL migration first.')
const port = Number(process.env.PORT || 4000)
const webDirectory = process.env.NODE_ENV === 'production'
  ? fileURLToPath(new URL('../dist/', import.meta.url))
  : undefined
createApp(supabase, { webDirectory }).listen(port, '0.0.0.0', () => {
  console.log(`Jodans Bloka API on port ${port} (Supabase)`)
})
