import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type ListingDto } from '../../lib/api'
import { formatPrice } from '../../data/listings'
import { useAuth } from '../../lib/auth'

export function HostDashboard() {
  const { user } = useAuth()
  const [listings, setListings] = useState<ListingDto[]>([])
  const [error, setError] = useState('')

  const load = () => {
    api
      .hostListings()
      .then((res) => setListings(res.listings))
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    load()
  }, [])

  const remove = async (id: string) => {
    if (!confirm('Remove this property?')) return
    try {
      await api.deleteHostListing(id)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete')
    }
  }

  const pending = listings.filter((l) => l.approval === 'pending').length
  const approved = listings.filter((l) => l.approval === 'approved').length
  const rejected = listings.filter((l) => l.approval === 'rejected').length

  return (
    <div className="portal-page">
      <header className="portal-page-head">
        <div>
          <h1>Your properties</h1>
          <p>Hello {user?.name?.split(' ')[0] || 'Host'} — submit homes for admin approval.</p>
        </div>
        <Link to="/host/new" className="btn btn-primary">
          + Add property
        </Link>
      </header>

      <div className="stat-grid">
        <article>
          <strong>{listings.length}</strong>
          <span>Total</span>
        </article>
        <article>
          <strong>{approved}</strong>
          <span>Live</span>
        </article>
        <article className={pending ? 'stat-alert' : ''}>
          <strong>{pending}</strong>
          <span>Pending</span>
        </article>
        <article>
          <strong>{rejected}</strong>
          <span>Rejected</span>
        </article>
      </div>

      {error && <p className="portal-error">{error}</p>}

      <section className="portal-panel">
        <div className="portal-panel-head">
          <h2>Inventory</h2>
        </div>
        {listings.length === 0 ? (
          <div className="empty-rich">
            <strong>No properties yet</strong>
            <p>List your first home. It stays private until an admin approves it.</p>
            <Link to="/host/new" className="btn btn-primary">
              Add property
            </Link>
          </div>
        ) : (
          <div className="portal-data">
            <div className="portal-data-head">
              <span>Property</span>
              <span>Status</span>
              <span>Price</span>
              <span>Actions</span>
            </div>
            {listings.map((l) => (
              <div key={l.id} className="portal-data-row">
                <div className="portal-data-prop">
                  <img src={l.images?.[0]} alt="" />
                  <div>
                    <strong>{l.title}</strong>
                    <span>
                      {l.location}
                      {l.code ? ` · #${l.code}` : ''}
                    </span>
                  </div>
                </div>
                <span className={`pill ${l.approval || 'pending'}`}>{l.approval || 'pending'}</span>
                <em>{formatPrice(l as never)}</em>
                <div className="row-actions">
                  <Link to={`/host/edit/${l.id}`}>Edit</Link>
                  <button type="button" className="danger" onClick={() => remove(l.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
