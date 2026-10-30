import { Link } from 'react-router-dom'
import { BrandLogo } from './BrandLogo'
import { PLATFORM_URL } from '../lib/platform'

export function Footer() {
  return (
    <footer className="footer footer-slim">
      <div className="footer-brand-row">
        <Link to="/" aria-label="Jodans Concepts home">
          <BrandLogo compact />
        </Link>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} Jodans Bloka · Part of{' '}
          <a href={PLATFORM_URL}>Jodans Concepts</a>
        </span>
        <span>UGX · EN</span>
      </div>
    </footer>
  )
}
