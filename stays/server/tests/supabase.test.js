import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import { createApp } from '../app.js'
import { createDatabase } from '../database.js'
import { uploadPhotos } from '../photos.js'
import { migrate } from '../migrate-supabase.js'

let available = true
try { execFileSync('initdb', ['--version'], { stdio: 'ignore' }) } catch { available = false }
const integration = (name, fn) => test(name, { skip: !available && 'Install PostgreSQL binaries to run integration tests' }, fn)
let directory, server, base, supabase
const adminId = '00000000-0000-4000-8000-000000000001'
const hostId = '00000000-0000-4000-8000-000000000002'
const otherId = '00000000-0000-4000-8000-000000000003'
const literal = value => `'${String(value).replaceAll("'", "''")}'`
function query(sql) {
  return execFileSync('psql', ['-h', directory, '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
function jsonQuery(sql) { return JSON.parse(query(sql)) }
function failure(error) { return { error: { code: error.stderr?.includes('reload and retry') ? '40001' : 'database_error' } } }

before(async () => {
  if (!available) return
  directory = mkdtempSync(path.join(tmpdir(), 'jb-pg-'))
  execFileSync('initdb', ['-D', path.join(directory, 'data'), '--auth=trust', '--no-locale', '-E', 'UTF8'], { stdio: 'ignore' })
  execFileSync('pg_ctl', ['-D', path.join(directory, 'data'), '-l', path.join(directory, 'postgres.log'), '-o', `-F -c listen_addresses='' -k ${directory}`, '-w', 'start'], { stdio: 'ignore' })
  query(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`)
  const migration = readFileSync(new URL('../../supabase/migrations/202610300001_supabase.sql', import.meta.url), 'utf8')
  query(migration)
  query(migration) // Must also be safe to rerun.
  query(`insert into auth.users(id,email,raw_user_meta_data) values
    ('${adminId}','admin@example.test','{"name":"Admin"}'),
    ('${hostId}','host@example.test','{"name":"Host","role":"admin"}'),
    ('${otherId}','other@example.test','{"name":"Other"}');
    update public.app_profiles set role='admin' where id='${adminId}';`)
  const tokens = { admin: adminId, host: hostId, other: otherId }
  supabase = {
    auth: { async getUser(token) { return { data: { user: tokens[token] ? { id: tokens[token], email: `${token}@example.test` } : null }, error: tokens[token] ? null : new Error('invalid') } } },
    from(table) {
      return { select() { return {
        limit() { try { return Promise.resolve({ data: jsonQuery(`set role service_role; select coalesce(jsonb_agg(id),'[]') from public.${table};`) }) } catch(error) { return Promise.resolve(failure(error)) } },
        eq(_column, id) { return { async single() {
          try { return { data: jsonQuery(`set role service_role; select row_to_json(p) from public.app_profiles p where id=${literal(id)};`) } } catch(error) { return failure(error) }
        } } },
      } } }
    },
    async rpc(name, args) {
      try {
        const sql = name === 'app_read_state' ? 'select public.app_read_state();' : `select public.app_apply_changes(${literal(JSON.stringify(args.changes))}::jsonb);`
        const output = query(`set role service_role; ${sql}`)
        return { data: name === 'app_read_state' ? JSON.parse(output) : null, error: null }
      } catch(error) { return failure(error) }
    },
  }
  server = createApp(supabase).listen(0, '127.0.0.1')
  await once(server, 'listening')
  base = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve))
  if (directory) {
    try { execFileSync('pg_ctl', ['-D', path.join(directory, 'data'), '-m', 'immediate', '-w', 'stop'], { stdio: 'ignore' }) }
    finally { rmSync(directory, { recursive: true, force: true }) }
  }
})

async function request(url, token, method = 'GET', body) {
  return fetch(base + url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
}
const listingBody = { title: 'Kampala home', location: 'Kampala', region: 'Central', type: 'House', price: 150000, images: ['https://example.test/photo.jpg'] }
let listingId

integration('signup metadata cannot create admins; browser roles cannot read private tables or RPCs', () => {
  assert.equal(query(`select role from public.app_profiles where id='${hostId}';`), 'host')
  assert.throws(() => query('set role anon; select * from public.app_profiles;'))
  assert.throws(() => query('set role authenticated; select public.app_read_state();'))
  assert.throws(() => query("set role authenticated; select public.app_apply_changes('{}');"))
})

integration('API rejects invalid sessions, host admin access and disabled accounts', async () => {
  assert.equal((await request('/api/admin/stats')).status, 401)
  assert.equal((await request('/api/host/listings', 'forged')).status, 401)
  assert.equal((await request('/api/admin/stats', 'host')).status, 403)
  query(`update public.app_profiles set active=false where id='${otherId}';`)
  assert.equal((await request('/api/host/listings', 'other')).status, 403)
  query(`update public.app_profiles set active=true where id='${otherId}';`)
  assert.equal((await request('/api/auth/me', 'admin')).status, 200)
})

integration('host submissions stay private until admin approval; public output omits private fields', async () => {
  const response = await request('/api/host/listings', 'host', 'POST', { ...listingBody, approval: 'approved', hostId: adminId })
  assert.equal(response.status, 201)
  const { listing } = await response.json()
  listingId = listing.id
  assert.equal(listing.hostId, hostId)
  assert.equal(listing.approval, 'pending')
  assert.equal((await request(`/api/listings/${listingId}`)).status, 404)
  assert.equal((await request(`/api/admin/listings/${listingId}`, 'admin', 'PATCH', { approval: 'approved', note: 'Private moderation note' })).status, 200)
  const publicListing = (await (await request(`/api/listings/${listingId}`)).json()).listing
  assert.equal(publicListing.title, listingBody.title)
  assert.equal(publicListing.hostId, undefined)
  assert.equal(publicListing.moderationNote, undefined)
})

integration('hosts cannot edit another owner, change ownership, or bypass moderation', async () => {
  assert.equal((await request(`/api/host/listings/${listingId}`, 'other', 'PUT', { title: 'Stolen' })).status, 403)
  const response = await request(`/api/host/listings/${listingId}`, 'host', 'PUT', { title: 'Updated', hostId: otherId, approval: 'approved', moderationNote: 'Forged', createdAt: '2000' })
  assert.equal(response.status, 200)
  const { listing } = await response.json()
  assert.equal(listing.hostId, hostId)
  assert.equal(listing.approval, 'pending')
  assert.equal(listing.moderationNote, 'Private moderation note')
  assert.notEqual(listing.createdAt, '2000')
})

integration('overlapping database writes fail atomically, preserving the successful edit', async () => {
  const db = createDatabase(supabase)
  const first = await db.readDb(), stale = await db.readDb()
  first.listings.find(row => row.id === listingId).title = 'First edit'
  await db.writeDb(first)
  stale.listings.find(row => row.id === listingId).title = 'Stale edit'
  stale.users.find(row => row.id === hostId).name = 'Must roll back'
  await assert.rejects(db.writeDb(stale), error => error.code === '40001')
  const fresh = await db.readDb()
  assert.equal(fresh.listings.find(row => row.id === listingId).title, 'First edit')
  assert.equal(fresh.users.find(row => row.id === hostId).name, 'Host')
})

integration('unrelated concurrent inserts survive and listings can be removed', async () => {
  const db = createDatabase(supabase)
  const first = await db.readDb(), second = await db.readDb()
  first.activity.unshift({ id: '00000000-0000-4000-8000-000000000010', at: new Date().toISOString(), action: 'one' })
  second.activity.unshift({ id: '00000000-0000-4000-8000-000000000011', at: new Date().toISOString(), action: 'two' })
  await db.writeDb(first)
  await db.writeDb(second)
  assert((await db.readDb()).activity.some(row => row.action === 'one'))
  assert((await db.readDb()).activity.some(row => row.action === 'two'))
  assert.equal((await request(`/api/host/listings/${listingId}`, 'host', 'DELETE')).status, 200)
  assert(!(await db.readDb()).listings.some(row => row.id === listingId))
})

test('photo batches clean up uploaded objects when a later upload fails', async () => {
  const paths = [], removed = []
  const storage = { from() { return {
    async upload(objectPath) { if (paths.length) return { error: new Error('offline') }; paths.push(objectPath); return {} },
    async remove(objectPaths) { removed.push(...objectPaths); return {} },
    getPublicUrl(objectPath) { return { data: { publicUrl: `https://storage.example/${objectPath}` } } },
  } } }
  await assert.rejects(uploadPhotos({ storage }, hostId, [{ mimetype: 'image/png', buffer: Buffer.from('one') }, { mimetype: 'image/jpeg', buffer: Buffer.from('two') }]), /offline/)
  assert.equal(paths.length, 1)
  assert.deepEqual(removed, paths)
  assert(paths[0].startsWith(`${hostId}/`))
})


integration('import maps owners and photos, preserves local files, and can rerun without replacing cloud edits', async () => {
  const importRoot = mkdtempSync(path.join(tmpdir(), 'jb-import-'))
  mkdirSync(path.join(importRoot, 'server/data'), { recursive: true })
  mkdirSync(path.join(importRoot, 'public/uploads'), { recursive: true })
  const legacy = {
    users: [{ id: 'admin-1', email: 'old-admin@example.test' }, { id: 'host-demo', email: 'demo@example.test' },
      { id: 'local-host', email: 'migrated-host@example.test', name: 'Imported Host', password: 'legacy-hash' }],
    listings: [{ ...listingBody, id: 'imported-listing', hostId: 'local-host', images: ['/uploads/photo.png'] }],
    activity: [],
  }
  const original = JSON.stringify(legacy)
  writeFileSync(path.join(importRoot, 'server/data/db.json'), original)
  writeFileSync(path.join(importRoot, 'public/uploads/photo.png'), Buffer.from('fake image for upload mock'))
  const created = [], objects = new Set()
  const client = {
    ...supabase,
    auth: { admin: {
      async listUsers() { return { data: { users: jsonQuery("select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email)), '[]') from auth.users;") } } },
      async createUser(body) {
        const id = `00000000-0000-4000-8000-${String(100 + created.length).padStart(12,'0')}`
        created.push(body)
        query(`insert into auth.users(id,email,raw_user_meta_data) values(${literal(id)},${literal(body.email)},${literal(JSON.stringify(body.user_metadata))});`)
        return { data: { user: { id, email: body.email } } }
      },
    } },
    from(table) {
      return {
        ...supabase.from(table),
        update(values) { return { async eq(_key,id) {
          query(`set role service_role; update public.${table} set ${Object.entries(values).map(([key,value]) => `${key}=${literal(value)}`).join(',')} where id=${literal(id)};`)
          return {}
        } } },
        async upsert(rows) {
          const columns = table === 'app_listings' ? 'id text, host_id uuid, data jsonb' : 'id uuid, data jsonb'
          query(`set role service_role; insert into public.${table} select * from jsonb_to_recordset(${literal(JSON.stringify(rows))}::jsonb) as r(${columns}) on conflict(id) do nothing;`)
          return {}
        },
      }
    },
    storage: {
      async listBuckets() { return { data: [{ id: 'property-photos' }] } },
      from() { return {
        async upload(key) { if (objects.has(key)) return { error: { statusCode: '409', message: 'exists' } }; objects.add(key); return {} },
        getPublicUrl(key) { return { data: { publicUrl: `https://storage.example/${key}` } } },
      } },
    },
  }
  const options = { root: importRoot, supabase: client, settings: {
    BOOTSTRAP_ADMIN_EMAIL: 'bootstrap@example.test', BOOTSTRAP_ADMIN_PASSWORD: 'fresh-password-123',
  } }
  try {
    await migrate(options)
    assert.equal(created.length, 2)
    assert.equal(created[0].email_confirm, true)
    assert.equal(created[1].email_confirm, false)
    assert.notEqual(created[1].password, 'legacy-hash')
    assert.equal(query("select role from public.app_profiles where email='bootstrap@example.test';"), 'admin')
    const imported = jsonQuery("select data from public.app_listings where id='imported-listing';")
    assert.equal(imported.hostId, query("select id from public.app_profiles where email='migrated-host@example.test';"))
    assert.deepEqual(imported.images, ['https://storage.example/legacy/photo.png'])
    query("update public.app_listings set data=jsonb_set(data,'{title}','\"Cloud edit\"') where id='imported-listing';")
    await migrate(options)
    assert.equal(created.length, 2)
    assert.equal(objects.size, 1)
    assert.equal(query("select data->>'title' from public.app_listings where id='imported-listing';"), 'Cloud edit')
    assert.equal(readFileSync(path.join(importRoot, 'server/data/db.json'),'utf8'), original)
  } finally { rmSync(importRoot, { recursive: true, force: true }) }
})

integration('snapshot reads include more than 1,000 listings without Data API pagination loss', async () => {
  query(`insert into public.app_listings(id,host_id,data)
    select 'page-test-'||n, '${hostId}', jsonb_build_object('id','page-test-'||n,'hostId','${hostId}','approval','approved')
    from generate_series(1,1005) n;`)
  const { data } = await supabase.rpc('app_read_state')
  assert.equal(data.listings.filter(row => row.id.startsWith('page-test-')).length, 1005)
})
