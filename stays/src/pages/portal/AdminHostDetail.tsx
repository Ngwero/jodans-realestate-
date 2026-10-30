import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type ListingDto } from '../../lib/api'
import { formatPrice } from '../../data/listings'

export function AdminHostDetail() {
  const { id } = useParams()
  const [host, setHost] = useState<{
    id: string
    email: string
    name: string
    active: boolean
    createdAt?: string | null
  } | null>(null)
  const [listings, setListings] = useState<ListingDto[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    if (!id) return
    api
      .adminHost(id)
      .then((res) => {
        setHost(res.host)
        setListings(res.listings)
      })
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    load()
  }, [id])

  const toggle = async () => {
    if (!host) return
    setBusy(true)
    try {
      await api.setHostActive(host.id, !host.active)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  if (error && !host) return <p className="portal-error">{error}</p>
  if (!host) return <p className="portal-loading">Loading host…</p>

  const pending = listings.filter((l) => l.approval === 'pending').length
  const approved = listings.filter((l) => (l.approval || 'approved') === 'approved').length

  return (
    <div className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link to="/admin/hosts" className="portal-back-inline">
            ← Hosts
          </Link>
          <h1>{host.name}</h1>
          <p>
            {host.email} ·{' '}
            <span className={`pill ${host.active ? 'approved' : 'rejected'}`}>
              {host.active ? 'active' : 'disabled'}
            </span>
          </p>
        </div>
        <div className="portal-head-actions">
          <Link to={`/admin/listings?hostId=${host.id}`} className="btn btn-outline">
            Filter listings
          </Link>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={toggle}>
            {host.active ? 'Disable host' : 'Enable host'}
          </button>
        </div>
      </header>

      {error && <p className="portal-error">{error}</p>}

      <div className="stat-grid">
        <article>
          <strong>{listings.length}</strong>
          <span>Listings</span>
        </article>
        <article>
          <strong>{approved}</strong>
          <span>Live</span>
        </article>
        <article className={pending ? 'stat-alert' : ''}>
          <strong>{pending}</strong>
          <span>Pending</span>
        </article>
      </div>

      <section className="portal-panel">
        <div className="portal-panel-head">
          <h2>Properties</h2>
        </div>
        <div className="portal-data">
          {listings.map((l) => (
            <div key={l.id} className="portal-data-row stacked">
              <div className="portal-data-prop">
                <img src={l.images?.[0]} alt="" />
                <div>
                  <Link to={`/admin/listings/${l.id}`}>
                    <strong>{l.title}</strong>
                  </Link>
                  <span>{l.location}</span>
                </div>
              </div>
              <span className={`pill ${l.approval || 'approved'}`}>{l.approval || 'approved'}</span>
              <em>{formatPrice(l)}</em>
              <div className="row-actions">
                <Link to={`/admin/listings/${l.id}`}>Manage</Link>
              </div>
            </div>
          ))}
          {listings.length === 0 && (
            <p className="muted portal-data-empty">This host has no listings.</p>
          )}
        </div>
      </section>
    </div>
  )
}
