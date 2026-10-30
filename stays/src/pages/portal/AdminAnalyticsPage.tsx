import { useEffect, useState } from 'react'
import { api, type AdminAnalytics, type AdminStats } from '../../lib/api'

function BarList({
  title,
  rows,
}: {
  title: string
  rows: { name: string; count: number }[]
}) {
  const max = Math.max(...rows.map((r) => r.count), 1)
  return (
    <section className="portal-panel">
      <div className="portal-panel-head">
        <h2>{title}</h2>
      </div>
      <ul className="admin-bars">
        {rows.map((d) => (
          <li key={d.name}>
            <div className="admin-bar-meta">
              <span>{d.name}</span>
              <strong>{d.count.toLocaleString()}</strong>
            </div>
            <div className="admin-bar-track">
              <i style={{ width: `${(d.count / max) * 100}%` }} />
            </div>
          </li>
        ))}
        {rows.length === 0 && <p className="muted">No data</p>}
      </ul>
    </section>
  )
}

export function AdminAnalyticsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [data, setData] = useState<AdminAnalytics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.adminStats(), api.adminAnalytics()])
      .then(([s, a]) => {
        setStats(s.totals)
        setData(a)
      })
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <p className="portal-error">{error}</p>
  if (!stats || !data) return <p className="portal-loading">Loading analytics…</p>

  return (
    <div className="portal-page">
      <header className="portal-page-head">
        <div>
          <h1>Analytics</h1>
          <p>Inventory mix across Uganda — districts, types, and approval state.</p>
        </div>
      </header>

      <div className="stat-grid">
        <article>
          <strong>{stats.listings.toLocaleString()}</strong>
          <span>Listings</span>
        </article>
        <article>
          <strong>{Math.round((stats.approved / Math.max(stats.listings, 1)) * 100)}%</strong>
          <span>Live rate</span>
        </article>
        <article>
          <strong>{stats.forSale.toLocaleString()}</strong>
          <span>For sale</span>
        </article>
        <article>
          <strong>{stats.forRent.toLocaleString()}</strong>
          <span>For rent</span>
        </article>
      </div>

      <div className="admin-analytics-grid">
        <BarList title="By district" rows={data.byDistrict} />
        <BarList title="By area" rows={data.byArea || []} />
        <BarList title="By category" rows={data.byCategory} />
        <BarList title="By type" rows={data.byType} />
        <BarList title="By listing status" rows={data.byStatus} />
        <BarList title="By approval" rows={data.byApproval} />
        <BarList title="By currency" rows={data.byCurrency} />
      </div>
    </div>
  )
}
