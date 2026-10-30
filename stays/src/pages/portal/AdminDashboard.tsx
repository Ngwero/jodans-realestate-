import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  api,
  type ActivityItem,
  type AdminAnalytics,
  type AdminGeo,
  type AdminStats,
  type ListingDto,
} from '../../lib/api'
import { formatPrice } from '../../data/listings'
import { BarChart, DonutChart, HBarChart } from '../../components/admin/Charts'
import { UgandaMap } from '../../components/admin/UgandaMap'

function formatUgx(n: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(n)
}

function timeAgo(iso?: string) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

async function settled<T>(p: Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await p }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed' }
  }
}

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null)
  const [geo, setGeo] = useState<AdminGeo | null>(null)
  const [pending, setPending] = useState<ListingDto[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [error, setError] = useState('')
  const [partialErrors, setPartialErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true)
    else setLoading(true)
    setError('')
    setPartialErrors([])

    const [s, a, g, p, act] = await Promise.all([
      settled(api.adminStats()),
      settled(api.adminAnalytics()),
      settled(api.adminGeo()),
      settled(api.adminListings({ approval: 'pending', pageSize: 8 })),
      settled(api.adminActivity(10)),
    ])

    const fails: string[] = []
    if (s.ok) setStats(s.value.totals)
    else fails.push(`Stats: ${s.error}`)
    if (a.ok) setAnalytics(a.value)
    else fails.push(`Analytics: ${a.error}`)
    if (g.ok) setGeo(g.value)
    else fails.push(`Map: ${g.error}`)
    if (p.ok) setPending(p.value.listings)
    else fails.push(`Queue: ${p.error}`)
    if (act.ok) setActivity(act.value.activity)
    else fails.push(`Activity: ${act.error}`)

    setPartialErrors(fails)
    if (!s.ok) {
      setStats((prev) => {
        if (!prev) {
          // Keep hard error only when we have nothing to show
          setTimeout(() => setError(s.error), 0)
        }
        return prev
      })
    }
    setUpdatedAt(new Date())
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void load(false)
    const id = window.setInterval(() => void load(true), 60_000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + interval only
  }, [])

  const setApproval = async (id: string, approval: string) => {
    setBusy(id)
    try {
      await api.setApproval(id, approval)
      await load(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(null)
    }
  }

  if (loading && !stats) {
    return (
      <div className="portal-page">
        <p className="portal-loading">Loading dashboard…</p>
        <div className="dash-skeleton">
          <div /><div /><div /><div />
        </div>
      </div>
    )
  }

  if (error && !stats) {
    return (
      <div className="portal-page">
        <p className="portal-error">{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => load(false)}>
          Retry
        </button>
      </div>
    )
  }

  if (!stats) return null

  const approvalSlices = (analytics?.byApproval || []).map((x) => ({
    name: x.name,
    count: x.count,
  }))
  const statusSlices = (analytics?.byStatus || []).map((x) => ({
    name: x.name,
    count: x.count,
  }))
  const areaRows = (analytics?.byArea || analytics?.byDistrict || []).slice(0, 10)
  const categoryRows = (analytics?.byCategory || []).slice(0, 8)

  return (
    <div className="portal-page">
      <header className="portal-page-head">
        <div>
          <h1>Admin dashboard</h1>
          <p>
            Live inventory across Uganda
            {updatedAt ? ` · updated ${updatedAt.toLocaleTimeString()}` : ''}
            {refreshing ? ' · refreshing…' : ''}
          </p>
        </div>
        <div className="portal-head-actions">
          <button
            type="button"
            className="btn btn-outline"
            disabled={refreshing}
            onClick={() => load(true)}
          >
            Refresh
          </button>
          <Link to="/admin/listings?approval=pending" className="btn btn-primary">
            Review queue ({stats.pending})
          </Link>
        </div>
      </header>

      {partialErrors.length > 0 && (
        <p className="portal-warn">
          Some panels failed to load ({partialErrors.length}). Showing available data — try Refresh.
        </p>
      )}
      {error && <p className="portal-error">{error}</p>}

      <div className="stat-grid admin-stats">
        <article>
          <strong>{stats.listings.toLocaleString()}</strong>
          <span>Total listings</span>
        </article>
        <article>
          <strong>{stats.approved.toLocaleString()}</strong>
          <span>Live</span>
        </article>
        <article className={stats.pending ? 'stat-alert' : ''}>
          <strong>{stats.pending.toLocaleString()}</strong>
          <span>Pending</span>
        </article>
        <article>
          <strong>{stats.hosts}</strong>
          <span>Hosts</span>
        </article>
        <article>
          <strong>{stats.forSale.toLocaleString()}</strong>
          <span>For sale</span>
        </article>
        <article>
          <strong>{stats.forRent.toLocaleString()}</strong>
          <span>For rent</span>
        </article>
        <article>
          <strong>{stats.avgUgx ? formatUgx(stats.avgUgx) : '—'}</strong>
          <span>Avg UGX</span>
        </article>
        <article>
          <strong>{stats.avgUsd ? `$${stats.avgUsd.toLocaleString()}` : '—'}</strong>
          <span>Avg USD</span>
        </article>
      </div>

      <section className="portal-panel dash-map-panel">
        <div className="portal-panel-head">
          <h2>Uganda inventory map</h2>
          <span className="muted">{geo?.places.length || 0} areas</span>
        </div>
        {geo?.places?.length ? (
          <UgandaMap places={geo.places} bounds={geo.bounds} />
        ) : (
          <p className="muted">Map data unavailable.</p>
        )}
      </section>

      <div className="admin-charts-grid">
        <section className="portal-panel">
          <div className="portal-panel-head">
            <h2>Approval mix</h2>
          </div>
          {approvalSlices.length ? (
            <DonutChart slices={approvalSlices} centerSub="listings" />
          ) : (
            <p className="muted">No chart data</p>
          )}
        </section>

        <section className="portal-panel">
          <div className="portal-panel-head">
            <h2>Sale vs rent</h2>
          </div>
          {statusSlices.length ? (
            <DonutChart slices={statusSlices} centerSub="status" />
          ) : (
            <p className="muted">No chart data</p>
          )}
        </section>

        <section className="portal-panel">
          <div className="portal-panel-head">
            <h2>Top areas</h2>
            <Link to="/admin/analytics">Analytics</Link>
          </div>
          <BarChart rows={areaRows} />
        </section>

        <section className="portal-panel">
          <div className="portal-panel-head">
            <h2>Categories</h2>
          </div>
          <HBarChart rows={categoryRows} />
        </section>
      </div>

      <div className="admin-dash-grid">
        <section className="portal-panel">
          <div className="portal-panel-head">
            <h2>Review queue</h2>
            <Link to="/admin/listings?approval=pending">View all</Link>
          </div>
          {pending.length === 0 ? (
            <p className="muted">No listings waiting for approval.</p>
          ) : (
            <div className="portal-data compact">
              {pending.map((l) => (
                <div key={l.id} className="portal-data-row stacked">
                  <div className="portal-data-prop">
                    <img src={l.images?.[0]} alt="" />
                    <div>
                      <Link to={`/admin/listings/${l.id}`}>
                        <strong>{l.title}</strong>
                      </Link>
                      <span>
                        {l.location} · {l.host}
                      </span>
                    </div>
                  </div>
                  <em>{formatPrice(l)}</em>
                  <div className="row-actions">
                    <button
                      type="button"
                      disabled={busy === l.id}
                      onClick={() => setApproval(l.id, 'approved')}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy === l.id}
                      onClick={() => setApproval(l.id, 'rejected')}
                    >
                      Reject
                    </button>
                    <Link to={`/admin/listings/${l.id}`}>Open</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="portal-panel">
          <div className="portal-panel-head">
            <h2>Recent activity</h2>
            <Link to="/admin/activity">Activity log</Link>
          </div>
          {activity.length === 0 ? (
            <p className="muted">No activity yet.</p>
          ) : (
            <ul className="admin-activity">
              {activity.map((a) => (
                <li key={a.id}>
                  <span className="admin-activity-time">{timeAgo(a.at)}</span>
                  <div>
                    <strong>{a.action.replace(/_/g, ' ')}</strong>
                    <span>
                      {a.actor || 'system'}
                      {a.detail ? ` · ${a.detail}` : ''}
                    </span>
                  </div>
                  {a.listingId && (
                    <Link to={`/admin/listings/${a.listingId}`} className="admin-activity-link">
                      View
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
