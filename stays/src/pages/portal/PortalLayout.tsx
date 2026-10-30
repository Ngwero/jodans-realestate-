import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { BrandLogo } from '../../components/BrandLogo'
import { useAuth } from '../../lib/auth'

type Props = {
  role: 'admin' | 'host'
  links: { to: string; label: string }[]
}

export function PortalLayout({ role, links }: Props) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [apiOk, setApiOk] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((r) => setApiOk(r.ok))
      .catch(() => setApiOk(false))
  }, [])

  if (!user) {
    return <Navigate to={role === 'admin' ? '/admin/login' : '/host/login'} replace />
  }
  if (role === 'admin' && user.role !== 'admin') {
    return <Navigate to="/host" replace />
  }
  if (role === 'host' && user.role !== 'host' && user.role !== 'admin') {
    return <Navigate to="/host/login" replace />
  }

  const isOn = (to: string) => {
    if (to === `/${role}`) return location.pathname === to
    return location.pathname === to || location.pathname.startsWith(`${to}/`)
  }

  return (
    <div className={`portal-app ${role}`}>
      <aside className="portal-side">
        <div className="portal-side-top">
          <Link to="/backend" className="portal-side-brand" title="Jodans Concepts">
            <BrandLogo compact />
          </Link>
          <p className="portal-side-role">
            {role === 'admin' ? 'Admin console' : 'Host console'}
          </p>
          <div className={`portal-api-pill ${apiOk === false ? 'down' : apiOk ? 'up' : ''}`}>
            API {apiOk === null ? '…' : apiOk ? 'online' : 'offline'}
          </div>
        </div>

        <nav aria-label="Console">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className={isOn(l.to) ? 'on' : ''}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="portal-side-foot">
          <p className="portal-side-user">{user.name}</p>
          <p className="portal-side-email">{user.email}</p>
          <div className="portal-side-actions">
            <Link to="/" className="btn btn-ghost">
              Marketplace
            </Link>
            <button type="button" className="btn btn-ghost" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <div className="portal-workspace">
        <header className="portal-topbar">
          <div>
            <p className="portal-crumb">Backend / {role}</p>
            <p className="portal-topbar-path">{location.pathname}</p>
          </div>
          {role === 'host' && (
            <Link to="/host/new" className="btn btn-primary">
              + Add property
            </Link>
          )}
          {role === 'admin' && (
            <Link to="/admin/listings?approval=pending" className="btn btn-primary">
              Review queue
            </Link>
          )}
        </header>
        <main className="portal-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
