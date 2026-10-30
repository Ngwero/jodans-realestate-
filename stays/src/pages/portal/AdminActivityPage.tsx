import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type ActivityItem } from '../../lib/api'

export function AdminActivityPage() {
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .adminActivity(150)
      .then((res) => setActivity(res.activity))
      .catch((e) => setError(e.message))
  }, [])

  return (
    <div className="portal-page">
      <header className="portal-page-head">
        <div>
          <h1>Activity log</h1>
          <p>Moderation, host actions, and system events.</p>
        </div>
      </header>

      {error && <p className="portal-error">{error}</p>}

      <div className="portal-panel">
        {activity.length === 0 ? (
          <p className="muted">No activity yet. Approve a listing or edit a host to start the log.</p>
        ) : (
          <ul className="admin-activity dense">
            {activity.map((a) => (
              <li key={a.id}>
                <span className="admin-activity-time">
                  {new Date(a.at).toLocaleString()}
                </span>
                <div>
                  <strong>{a.action.replace(/_/g, ' ')}</strong>
                  <span>
                    {a.actor || 'system'}
                    {a.detail ? ` · ${a.detail}` : ''}
                  </span>
                </div>
                {a.listingId && (
                  <Link to={`/admin/listings/${a.listingId}`} className="admin-activity-link">
                    Listing
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
