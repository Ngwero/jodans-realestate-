import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatPrice, getListing, isForSale, type Listing } from '../data/listings'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'
import { api } from '../lib/api'

export function StayPage() {
  const { id } = useParams()
  const [listing, setListing] = useState<Listing | undefined>(() =>
    id ? getListing(id) : undefined,
  )
  const [loading, setLoading] = useState(Boolean(id))
  const [toast, setToast] = useState(false)

  useEffect(() => {
    if (!id) return
    let alive = true
    setLoading(true)
    api
      .publicListing(id)
      .then((res) => {
        if (alive) setListing(res.listing as Listing)
      })
      .catch(() => {
        if (alive) setListing(getListing(id))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [id])

  if (loading && !listing) {
    return (
      <div className="page">
        <Navbar />
        <div className="detail">
          <p>Loading home…</p>
        </div>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="page">
        <Navbar />
        <div className="detail">
          <Link to="/" className="back-link">
            ← Back to homes
          </Link>
          <h1 className="detail-title">Listing not found</h1>
          <p>That property may have moved. Browse homes across Uganda instead.</p>
        </div>
        <Footer />
      </div>
    )
  }

  const sale = isForSale(listing)

  const inquire = (e: FormEvent) => {
    e.preventDefault()
    setToast(true)
    window.setTimeout(() => setToast(false), 2800)
  }

  return (
    <div className="page">
      <Navbar />
      <div className="detail">
        <Link to="/" className="back-link">
          ← All homes
        </Link>
        <h1 className="detail-title">{listing.title}</h1>
        <div className="detail-sub">
          {sale && <span className="status-pill">For sale</span>}
          <span>{listing.location}</span>
          <span>
            Agent {listing.host}
            {listing.hostYears ? ` · ${listing.hostYears} years` : ''}
          </span>
          {listing.code && <span>Ref #{listing.code}</span>}
        </div>

        <div className="gallery">
          {listing.images.map((src, i) => (
            <img
              key={`${src}-${i}`}
              src={src}
              alt={`${listing.title} photo ${i + 1}`}
            />
          ))}
        </div>

        <div className="detail-layout">
          <div className="detail-main">
            <h3>
              {listing.type} in {listing.region}
            </h3>
            <p>
              {listing.bedrooms} bedroom{listing.bedrooms === 1 ? '' : 's'} ·{' '}
              {listing.baths} bath{listing.baths === 1 ? '' : 's'}
            </p>
            <p>{listing.description}</p>
            <h3 style={{ marginTop: '1.75rem' }}>Features</h3>
            <ul className="amenity-list">
              {listing.amenities.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>

          <aside className="book-card">
            <div className="book-price">
              {formatPrice(listing)}{' '}
              <span>{sale ? 'asking price' : 'rent'}</span>
            </div>
            <form className="book-fields" onSubmit={inquire}>
              <label>
                Your name
                <input type="text" required placeholder="Full name" />
              </label>
              <label>
                Phone
                <input type="tel" required placeholder="+256…" />
              </label>
              <label>
                Message
                <input
                  type="text"
                  defaultValue={`Interested in ${listing.title}`}
                  required
                />
              </label>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Contact agent
              </button>
              {listing.phone && (
                <a
                  className="btn btn-outline"
                  style={{ width: '100%' }}
                  href={`tel:${listing.phone}`}
                >
                  Call {listing.host}
                </a>
              )}
            </form>
            <p className="book-note">
              Enquiry only · Agent: {listing.host}
              {listing.phone ? ` · ${listing.phone}` : ''}
            </p>
          </aside>
        </div>
      </div>
      <Footer />
      <div className={`toast${toast ? ' show' : ''}`} role="status">
        Enquiry noted for {listing.host}
        {listing.phone ? ` (${listing.phone})` : ''}.
      </div>
    </div>
  )
}
