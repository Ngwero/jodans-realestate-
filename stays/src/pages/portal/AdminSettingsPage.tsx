import { useEffect, useState } from 'react'
import { api, type AdminStats } from '../../lib/api'

export function AdminSettingsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [health, setHealth] = useState<string>('checking…')

  useEffect(() => {
    api.adminStats().then((s) => setStats(s.totals)).catch(() => setStats(null))
    fetch('/api/health')
      .then((r) => (r.ok ? setHealth('online') : setHealth('error')))
      .catch(() => setHealth('offline'))
  }, [])

  return (
    <div className="portal-page">
      <header className="portal-page-head">
        <div>
          <h1>Settings</h1>
          <p>Platform console info and demo credentials.</p>
        </div>
      </header>

      <div className="admin-settings-grid">
        <section className="portal-panel">
          <div className="portal-panel-head">
            <h2>API status</h2>
          </div>
          <p>
            Health: <strong className={health === 'online' ? 'ok-text' : 'portal-error'}>{health}</strong>
          </p>
          {stats && (
            <ul className="admin-settings-list">
              <li>
                <span>Listings in DB</span>
                <strong>{stats.listings.toLocaleString()}</strong>
              </li>
              <li>
                <span>Hosts</span>
                <strong>{stats.hosts}</strong>
              </li>
              <li>
                <span>Pending review</span>
                <strong>{stats.pending}</strong>
              </li>
            </ul>
          )}
        </section>

        <section className="portal-panel">
          <div className="portal-panel-head">
            <h2>Demo access</h2>
          </div>
          <ul className="admin-settings-list">
            <li>
              <span>Admin</span>
              <strong>admin@jodansbloka.com / admin123</strong>
            </li>
            <li>
              <span>Host</span>
              <strong>host@jodansbloka.com / host123</strong>
            </li>
          </ul>
        </section>

        <section className="portal-panel admin-dash-span">
          <div className="portal-panel-head">
            <h2>Data store</h2>
          </div>
          <p className="muted">
            Listings and users are stored in <code>server/data/db.json</code>. To re-seed from scraped
            data, stop the API and run:
          </p>
          <pre className="admin-code">rm -f server/data/db.json && npm run dev:api</pre>
        </section>
      </div>
    </div>
  )
}
