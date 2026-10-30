import { useEffect, useMemo, useState } from 'react'
import { categories, listings as staticListings, ugandaImages, type Listing } from '../data/listings'
import { Footer } from '../components/Footer'
import { ListingCard } from '../components/ListingCard'
import { Navbar } from '../components/Navbar'
import { QueryPanel, type QueryState } from '../components/QueryPanel'
import { api } from '../lib/api'

const PAGE_SIZE = 24

function matchesCategory(listing: Listing, category: string) {
  if (category === 'all') return true
  if (category === 'sale') return (listing.status || '').toLowerCase().includes('sale')
  if (category === 'rent') return (listing.status || '').toLowerCase().includes('rent')
  if (category === 'kampala') return (listing.district || '').toLowerCase() === 'kampala'
  if (category === 'wakiso') return (listing.district || '').toLowerCase() === 'wakiso'
  if (category === 'entebbe') return listing.region.toLowerCase().includes('entebbe')
  if (category === 'mansion') {
    return (
      listing.category === 'mansion' ||
      listing.type.toLowerCase().includes('mansion')
    )
  }
  if (category === 'storeyed') {
    return (
      listing.category === 'storeyed' ||
      listing.type.toLowerCase().includes('storeyed') ||
      listing.type.toLowerCase().includes('storyed')
    )
  }
  if (category === 'apartment') return listing.category === 'apartment'
  if (category === 'bungalow') return listing.category === 'bungalow'
  if (category === 'land') return listing.category === 'land'
  if (category === 'duplex') return listing.category === 'duplex'
  return listing.category === category
}

export function HomePage() {
  const [listings, setListings] = useState<Listing[]>(staticListings)

  useEffect(() => {
    api
      .publicListings()
      .then((res) => {
        if (res.listings?.length) setListings(res.listings as Listing[])
      })
      .catch(() => {
        /* keep static fallback if API is offline */
      })
  }, [])

  const priceCeiling = useMemo(() => {
    const max = Math.max(...listings.map((l) => l.price || 0), 1)
    const sorted = [...listings].map((l) => l.price).filter(Boolean).sort((a, b) => a - b)
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || max
    return Math.max(p95, 1)
  }, [listings])

  const [category, setCategory] = useState('all')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [query, setQuery] = useState<QueryState>({
    q: '',
    status: 'all',
    beds: 0,
    maxPrice: 0,
    currency: 'any',
    sort: 'featured',
  })

  const effectiveQuery = {
    ...query,
    maxPrice: query.maxPrice > 0 ? query.maxPrice : priceCeiling,
  }

  const filtered = useMemo(() => {
    const term = effectiveQuery.q.trim().toLowerCase()
    let rows = listings.filter((l) => {
      if (!matchesCategory(l, category)) return false

      if (effectiveQuery.status === 'sale' && !(l.status || '').toLowerCase().includes('sale')) {
        return false
      }
      if (effectiveQuery.status === 'rent' && !(l.status || '').toLowerCase().includes('rent')) {
        return false
      }
      if (effectiveQuery.beds > 0 && l.bedrooms < effectiveQuery.beds) return false
      if (effectiveQuery.currency !== 'any' && (l.currency || 'UGX') !== effectiveQuery.currency) {
        return false
      }
      if (l.price > 0 && l.price > effectiveQuery.maxPrice) return false

      if (term) {
        const hay = [
          l.title,
          l.location,
          l.region,
          l.district,
          l.type,
          l.code,
          l.host,
          l.status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })

    rows = [...rows]
    switch (effectiveQuery.sort) {
      case 'price-asc':
        rows.sort((a, b) => (a.price || Infinity) - (b.price || Infinity))
        break
      case 'price-desc':
        rows.sort((a, b) => (b.price || 0) - (a.price || 0))
        break
      case 'beds-desc':
        rows.sort((a, b) => b.bedrooms - a.bedrooms)
        break
      case 'newest':
        rows.sort((a, b) => Number(b.code || b.id) - Number(a.code || a.id))
        break
      default:
        rows.sort((a, b) => b.rating - a.rating || (b.price || 0) - (a.price || 0))
    }
    return rows
  }, [listings, category, effectiveQuery])

  const shown = filtered.slice(0, visible)

  const updateQuery = (next: QueryState) => {
    setQuery(next)
    setVisible(PAGE_SIZE)
  }

  return (
    <div className="page page-direct">
      <Navbar />

      <main className="browse">
        <section className="hero" aria-label="Find a home">
          <img className="hero-photo" src={ugandaImages.kampalaSunset} alt="" />
          <div className="hero-shade" aria-hidden="true" />
          <div className="hero-copy">
            <p className="hero-kicker">Jodans Concepts</p>
            <h1>Find a home in Uganda</h1>
            <p>Sale and rent across Kampala, Wakiso, and Entebbe.</p>
            <ul className="hero-stats">
              <li>Kampala</li>
              <li>Wakiso</li>
              <li>Entebbe</li>
            </ul>
          </div>
        </section>

        <div className="hero-dock">
          <QueryPanel
            value={effectiveQuery}
            onChange={updateQuery}
            resultCount={filtered.length}
            priceCeiling={priceCeiling}
          />
        </div>

        <div className="categories sticky-cats" role="tablist" aria-label="Categories">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={category === c.id}
              className={`chip${category === c.id ? ' active' : ''}`}
              onClick={() => {
                setCategory(c.id)
                setVisible(PAGE_SIZE)
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        <section id="stays" className="browse-grid" aria-live="polite">
          {shown.length === 0 ? (
            <div className="empty empty-rich">
              <strong>No homes match</strong>
              <p>Try another location, raise the budget, or clear filters.</p>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() =>
                  updateQuery({
                    q: '',
                    status: 'all',
                    beds: 0,
                    maxPrice: priceCeiling,
                    currency: 'any',
                    sort: 'featured',
                  })
                }
              >
                Reset filters
              </button>
            </div>
          ) : (
            <>
              <div className="listing-grid">
                {shown.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
              {visible < filtered.length && (
                <div className="load-more">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  >
                    Show more · {filtered.length - visible} remaining
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  )
}
