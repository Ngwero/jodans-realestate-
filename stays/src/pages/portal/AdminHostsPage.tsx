import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type AdminHost } from '../../lib/api'

export function AdminHostsPage() {
  const [hosts, setHosts] = useState<AdminHost[]>([])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'disabled'>('all')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    api
      .adminHosts()
      .then((res) => setHosts(res.hosts))
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return hosts.filter((h) => {
      if (filter === 'active' && !h.active) return false
      if (filter === 'disabled' && h.active) return false
      if (!term) return true
      return [h.name, h.email].join(' ').toLowerCase().includes(term)
    })
  }, [hosts, q, filter])

  const toggle = async (h: AdminHost) => {
    setBusy(h.id)
    try {
      await api.setHostActive(h.id, !h.active)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="portal-page">
      <header className="portal-page-head">
        <div>
          <h1>Hosts</h1>
          <p>
            {hosts.length} host{hosts.length === 1 ? '' : 's'} ·{' '}
            {hosts.filter((h) => h.active).length} active
          </p>
        </div>
      </header>

      <div className="portal-toolbar">
        <input
          type="search"
          placeholder="Search name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="portal-filters">
          {(['all', 'active', 'disabled'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={filter === s ? 'on' : ''}
              onClick={() => setFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="portal-error">{error}</p>}

      <div className="portal-data">
        <div className="portal-data-head admin-hosts-head">
          <span>Host</span>
          <span>Inventory</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {filtered.map((h) => (
          <div key={h.id} className="portal-data-row admin-hosts-row">
            <div>
              <Link to={`/admin/hosts/${h.id}`}>
                <strong>{h.name}</strong>
              </Link>
              <span className="portal-data-meta">{h.email}</span>
            </div>
            <span className="portal-data-meta">
              {h.listings} total · {h.approved} live · {h.pending} pending
              {h.rejected ? ` · ${h.rejected} rejected` : ''}
            </span>
            <span className={`pill ${h.active ? 'approved' : 'rejected'}`}>
              {h.active ? 'active' : 'disabled'}
            </span>
            <div className="row-actions">
              <Link to={`/admin/hosts/${h.id}`}>Open</Link>
              <Link to={`/admin/listings?hostId=${h.id}`}>Listings</Link>
              <button type="button" disabled={busy === h.id} onClick={() => toggle(h)}>
                {h.active ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="muted portal-data-empty">No hosts found.</p>}
      </div>
    </div>
  )
}
