import cors from 'cors'
import express from 'express'
import multer from 'multer'
import { v4 as uuid } from 'uuid'
import { resolvePlace } from './ugandaPlaces.js'
import { createDatabase } from './database.js'
import { createAuth } from './auth.js'
import { PHOTO_TYPES, uploadPhotos } from './photos.js'

function logActivity(db, entry) {
  if (!Array.isArray(db.activity)) db.activity = []
  db.activity.unshift({
    id: uuid(),
    at: new Date().toISOString(),
    ...entry,
  })
  db.activity = db.activity.slice(0, 500)
}

function countBy(items, keyFn) {
  const map = {}
  for (const item of items) {
    const key = keyFn(item) || 'Unknown'
    map[key] = (map[key] || 0) + 1
  }
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

function publicListing(listing) {
  const { hostId: _hostId, moderationNote: _note, ...rest } = listing
  return rest
}

function cleanImages(images) {
  if (!Array.isArray(images)) return []
  return images
    .map((src) => String(src || '').trim())
    .filter((src) => /^https?:\/\//i.test(src))
    .slice(0, 8)
}

function buildListing(body, { hostId, hostName, approval }) {
  const required = ['title', 'location', 'region', 'type', 'price']
  for (const key of required) {
    if (body[key] === undefined || body[key] === '') {
      return { error: `${key} is required` }
    }
  }
  const images = cleanImages(body.images)
  if (!images.length) return { error: 'Add at least one photo' }
  const now = new Date().toISOString()
  const place = resolvePlace(body)
  return {
    listing: {
      id: uuid(),
      code: String(Math.floor(100000 + Math.random() * 900000)),
      title: String(body.title),
      location: String(body.location),
      region: String(body.region),
      district: String(body.district || place.district || 'Kampala'),
      price: Number(body.price) || 0,
      currency: body.currency === 'USD' ? 'USD' : 'UGX',
      rating: 4.8,
      reviews: 0,
      guests: Number(body.guests) || Math.max(2, Number(body.bedrooms || 1) * 2),
      bedrooms: Number(body.bedrooms) || 1,
      beds: Number(body.beds) || Number(body.bedrooms) || 1,
      baths: Number(body.baths) || 1,
      type: String(body.type),
      category: String(body.category || 'city'),
      host: hostName,
      hostYears: 1,
      phone: String(body.phone || ''),
      status: body.status === 'For Rent' ? 'For Rent' : 'For Sale',
      description: String(body.description || ''),
      amenities: Array.isArray(body.amenities) ? body.amenities : ['Parking', 'Security', 'Water'],
      images,
      hostId,
      approval,
      createdAt: now,
      updatedAt: now,
      lat: place.lat,
      lng: place.lng,
    },
  }
}

// Whitelist editable listing fields; ownership, moderation and IDs stay server controlled.
export function listingChanges(body) {
  const fields = ['title','location','region','district','price','currency','guests',
    'bedrooms','beds','baths','type','category','phone','status','description','amenities','images']
  return Object.fromEntries(fields.filter(key => Object.hasOwn(body, key)).map(key => [key, body[key]]))
}

export function createApp(supabase) {
  const { readDb, writeDb } = createDatabase(supabase)
  const auth = createAuth(supabase)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024, files: 8 },
    fileFilter: (_req, file, cb) => {
      if (!PHOTO_TYPES.has(file.mimetype)) return cb(new Error('Only JPEG, PNG, WebP, or GIF photos are allowed'))
      cb(null, true)
    },
  })
  const app = express()
  app.use(cors({ origin: process.env.WEB_ORIGIN || true }))
  app.use(express.json({ limit: '2mb' }))

  app.get('/api/health', async (_req, res, next) => {
    const { error } = await supabase.from('app_listings').select('id').limit(1)
    if (error) return next(error)
    res.json({ ok: true, service: 'jodans-bloka-api', database: 'supabase' })
  })

  app.get('/api/auth/me', auth(), (req, res) => {
    const { sub: id, name, email, role } = req.user
    res.json({ user: { id, name, email, role } })
  })

  app.post('/api/uploads', auth(), (req, res, next) => {
    upload.array('photos', 8)(req, res, async (error) => {
      if (error) return res.status(400).json({ error: error.message || 'Upload failed' })
      if (!req.files?.length) return res.status(400).json({ error: 'Choose at least one photo' })
      try {
        const urls = await uploadPhotos(supabase, req.user.sub, req.files)
        res.status(201).json({ urls })
      } catch (error) { next(error) }
    })
  })

  app.get('/api/listings', async (req, res) => {
    const db = await readDb()
    const q = String(req.query.q || '').toLowerCase()
    let rows = db.listings.filter((l) => (l.approval || 'approved') === 'approved')
    if (q) {
      rows = rows.filter((l) =>
        [l.title, l.location, l.region, l.district, l.type, l.code]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    }
    res.json({ listings: rows.map(publicListing), total: rows.length })
  })

  app.get('/api/listings/:id', async (req, res) => {
    const db = await readDb()
    const listing = db.listings.find((l) => String(l.id) === String(req.params.id))
    if (!listing || (listing.approval || 'approved') !== 'approved') {
      return res.status(404).json({ error: 'Listing not found' })
    }
    res.json({ listing: publicListing(listing) })
  })

  app.get('/api/host/listings', auth('host'), async (req, res) => {
    const db = await readDb()
    const rows = db.listings.filter((l) => l.hostId === req.user.sub)
    res.json({ listings: rows })
  })

  app.post('/api/host/listings', auth('host'), async (req, res) => {
    const built = buildListing(req.body || {}, {
      hostId: req.user.sub,
      hostName: req.user.name || 'Host',
      approval: 'pending',
    })
    if (built.error) return res.status(400).json({ error: built.error })
    const db = await readDb()
    db.listings.unshift(built.listing)
    logActivity(db, {
      actor: req.user.email,
      action: 'listing_created',
      listingId: built.listing.id,
      detail: `Host submitted “${built.listing.title}”`,
    })
    await writeDb(db)
    res.status(201).json({ listing: built.listing })
  })

  app.put('/api/host/listings/:id', auth('host'), async (req, res) => {
    const db = await readDb()
    const idx = db.listings.findIndex((l) => String(l.id) === String(req.params.id))
    if (idx < 0) return res.status(404).json({ error: 'Listing not found' })
    const current = db.listings[idx]
    if (current.hostId !== req.user.sub && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not your listing' })
    }
    const body = req.body || {}
    const updated = {
      ...current,
      ...listingChanges(body),
      id: current.id,
      hostId: current.hostId,
      approval: 'pending',
      updatedAt: new Date().toISOString(),
    }
    if (body.images) {
      const images = cleanImages(body.images)
      if (!images.length) return res.status(400).json({ error: 'Add at least one photo' })
      updated.images = images
    }
    db.listings[idx] = updated
    logActivity(db, {
      actor: req.user.email,
      action: 'listing_updated',
      listingId: updated.id,
      detail: `Updated “${updated.title}”`,
    })
    await writeDb(db)
    res.json({ listing: updated })
  })

  app.delete('/api/host/listings/:id', auth('host'), async (req, res) => {
    const db = await readDb()
    const listing = db.listings.find((l) => String(l.id) === String(req.params.id))
    if (!listing) return res.status(404).json({ error: 'Listing not found' })
    if (listing.hostId !== req.user.sub && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not your listing' })
    }
    db.listings = db.listings.filter((l) => String(l.id) !== String(req.params.id))
    logActivity(db, {
      actor: req.user.email,
      action: 'listing_deleted',
      listingId: listing.id,
      detail: `Deleted “${listing.title}”`,
    })
    await writeDb(db)
    res.json({ ok: true })
  })

  app.get('/api/admin/stats', auth('admin'), async (_req, res) => {
    const db = await readDb()
    const listings = db.listings
    const hosts = db.users.filter((u) => u.role === 'host')
    const priced = listings.filter((l) => Number(l.price) > 0)
    const ugx = priced.filter((l) => (l.currency || 'UGX') === 'UGX')
    const usd = priced.filter((l) => l.currency === 'USD')
    const sale = listings.filter((l) => String(l.status || '').toLowerCase().includes('sale'))
    const rent = listings.filter((l) => String(l.status || '').toLowerCase().includes('rent'))
    res.json({
      totals: {
        listings: listings.length,
        approved: listings.filter((l) => (l.approval || 'approved') === 'approved').length,
        pending: listings.filter((l) => l.approval === 'pending').length,
        rejected: listings.filter((l) => l.approval === 'rejected').length,
        hidden: listings.filter((l) => l.approval === 'hidden').length,
        hosts: hosts.length,
        activeHosts: hosts.filter((u) => u.active !== false).length,
        disabledHosts: hosts.filter((u) => u.active === false).length,
        forSale: sale.length,
        forRent: rent.length,
        avgUgx: ugx.length
          ? Math.round(ugx.reduce((s, l) => s + Number(l.price), 0) / ugx.length)
          : 0,
        avgUsd: usd.length
          ? Math.round(usd.reduce((s, l) => s + Number(l.price), 0) / usd.length)
          : 0,
      },
    })
  })

  app.get('/api/admin/analytics', auth('admin'), async (_req, res) => {
    const db = await readDb()
    const listings = db.listings
    const places = {}
    for (const l of listings) {
      const p = resolvePlace(l)
      if (!places[p.name]) places[p.name] = { name: p.name, count: 0, district: p.district }
      places[p.name].count += 1
    }
    res.json({
      byDistrict: countBy(listings, (l) => resolvePlace(l).district).slice(0, 12),
      byArea: Object.values(places)
        .sort((a, b) => b.count - a.count)
        .slice(0, 15),
      byCategory: countBy(listings, (l) => l.category || l.type).slice(0, 12),
      byType: countBy(listings, (l) => l.type).slice(0, 12),
      byStatus: countBy(listings, (l) => l.status || 'Unknown'),
      byApproval: countBy(listings, (l) => l.approval || 'approved'),
      byCurrency: countBy(
        listings.filter((l) => Number(l.price) > 0),
        (l) => l.currency || 'UGX',
      ),
    })
  })

  app.get('/api/admin/geo', auth('admin'), async (_req, res) => {
    const db = await readDb()
    const map = new Map()
    for (const l of db.listings) {
      const p = resolvePlace(l)
      const key = p.name
      const row = map.get(key) || {
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        district: p.district,
        count: 0,
        approved: 0,
        pending: 0,
        forSale: 0,
        forRent: 0,
      }
      row.count += 1
      if ((l.approval || 'approved') === 'approved') row.approved += 1
      if (l.approval === 'pending') row.pending += 1
      if (String(l.status || '').toLowerCase().includes('sale')) row.forSale += 1
      if (String(l.status || '').toLowerCase().includes('rent')) row.forRent += 1
      map.set(key, row)
    }
    const places = [...map.values()].sort((a, b) => b.count - a.count)
    res.json({
      places,
      bounds: {
        // Uganda approx
        south: -1.5,
        west: 29.5,
        north: 4.3,
        east: 35.1,
      },
    })
  })

  app.get('/api/admin/activity', auth('admin'), async (req, res) => {
    const db = await readDb()
    const limit = Math.min(Number(req.query.limit) || 80, 200)
    res.json({ activity: (db.activity || []).slice(0, limit) })
  })

  app.post('/api/admin/listings', auth('admin'), async (req, res) => {
    const built = buildListing(req.body || {}, {
      hostId: req.user.sub,
      hostName: 'Jodans Concepts',
      approval: 'approved',
    })
    if (built.error) return res.status(400).json({ error: built.error })
    const db = await readDb()
    db.listings.unshift(built.listing)
    logActivity(db, {
      actor: req.user.email,
      action: 'listing_created',
      listingId: built.listing.id,
      detail: `Admin published “${built.listing.title}”`,
    })
    await writeDb(db)
    res.status(201).json({ listing: built.listing })
  })

  app.get('/api/admin/listings', auth('admin'), async (req, res) => {
    const db = await readDb()
    const status = String(req.query.approval || 'all')
    const q = String(req.query.q || '').toLowerCase()
    const district = String(req.query.district || '').toLowerCase()
    const category = String(req.query.category || '').toLowerCase()
    const listingStatus = String(req.query.status || '').toLowerCase()
    const hostId = String(req.query.hostId || '')
    const sort = String(req.query.sort || 'updated')
    let rows = [...db.listings]
    if (status !== 'all') rows = rows.filter((l) => (l.approval || 'approved') === status)
    if (hostId) rows = rows.filter((l) => String(l.hostId) === hostId)
    if (district) {
      rows = rows.filter((l) =>
        [l.district, l.region, l.location].join(' ').toLowerCase().includes(district),
      )
    }
    if (category) {
      rows = rows.filter((l) => String(l.category || '').toLowerCase() === category)
    }
    if (listingStatus === 'sale') {
      rows = rows.filter((l) => String(l.status || '').toLowerCase().includes('sale'))
    } else if (listingStatus === 'rent') {
      rows = rows.filter((l) => String(l.status || '').toLowerCase().includes('rent'))
    }
    if (q) {
      rows = rows.filter((l) =>
        [l.title, l.location, l.host, l.code, l.district, l.type, l.phone]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    }
    rows.sort((a, b) => {
      if (sort === 'price-desc') return (b.price || 0) - (a.price || 0)
      if (sort === 'price-asc') return (a.price || 0) - (b.price || 0)
      if (sort === 'title') return String(a.title).localeCompare(String(b.title))
      return String(b.updatedAt || b.createdAt || '').localeCompare(
        String(a.updatedAt || a.createdAt || ''),
      )
    })
    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize) || 40))
    const start = (page - 1) * pageSize
    const slice = rows.slice(start, start + pageSize)
    res.json({
      listings: slice,
      total: rows.length,
      page,
      pageSize,
      pages: Math.max(1, Math.ceil(rows.length / pageSize)),
    })
  })

  app.post('/api/admin/listings/bulk', auth('admin'), async (req, res) => {
    const { ids, approval } = req.body || {}
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ error: 'ids required' })
    }
    if (!['approved', 'pending', 'rejected', 'hidden'].includes(approval)) {
      return res.status(400).json({ error: 'Invalid approval status' })
    }
    const db = await readDb()
    let updated = 0
    const idSet = new Set(ids.map(String))
    db.listings = db.listings.map((l) => {
      if (!idSet.has(String(l.id))) return l
      updated += 1
      return { ...l, approval, updatedAt: new Date().toISOString() }
    })
    logActivity(db, {
      actor: req.user.email,
      action: 'bulk_approval',
      detail: `Bulk set ${updated} listings to ${approval}`,
    })
    await writeDb(db)
    res.json({ ok: true, updated })
  })

  app.get('/api/admin/listings/:id', auth('admin'), async (req, res) => {
    const db = await readDb()
    const listing = db.listings.find((l) => String(l.id) === String(req.params.id))
    if (!listing) return res.status(404).json({ error: 'Listing not found' })
    const host = db.users.find((u) => u.id === listing.hostId)
    const related = (db.activity || []).filter((a) => a.listingId === listing.id).slice(0, 20)
    res.json({
      listing,
      host: host
        ? { id: host.id, name: host.name, email: host.email, active: host.active !== false }
        : null,
      activity: related,
    })
  })

  app.put('/api/admin/listings/:id', auth('admin'), async (req, res) => {
    const db = await readDb()
    const idx = db.listings.findIndex((l) => String(l.id) === String(req.params.id))
    if (idx < 0) return res.status(404).json({ error: 'Listing not found' })
    const current = db.listings[idx]
    const body = req.body || {}
    const updated = {
      ...current,
      ...listingChanges(body),
      id: current.id,
      hostId: current.hostId,
      updatedAt: new Date().toISOString(),
    }
    if (body.price !== undefined) updated.price = Number(body.price) || 0
    if (body.bedrooms !== undefined) updated.bedrooms = Number(body.bedrooms) || 0
    if (body.baths !== undefined) updated.baths = Number(body.baths) || 0
    if (body.images) {
      const images = cleanImages(body.images)
      if (!images.length) return res.status(400).json({ error: 'Add at least one photo' })
      updated.images = images
    }
    db.listings[idx] = updated
    logActivity(db, {
      actor: req.user.email,
      action: 'admin_edit',
      listingId: updated.id,
      detail: `Admin edited “${updated.title}”`,
    })
    await writeDb(db)
    res.json({ listing: updated })
  })

  app.patch('/api/admin/listings/:id', auth('admin'), async (req, res) => {
    const db = await readDb()
    const idx = db.listings.findIndex((l) => String(l.id) === String(req.params.id))
    if (idx < 0) return res.status(404).json({ error: 'Listing not found' })
    const approval = req.body?.approval
    if (!['approved', 'pending', 'rejected', 'hidden'].includes(approval)) {
      return res.status(400).json({ error: 'Invalid approval status' })
    }
    const note = String(req.body?.note || '').slice(0, 280)
    db.listings[idx] = {
      ...db.listings[idx],
      approval,
      moderationNote: note || db.listings[idx].moderationNote || '',
      updatedAt: new Date().toISOString(),
    }
    logActivity(db, {
      actor: req.user.email,
      action: `approval_${approval}`,
      listingId: db.listings[idx].id,
      detail: `Set “${db.listings[idx].title}” to ${approval}${note ? ` — ${note}` : ''}`,
    })
    await writeDb(db)
    res.json({ listing: db.listings[idx] })
  })

  app.delete('/api/admin/listings/:id', auth('admin'), async (req, res) => {
    const db = await readDb()
    const listing = db.listings.find((l) => String(l.id) === String(req.params.id))
    if (!listing) return res.status(404).json({ error: 'Listing not found' })
    db.listings = db.listings.filter((l) => String(l.id) !== String(req.params.id))
    logActivity(db, {
      actor: req.user.email,
      action: 'admin_delete',
      listingId: listing.id,
      detail: `Deleted “${listing.title}”`,
    })
    await writeDb(db)
    res.json({ ok: true })
  })

  app.get('/api/admin/hosts', auth('admin'), async (_req, res) => {
    const db = await readDb()
    const hosts = db.users
      .filter((u) => u.role === 'host')
      .map((u) => {
        const theirs = db.listings.filter((l) => l.hostId === u.id)
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          active: u.active !== false,
          createdAt: u.createdAt || null,
          listings: theirs.length,
          pending: theirs.filter((l) => l.approval === 'pending').length,
          approved: theirs.filter((l) => (l.approval || 'approved') === 'approved').length,
          rejected: theirs.filter((l) => l.approval === 'rejected').length,
        }
      })
      .sort((a, b) => b.listings - a.listings)
    res.json({ hosts })
  })

  app.get('/api/admin/hosts/:id', auth('admin'), async (req, res) => {
    const db = await readDb()
    const host = db.users.find((u) => u.id === req.params.id && u.role === 'host')
    if (!host) return res.status(404).json({ error: 'Host not found' })
    const listings = db.listings.filter((l) => l.hostId === host.id)
    res.json({
      host: {
        id: host.id,
        email: host.email,
        name: host.name,
        active: host.active !== false,
        createdAt: host.createdAt || null,
      },
      listings,
    })
  })

  app.patch('/api/admin/hosts/:id', auth('admin'), async (req, res) => {
    const db = await readDb()
    const idx = db.users.findIndex((u) => u.id === req.params.id && u.role === 'host')
    if (idx < 0) return res.status(404).json({ error: 'Host not found' })
    if (typeof req.body?.active === 'boolean') {
      db.users[idx].active = req.body.active
    }
    if (req.body?.name) db.users[idx].name = String(req.body.name)
    logActivity(db, {
      actor: req.user.email,
      action: db.users[idx].active === false ? 'host_disabled' : 'host_updated',
      detail: `${db.users[idx].name} (${db.users[idx].email}) · active=${db.users[idx].active !== false}`,
    })
    await writeDb(db)
    res.json({
      host: {
        id: db.users[idx].id,
        email: db.users[idx].email,
        name: db.users[idx].name,
        active: db.users[idx].active !== false,
      },
    })
  })

  app.use((error, _req, res, _next) => {
    if (error.code === '40001') return res.status(409).json({ error: 'This record changed. Reload and try again.' })
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' })
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large' })
    console.error('API error:', error.code || error.name || 'unknown')
    res.status(503).json({ error: 'Service unavailable. Please try again.' })
  })
  return app
}
