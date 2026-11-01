import { useEffect, useState } from 'react'
import { api, type AdminStats } from '../../lib/api'

export function AdminSettingsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [health, setHealth] = useState<string>('checking…')

  useEffect(() => {
    api.adminStats().then((s) => setStats(s.totals)).catch(() => setStats(null))
    api.health()
      .then((r) => (r.ok ? setHealth('online') : setHealth('error')))
      .catch(() => setHealth('offline'))
  }, [])

  return (
    <div className="portal-page">
      <header className="portal-page-head">
        <div>
          <h1>Settings</h1>
          <p>Platform status and account access.</p>
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
            <h2>Account access</h2>
          </div>
          <p>Hosts can register in the host portal. Admin access is assigned by the platform owner.</p>
          <p>Contact the platform owner if you cannot access your account.</p>
        </section>

        <section className="portal-panel admin-dash-span">
          <div className="portal-panel-head">
            <h2>Property photos</h2>
          </div>
          <p className="muted">Uploaded photos are hosted online and stay available across devices. Host submissions require approval before appearing in the marketplace.</p>
        </section>
      </div>
    </div>
  )
}
