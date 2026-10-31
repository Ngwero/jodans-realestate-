import { Link, Navigate } from 'react-router-dom'
import { BrandLogo } from '../../components/BrandLogo'
import { useAuth } from '../../lib/auth'

export function BackendHome() {
  const { user, loading } = useAuth()

  if (loading) return <p role="status">Loading your account…</p>

  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  if (user?.role === 'host') return <Navigate to="/host" replace />

  return (
    <div className="backend-gate">
      <div className="backend-gate-inner">
        <Link to="/" className="backend-gate-brand">
          <BrandLogo compact />
        </Link>
        <p className="backend-gate-kicker">Jodans Concepts · Backend</p>
        <h1>Operations console</h1>
        <p className="backend-gate-sub">
          Manage listings, approvals, and host properties — separate from the public marketplace.
        </p>

        <div className="backend-gate-cards">
          <Link to="/admin/login" className="backend-gate-card admin">
            <span className="backend-gate-tag">Staff</span>
            <h2>Admin portal</h2>
            <p>Approve, reject, hide, or delete listings. View hosts and platform stats.</p>
            <span className="backend-gate-cta">Open admin →</span>
          </Link>
          <Link to="/host/login" className="backend-gate-card host">
            <span className="backend-gate-tag">Hosts</span>
            <h2>Host portal</h2>
            <p>Add and edit your properties. New listings wait for admin approval.</p>
            <span className="backend-gate-cta">Open host →</span>
          </Link>
        </div>

        <p className="backend-gate-demo">Sign in with your account email. New hosts can register in the host portal.</p>
        <Link to="/" className="backend-gate-back">
          ← Back to marketplace
        </Link>
      </div>
    </div>
  )
}
