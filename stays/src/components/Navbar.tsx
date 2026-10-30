import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from './BrandLogo'
import { PLATFORM_URL } from '../lib/platform'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const menuId = useId()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header className={`nav${scrolled || open ? ' scrolled' : ''}`}>
      <div className="nav-inner">
        <Link to="/" className="brand" aria-label="Jodans Concepts home" onClick={() => setOpen(false)}>
          <BrandLogo compact />
        </Link>
        <nav className="nav-links" aria-label="Primary">
          <Link to="/" className="nav-link on">
            Properties
          </Link>
          <a href={PLATFORM_URL} className="nav-link">
            Company
          </a>
          <Link to="/backend" className="nav-link" onClick={() => setOpen(false)}>
            Sign in
          </Link>
        </nav>
        <div className="nav-actions">
          <Link to="/host/new" className="btn btn-primary nav-cta" onClick={() => setOpen(false)}>
            List a property
          </Link>
          <button
            type="button"
            className={`nav-burger${open ? ' open' : ''}`}
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      <div id={menuId} className={`nav-drawer${open ? ' open' : ''}`} hidden={!open}>
        <div className="nav-drawer-panel">
          <a href={PLATFORM_URL} className="nav-drawer-link" onClick={() => setOpen(false)}>
            Jodans Concepts
          </a>
          <Link to="/" className="nav-drawer-link" onClick={() => setOpen(false)}>
            All homes
          </Link>
          <Link to="/backend" className="nav-drawer-link" onClick={() => setOpen(false)}>
            Backend portal
          </Link>
          <Link to="/host/login" className="nav-drawer-link" onClick={() => setOpen(false)}>
            Host sign in
          </Link>
          <Link to="/admin/login" className="nav-drawer-link" onClick={() => setOpen(false)}>
            Admin sign in
          </Link>
          <div className="nav-drawer-actions">
            <Link to="/host/new" className="btn btn-primary" onClick={() => setOpen(false)}>
              List a property
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
