import './env.js'
import { createSupabaseAdmin } from './supabase.js'
import { createApp } from './app.js'

const supabase = createSupabaseAdmin()
const { error } = await supabase.from('app_profiles').select('id').limit(1)
if (error) throw new Error('Supabase database unavailable. Check environment settings and run the SQL migration first.')
const port = Number(process.env.PORT || 4000)
createApp(supabase).listen(port, () => {
  console.log(`Jodans Bloka API on port ${port} (Supabase)`)
})
