import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type ListingDto } from '../../lib/api'
import { formatPrice } from '../../data/listings'

export function AdminListingsPage() {
  const [params, setParams] = useSearchParams()
  const approval = params.get('approval') || 'all'
  const status = params.get('status') || 'all'
  const sort = params.get('sort') || 'updated'
  const page = Number(params.get('page') || 1)
  const hostId = params.get('hostId') || ''

  const [q, setQ] = useState(params.get('q') || '')
  const [district, setDistrict] = useState(params.get('district') || '')
  const [listings, setListings] = useState<ListingDto[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const load = () => {
    api
      .adminListings({
        approval,
        status,
        sort,
        page,
        pageSize: 40,
        q: params.get('q') || undefined,
        district: params.get('district') || undefined,
        hostId: hostId || undefined,
      })
      .then((res) => {
        setListings(res.listings)
        setTotal(res.total)
        setPages(res.pages)
        setSelected(new Set())
      })
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    load()
  }, [approval, status, sort, page, hostId, params.get('q'), params.get('district')])

  const allSelected = useMemo(
    () => listings.length > 0 && listings.every((l) => selected.has(l.id)),
    [listings, selected],
  )

  const patchParams = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params)
    Object.entries(next).forEach(([k, v]) => {
      if (!v || v === 'all') sp.delete(k)
      else sp.set(k, v)
    })
    if (!('page' in next)) sp.delete('page')
    setParams(sp)
  }

  const applySearch = () => {
    patchParams({ q: q || null, district: district || null, page: null })
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(listings.map((l) => l.id)))
  }

  const setApproval = async (id: string, next: string) => {
    setBusy(true)
    try {
      await api.setApproval(id, next)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const bulk = async (next: string) => {
    if (!selected.size) return
    setBusy(true)
    try {
      await api.bulkApproval([...selected], next)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk update failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this listing permanently?')) return
    setBusy(true)
    try {
      await api.deleteAdminListing(id)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="portal-page">
      <header className="portal-page-head">
        <div>
          <h1>Listings</h1>
          <p>
            {total.toLocaleString()} match
            {approval !== 'all' ? ` · ${approval}` : ''}
            {hostId ? ' · filtered by host' : ''}
          </p>
        </div>
        <Link to="/admin/listings/new" className="btn btn-primary">
          Add listing
        </Link>
      </header>

      <div className="portal-toolbar admin-toolbar">
        <input
          type="search"
          placeholder="Search title, host, area, ref, phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applySearch()}
        />
        <input
          type="search"
          placeholder="District / area"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applySearch()}
        />
        <button type="button" className="btn btn-outline" onClick={applySearch}>
          Search
        </button>
        <select
          value={status}
          onChange={(e) => patchParams({ status: e.target.value, page: null })}
          aria-label="Sale or rent"
        >
          <option value="all">Sale & rent</option>
          <option value="sale">For sale</option>
          <option value="rent">For rent</option>
        </select>
        <select
          value={sort}
          onChange={(e) => patchParams({ sort: e.target.value, page: null })}
          aria-label="Sort"
        >
          <option value="updated">Recently updated</option>
          <option value="price-desc">Price high → low</option>
          <option value="price-asc">Price low → high</option>
          <option value="title">Title A–Z</option>
        </select>
      </div>

      <div className="portal-filters">
        {['all', 'pending', 'approved', 'rejected', 'hidden'].map((s) => (
          <button
            key={s}
            type="button"
            className={approval === s ? 'on' : ''}
            onClick={() => patchParams({ approval: s, page: null })}
          >
            {s}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="admin-bulk-bar">
          <span>{selected.size} selected</span>
          <button type="button" disabled={busy} onClick={() => bulk('approved')}>
            Approve
          </button>
          <button type="button" disabled={busy} onClick={() => bulk('rejected')}>
            Reject
          </button>
          <button type="button" disabled={busy} onClick={() => bulk('hidden')}>
            Hide
          </button>
          <button type="button" disabled={busy} onClick={() => bulk('pending')}>
            Mark pending
          </button>
        </div>
      )}

      {error && <p className="portal-error">{error}</p>}

      <div className="portal-data">
        <div className="portal-data-head admin-listings-head">
          <label className="admin-check">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          </label>
          <span>Property</span>
          <span>Status</span>
          <span>Price</span>
          <span>Actions</span>
        </div>
        {listings.map((l) => (
          <div key={l.id} className="portal-data-row admin-listings-row">
            <label className="admin-check">
              <input
                type="checkbox"
                checked={selected.has(l.id)}
                onChange={() => toggle(l.id)}
              />
            </label>
            <div className="portal-data-prop">
              <img src={l.images?.[0]} alt="" />
              <div>
                <Link to={`/admin/listings/${l.id}`}>
                  <strong>{l.title}</strong>
                </Link>
                <span>
                  {l.location} · {l.host}
                  {l.code ? ` · #${l.code}` : ''} · {l.status || '—'}
                </span>
              </div>
            </div>
            <span className={`pill ${l.approval || 'approved'}`}>{l.approval || 'approved'}</span>
            <em>{formatPrice(l)}</em>
            <div className="row-actions">
              <Link to={`/admin/listings/${l.id}`}>Manage</Link>
              <button type="button" disabled={busy} onClick={() => setApproval(l.id, 'approved')}>
                Approve
              </button>
              <button type="button" disabled={busy} onClick={() => setApproval(l.id, 'rejected')}>
                Reject
              </button>
              <button type="button" className="danger" disabled={busy} onClick={() => remove(l.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {listings.length === 0 && <p className="muted portal-data-empty">No listings in this view.</p>}
      </div>

      {pages > 1 && (
        <div className="admin-pager">
          <button
            type="button"
            className="btn btn-outline"
            disabled={page <= 1}
            onClick={() => patchParams({ page: String(page - 1) })}
          >
            Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button
            type="button"
            className="btn btn-outline"
            disabled={page >= pages}
            onClick={() => patchParams({ page: String(page + 1) })}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
