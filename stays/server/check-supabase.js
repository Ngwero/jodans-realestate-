import { createSupabaseAdmin } from './supabase.js'
import { PHOTO_BUCKET } from './photos.js'

try {
  const supabase = createSupabaseAdmin()
  const { data: buckets, error } = await supabase.storage.listBuckets()
  if (error) throw new Error('Supabase rejected the connection. Check the project URL and backend secret key.')
  if (!buckets.some(bucket => bucket.id === PHOTO_BUCKET && bucket.public)) {
    throw new Error('Run the SQL migration first: the public property-photos bucket is missing.')
  }
  const { error: credentialsError } = await supabase.from('app_credentials').select('profile_id').limit(1)
  if (credentialsError) throw new Error('Run the existing-login SQL migration first: app_credentials is unavailable.')
  const { error: accountError } = await supabase.rpc('app_auth_identity', { p_id: '__configuration_check__' })
  if (accountError) throw new Error('Run the account-email SQL migration first: account functions are unavailable.')
  const { data: state, error: databaseError } = await supabase.rpc('app_read_state')
  if (databaseError) throw new Error('Database check failed. Run the SQL migration and check backend access.')
  console.log(`Supabase ready: ${state.listings.length} listings and ${state.users.length} accounts; property-photos bucket available. No project data was changed.`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
