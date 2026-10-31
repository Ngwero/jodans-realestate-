import './env.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes, randomUUID } from 'node:crypto'
import { createSupabaseAdmin } from './supabase.js'
import { PHOTO_BUCKET, PHOTO_TYPES } from './photos.js'

const defaultRoot = fileURLToPath(new URL('../', import.meta.url))
const check = (result) => { if (result.error) throw result.error; return result.data }

// This command creates no emails and never copies legacy password hashes.
// Existing hosts use the password-reset form after import to set a new password.
export async function migrate(options = {}) {
  const settings = options.settings || process.env
  const root = options.root || defaultRoot
  const localPath = path.join(root, 'server/data/db.json')
  const uploadsPath = path.join(root, 'public/uploads')
  const email = settings.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
  const password = settings.BOOTSTRAP_ADMIN_PASSWORD
  const name = settings.BOOTSTRAP_ADMIN_NAME || 'Platform Admin'
  if (!email || !password || password.length < 12) {
    throw new Error('Set BOOTSTRAP_ADMIN_EMAIL and a BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters before importing.')
  }
  const supabase = options.supabase || createSupabaseAdmin()
  check(await supabase.from('app_profiles').select('id').limit(1))
  const buckets = check(await supabase.storage.listBuckets())
  if (!buckets.some(bucket => bucket.id === PHOTO_BUCKET)) throw new Error('Run the SQL migration first (property-photos bucket is missing).')

  let local
  try { local = JSON.parse(await fs.readFile(localPath, 'utf8')) }
  catch (error) {
    if (error.code !== 'ENOENT') throw error
    const seed = JSON.parse(await fs.readFile(path.join(root, 'src/data/red-scraped.json'), 'utf8'))
    local = { users: [], activity: [], listings: seed.map(item => ({ ...item, id: String(item.id || item.code || randomUUID()), hostId: 'host-demo', approval: 'approved' })) }
  }
  if (![local.users, local.listings, local.activity].every(Array.isArray)) throw new Error('Invalid local database shape.')

  // Check all referenced local files before creating accounts or changing data.
  const localPhotos = new Set(local.listings.flatMap(listing => listing.images || []).filter(src => src.startsWith('/uploads/')))
  for (const src of localPhotos) {
    const filename = src.slice('/uploads/'.length)
    if (!filename || path.basename(filename) !== filename) throw new Error('Unsafe local photo path.')
    const extension = path.extname(filename).toLowerCase()
    if (![...PHOTO_TYPES.values(), '.jpeg'].includes(extension)) throw new Error('Unsupported local photo extension.')
    const stat = await fs.stat(path.join(uploadsPath, filename))
    if (stat.size > 8 * 1024 * 1024) throw new Error('A local photo exceeds the 8 MB upload limit.')
  }

  const users = []
  for (let page = 1; ; page++) {
    const batch = check(await supabase.auth.admin.listUsers({ page, perPage: 1000 })).users
    users.push(...batch)
    if (batch.length < 1000) break
  }
  async function findOrCreate(userEmail, userName, admin = false) {
    const existing = users.find(user => user.email?.toLowerCase() === userEmail.toLowerCase())
    if (existing) return existing
    const { user } = check(await supabase.auth.admin.createUser({
      email: userEmail,
      password: admin ? password : randomBytes(32).toString('hex'),
      email_confirm: admin,
      user_metadata: { name: userName || 'Host' },
    }))
    users.push(user)
    return user
  }
  const admin = await findOrCreate(email, name, true)
  // Bootstrap is an explicit operator action. Reruns never reset its password.
  check(await supabase.from('app_profiles').update({ role: 'admin', active: true }).eq('id', admin.id))
  const ownerMap = new Map([['admin-1', admin.id], ['host-demo', admin.id]])
  for (const legacy of local.users) {
    if (ownerMap.has(legacy.id)) continue
    if (!legacy.email) throw new Error('A local account has no email; correct it before import.')
    const user = await findOrCreate(legacy.email, legacy.name)
    ownerMap.set(legacy.id, user.id)
    if (legacy.active === false) check(await supabase.from('app_profiles').update({ active: false }).eq('id', user.id))
  }
  // Refuse to guess ownership for unknown IDs.
  for (const listing of local.listings) {
    if (listing.hostId && !ownerMap.has(listing.hostId)) throw new Error('A listing has an unknown owner; correct the local database before import.')
  }

  const urls = new Map()
  const bucket = supabase.storage.from(PHOTO_BUCKET)
  for (const src of localPhotos) {
    const filename = src.slice('/uploads/'.length)
    const objectPath = `legacy/${filename}`
    const extension = path.extname(filename).toLowerCase()
    const mime = extension === '.jpeg' ? 'image/jpeg' : [...PHOTO_TYPES].find(([, ext]) => ext === extension)?.[0]
    const result = await bucket.upload(objectPath, await fs.readFile(path.join(uploadsPath, filename)), { contentType: mime, upsert: false })
    // A rerun reuses objects that were already imported, without replacing them.
    if (result.error && String(result.error.statusCode) !== '409' && !/already exists|duplicate/i.test(result.error.message)) throw result.error
    urls.set(src, bucket.getPublicUrl(objectPath).data.publicUrl)
  }
  const now = new Date().toISOString()
  const listings = local.listings.map(listing => {
    const data = {
      ...listing,
      id: String(listing.id),
      hostId: ownerMap.get(listing.hostId) || admin.id,
      approval: listing.approval || 'approved',
      createdAt: listing.createdAt || now,
      updatedAt: listing.updatedAt || now,
      images: (listing.images || []).map(src => urls.get(src) || src),
    }
    delete data.source
    return { id: data.id, host_id: data.hostId, data }
  })
  // Insert only. Rerunning cannot overwrite later edits made in Supabase.
  for (let i = 0; i < listings.length; i += 100) {
    check(await supabase.from('app_listings').upsert(listings.slice(i, i + 100), { onConflict: 'id', ignoreDuplicates: true }))
  }
  const activity = local.activity.map(item => ({ id: item.id, data: item }))
  for (let i = 0; i < activity.length; i += 100) {
    check(await supabase.from('app_activity').upsert(activity.slice(i, i + 100), { onConflict: 'id', ignoreDuplicates: true }))
  }
  console.log(`Import complete: ${listings.length} listing records processed; ${localPhotos.size} photos processed. Existing records were preserved.`)
  console.log('Local database and photos are unchanged. Existing hosts must use Forgot password; no emails were sent by this script.')
  console.log('If the bootstrap email already existed, its password was preserved. Remove BOOTSTRAP_ADMIN_PASSWORD from your environment now.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrate().catch(error => {
    console.error('Import failed:', error.message)
    process.exitCode = 1
  })
}
