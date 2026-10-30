import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type ActivityItem, type ListingDto } from '../../lib/api'
import { formatPrice } from '../../data/listings'

export function AdminListingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [listing, setListing] = useState<ListingDto | null>(null)
  const [host, setHost] = useState<{
    id: string
    name: string
    email: string
    active: boolean
  } | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '',
    location: '',
    region: '',
    district: '',
    type: '',
    category: '',
    status: 'For Sale',
    currency: 'UGX',
    price: '',
    bedrooms: '',
    baths: '',
    phone: '',
    description: '',
    image: '',
  })

  const load = () => {
    if (!id) return
    api
      .adminListing(id)
      .then((res) => {
        setListing(res.listing)
        setHost(res.host)
        setActivity(res.activity)
        setNote(res.listing.moderationNote || '')
        setForm({
          title: res.listing.title,
          location: res.listing.location,
          region: res.listing.region,
          district: res.listing.district || '',
          type: res.listing.type,
          category: res.listing.category,
          status: res.listing.status || 'For Sale',
          currency: res.listing.currency || 'UGX',
          price: String(res.listing.price || ''),
          bedrooms: String(res.listing.bedrooms || ''),
          baths: String(res.listing.baths || ''),
          phone: res.listing.phone || '',
          description: res.listing.description || '',
          image: res.listing.images?.[0] || '',
        })
      })
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    load()
  }, [id])

  const moderate = async (approval: string) => {
    if (!id) return
    setSaving(true)
    setError('')
    try {
      await api.setApproval(id, approval, note)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update')
    } finally {
      setSaving(false)
    }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!id) return
    setSaving(true)
    setError('')
    try {
      await api.adminUpdateListing(id, {
        title: form.title,
        location: form.location,
        region: form.region,
        district: form.district,
        type: form.type,
        category: form.category,
        status: form.status,
        currency: form.currency,
        price: Number(form.price),
        bedrooms: Number(form.bedrooms),
        baths: Number(form.baths),
        phone: form.phone,
        description: form.description,
        images: form.image
          ? [form.image, ...(listing?.images?.slice(1) || [])]
          : listing?.images,
      })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!id || !confirm('Delete this listing permanently?')) return
    setSaving(true)
    try {
      await api.deleteAdminListing(id)
      navigate('/admin/listings')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
      setSaving(false)
    }
  }

  if (error && !listing) return <p className="portal-error">{error}</p>
  if (!listing) return <p className="portal-loading">Loading listing…</p>

  return (
    <div className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link to="/admin/listings" className="portal-back-inline">
            ← Listings
          </Link>
          <h1>{listing.title}</h1>
          <p>
            Ref #{listing.code || listing.id.slice(0, 8)} ·{' '}
            <span className={`pill ${listing.approval || 'approved'}`}>
              {listing.approval || 'approved'}
            </span>
          </p>
        </div>
        <div className="portal-head-actions">
          {(listing.approval || 'approved') === 'approved' && (
            <a
              className="btn btn-outline"
              href={`/stay/${listing.id}`}
              target="_blank"
              rel="noreferrer"
            >
              Public page
            </a>
          )}
          <button type="button" className="btn btn-outline danger-outline" onClick={remove}>
            Delete
          </button>
        </div>
      </header>

      {error && <p className="portal-error">{error}</p>}

      <div className="admin-detail-grid">
        <section className="portal-panel">
          <div className="portal-panel-head">
            <h2>Moderation</h2>
            <em>{formatPrice(listing)}</em>
          </div>
          <div className="admin-detail-preview">
            <img src={listing.images?.[0]} alt="" />
            <div>
              <p>
                <strong>{listing.type}</strong> · {listing.status} · {listing.bedrooms} beds ·{' '}
                {listing.baths} baths
              </p>
              <p className="muted">
                {listing.location}
                {listing.district ? ` · ${listing.district}` : ''}
              </p>
              {host && (
                <p>
                  Host:{' '}
                  <Link to={`/admin/hosts/${host.id}`}>
                    {host.name} ({host.email})
                  </Link>
                  {!host.active && <span className="pill rejected">disabled</span>}
                </p>
              )}
            </div>
          </div>
          <label className="admin-note">
            Moderation note
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note for reject / hide…"
            />
          </label>
          <div className="row-actions">
            <button type="button" disabled={saving} onClick={() => moderate('approved')}>
              Approve
            </button>
            <button type="button" disabled={saving} onClick={() => moderate('pending')}>
              Pending
            </button>
            <button type="button" disabled={saving} onClick={() => moderate('rejected')}>
              Reject
            </button>
            <button type="button" disabled={saving} onClick={() => moderate('hidden')}>
              Hide
            </button>
          </div>
        </section>

        <section className="portal-panel">
          <div className="portal-panel-head">
            <h2>Activity on this listing</h2>
          </div>
          {activity.length === 0 ? (
            <p className="muted">No activity yet.</p>
          ) : (
            <ul className="admin-activity">
              {activity.map((a) => (
                <li key={a.id}>
                  <span className="admin-activity-time">
                    {new Date(a.at).toLocaleString()}
                  </span>
                  <div>
                    <strong>{a.action.replace(/_/g, ' ')}</strong>
                    <span>
                      {a.actor}
                      {a.detail ? ` · ${a.detail}` : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="portal-panel admin-dash-span">
          <div className="portal-panel-head">
            <h2>Edit listing</h2>
          </div>
          <form className="listing-form flat" onSubmit={save}>
            <label>
              Title
              <input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <div className="form-grid">
              <label>
                Location
                <input
                  required
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                />
              </label>
              <label>
                Region
                <input
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                />
              </label>
              <label>
                District
                <input
                  value={form.district}
                  onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
                />
              </label>
              <label>
                Phone
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </label>
              <label>
                Type
                <input
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                />
              </label>
              <label>
                Category
                <input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                />
              </label>
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option>For Sale</option>
                  <option>For Rent</option>
                </select>
              </label>
              <label>
                Currency
                <select
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                >
                  <option>UGX</option>
                  <option>USD</option>
                </select>
              </label>
              <label>
                Price
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                />
              </label>
              <label>
                Bedrooms
                <input
                  type="number"
                  value={form.bedrooms}
                  onChange={(e) => setForm((f) => ({ ...f, bedrooms: e.target.value }))}
                />
              </label>
              <label>
                Baths
                <input
                  type="number"
                  value={form.baths}
                  onChange={(e) => setForm((f) => ({ ...f, baths: e.target.value }))}
                />
              </label>
            </div>
            <label>
              Primary image URL
              <input
                value={form.image}
                onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
              />
            </label>
            <label>
              Description
              <textarea
                rows={5}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
