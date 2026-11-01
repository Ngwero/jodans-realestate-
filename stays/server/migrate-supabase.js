import './env.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { createSupabaseAdmin } from './supabase.js'
import { hashPassword } from './auth.js'
import { PHOTO_BUCKET, PHOTO_TYPES } from './photos.js'

const defaultRoot = fileURLToPath(new URL('../', import.meta.url))
const check = result => { if (result.error) throw result.error; return result.data }

// Preserve app logins and password hashes; no Supabase Auth users or emails.
export async function migrate(options = {}) {
  const settings = options.settings || process.env
  const root = options.root || defaultRoot
  const uploadsPath = path.join(root, 'public/uploads')
  let local
  try { local = JSON.parse(await fs.readFile(path.join(root, 'server/data/db.json'), 'utf8')) }
  catch (error) {
    if (error.code !== 'ENOENT') throw error
    const seed = JSON.parse(await fs.readFile(path.join(root, 'src/data/red-scraped.json'), 'utf8'))
    local = { users: [], activity: [], listings: seed.map(item => ({ ...item,
      id: String(item.id || item.code || randomUUID()), approval: 'approved' })) }
  }
  if (![local.users, local.listings, local.activity].every(Array.isArray)) throw new Error('Invalid local database shape.')
  const email = settings.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
  const password = settings.BOOTSTRAP_ADMIN_PASSWORD
  if (!local.users.some(user => user.role === 'admin') && (!email || !password || password.length < 12)) {
    throw new Error('No existing admin found. Set BOOTSTRAP_ADMIN_EMAIL and a BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters.')
  }
  for (const user of local.users) {
    if (!user.id || !user.email || !user.password || !['admin', 'host'].includes(user.role)) {
      throw new Error('A local account is missing its ID, email, password hash, or role. Correct it before import.')
    }
  }
  const ids = new Set(local.users.map(user => String(user.id)))
  for (const listing of local.listings) {
    if (listing.hostId && !ids.has(String(listing.hostId))) throw new Error('A listing has an unknown owner. Correct the local data before import.')
  }
  const localPhotos = new Set(local.listings.flatMap(row => row.images || []).filter(src => src.startsWith('/uploads/')))
  for (const src of localPhotos) {
    const filename = src.slice('/uploads/'.length)
    if (!filename || path.basename(filename) !== filename) throw new Error('Unsafe local photo path.')
    if (![...PHOTO_TYPES.values(), '.jpeg'].includes(path.extname(filename).toLowerCase())) throw new Error('Unsupported photo extension.')
    const stat = await fs.stat(path.join(uploadsPath, filename))
    if (!stat.isFile() || stat.size > 8 * 1024 * 1024) throw new Error('A photo is missing or exceeds 8 MB.')
  }

  const supabase = options.supabase || createSupabaseAdmin()
  check(await supabase.from('app_credentials').select('profile_id').limit(1))
  const buckets = check(await supabase.storage.listBuckets())
  if (!buckets.some(bucket => bucket.id === PHOTO_BUCKET)) throw new Error('Run both SQL migrations first (property-photos bucket is missing).')
  const state = check(await supabase.rpc('app_read_state'))
  const existingByEmail = new Map(state.users.map(user => [user.email.toLowerCase(), user]))
  const now = new Date().toISOString()
  if (email && !local.users.some(user => user.email.toLowerCase() === email) && !existingByEmail.has(email)) {
    if (!password || password.length < 12) throw new Error('Choose a bootstrap password of at least 12 characters.')
    local.users.push({ id: randomUUID(), email, name: settings.BOOTSTRAP_ADMIN_NAME || 'Platform Admin',
      role: 'admin', active: true, password: await hashPassword(password), createdAt: now })
  }
  const ownerMap = new Map()
  const profiles = [], credentials = []
  for (const user of local.users) {
    const existing = existingByEmail.get(user.email.toLowerCase())
    const id = existing?.id || String(user.id)
    ownerMap.set(String(user.id), id)
    profiles.push({ id, email: user.email.toLowerCase(), name: user.name || 'Host', role: user.role,
      active: user.active !== false, created_at: user.createdAt || now })
    credentials.push({ profile_id: id, password_hash: user.password })
  }
  const defaultAdmin = profiles.find(user => user.role === 'admin') || state.users.find(user => user.role === 'admin')
  if (!defaultAdmin) throw new Error('An admin account is required before importing seed listings.')
  // Insert only: reruns preserve existing cloud profiles, credentials and edits.
  for (const [table, rows, conflict] of [['app_profiles', profiles, 'id'], ['app_credentials', credentials, 'profile_id']]) {
    for (let i = 0; i < rows.length; i += 100) {
      check(await supabase.from(table).upsert(rows.slice(i, i + 100), { onConflict: conflict, ignoreDuplicates: true }))
    }
  }
  const urls = new Map(), bucket = supabase.storage.from(PHOTO_BUCKET)
  for (const src of localPhotos) {
    const filename = src.slice('/uploads/'.length), objectPath = `legacy/${filename}`
    const extension = path.extname(filename).toLowerCase()
    const mime = extension === '.jpeg' ? 'image/jpeg' : [...PHOTO_TYPES].find(([, ext]) => ext === extension)?.[0]
    const result = await bucket.upload(objectPath, await fs.readFile(path.join(uploadsPath, filename)), { contentType: mime, upsert: false })
    if (result.error && String(result.error.statusCode) !== '409' && !/already exists|duplicate/i.test(result.error.message)) throw result.error
    urls.set(src, bucket.getPublicUrl(objectPath).data.publicUrl)
  }
  const listings = local.listings.map(listing => {
    const data = { ...listing, id: String(listing.id),
      hostId: ownerMap.get(String(listing.hostId)) || defaultAdmin.id,
      approval: listing.approval || 'approved', createdAt: listing.createdAt || now,
      updatedAt: listing.updatedAt || now, images: (listing.images || []).map(src => urls.get(src) || src) }
    delete data.source
    return { id: data.id, host_id: data.hostId, data }
  })
  for (const [table, rows] of [['app_listings', listings], ['app_activity', local.activity.map(row => ({ id: row.id, data: row }))]]) {
    for (let i = 0; i < rows.length; i += 100) {
      check(await supabase.from(table).upsert(rows.slice(i, i + 100), { onConflict: 'id', ignoreDuplicates: true }))
    }
  }
  console.log(`Import complete: ${profiles.length} accounts, ${listings.length} listings, ${localPhotos.size} photos processed.`)
  console.log('Existing account IDs and password hashes preserved. Local files unchanged. No Supabase Auth accounts or emails created.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrate().catch(error => { console.error('Import failed:', error.message); process.exitCode = 1 })
}
