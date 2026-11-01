import { useEffect, useMemo, useRef, useState } from 'react'
import { listings as staticListings, type Listing } from '../data/listings'
import { Footer } from '../components/Footer'
import { ListingCard } from '../components/ListingCard'
import { Navbar } from '../components/Navbar'
import type { QueryState } from '../components/QueryPanel'
import { api } from '../lib/api'

const STRIP = [
  { id: 'all', label: 'All' },
  { id: 'sale', label: 'For sale' },
  { id: 'rent', label: 'For rent' },
  { id: 'mansion', label: 'Mansions' },
  { id: 'apartment', label: 'Apartments' },
  { id: 'bungalow', label: 'Bungalows' },
  { id: 'land', label: 'Land' },
] as const

function PlaceRow({
  title,
  subtitle,
  listings,
}: {
  title: string
  subtitle: string
  listings: Listing[]
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const move = (dir: number) => {
    const el = scroller.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.75, 280), behavior: 'smooth' })
  }

  return (
    <section className="stay-row">
      <div className="stay-row-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="stay-arrows">
          <button type="button" aria-label={`Previous ${title}`} onClick={() => move(-1)}>
            ‹
          </button>
          <button type="button" aria-label={`Next ${title}`} onClick={() => move(1)}>
            ›
          </button>
        </div>
      </div>
      <div className="stay-rail" ref={scroller}>
        {listings.slice(0, 14).map((listing) => (
          <ListingCard key={listing.id} listing={listing} dense />
        ))}
      </div>
    </section>
  )
}

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

  const shown = filtered

  const placeRows = useMemo(() => {
    const map = new Map<string, Listing[]>()
    for (const listing of shown) {
      const name = (listing.region || listing.district || 'Uganda').trim()
      const bucket = map.get(name) || []
      bucket.push(listing)
      map.set(name, bucket)
    }
    return [...map.entries()]
      .map(([name, items]) => ({
        name,
        items,
        subtitle: `${items.length} homes`,
      }))
      .filter((row) => row.items.length >= 3)
      .sort((a, b) => b.items.length - a.items.length)
      .slice(0, 6)
  }, [shown])

  const set = <K extends keyof QueryState>(key: K, val: QueryState[K]) => {
    setQuery((q) => ({ ...q, [key]: val }))
  }

  return (
    <div className="page page-stay">
      <Navbar />

      <div className="stay-top">
        <form className="stay-pill" role="search" onSubmit={(e) => e.preventDefault()}>
          <label>
            <span>Where</span>
            <input
              type="search"
              placeholder="Search areas"
              value={query.q}
              onChange={(e) => set('q', e.target.value)}
              aria-label="Search by area"
            />
          </label>
          <label>
            <span>Buy or rent</span>
            <select
              value={query.status}
              onChange={(e) => set('status', e.target.value as QueryState['status'])}
              aria-label="Buy or rent"
            >
              <option value="all">All homes</option>
              <option value="sale">Buy</option>
              <option value="rent">Rent</option>
            </select>
          </label>
          <label>
            <span>Bedrooms</span>
            <select
              value={query.beds}
              onChange={(e) => set('beds', Number(e.target.value))}
              aria-label="Bedrooms"
            >
              <option value={0}>Any</option>
              <option value={1}>1+</option>
              <option value={2}>2+</option>
              <option value={3}>3+</option>
              <option value={4}>4+</option>
              <option value={5}>5+</option>
            </select>
          </label>
          <button type="submit" className="stay-go" aria-label="Search">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M16 16l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </form>

        <div className="stay-cats" role="tablist" aria-label="Property types">
          {STRIP.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={category === item.id}
              className={category === item.id ? 'on' : ''}
              onClick={() => setCategory(item.id)}
            >
              <CatIcon id={item.id} />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <main className="stay-main">
        {placeRows.length === 0 ? (
          <div className="empty empty-rich">
            <strong>No homes match</strong>
            <p>Try another area or clear the filters.</p>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setCategory('all')
                setQuery({
                  q: '',
                  status: 'all',
                  beds: 0,
                  maxPrice: priceCeiling,
                  currency: 'any',
                  sort: 'featured',
                })
              }}
            >
              Reset filters
            </button>
          </div>
        ) : (
          placeRows.map((row) => (
            <PlaceRow
              key={row.name}
              title={`Homes in ${row.name}`}
              subtitle={row.subtitle}
              listings={row.items}
            />
          ))
        )}
      </main>

      <Footer />
    </div>
  )
}

function CatIcon({ id }: { id: string }) {
  const common = {
    viewBox: '0 0 32 32',
    width: 28,
    height: 28,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    'aria-hidden': true,
  }
  if (id === 'sale') {
    return (
      <svg {...common}>
        <path d="M6 14l10-8 10 8v12H6z" />
        <path d="M13 26v-7h6v7" />
      </svg>
    )
  }
  if (id === 'rent') {
    return (
      <svg {...common}>
        <path d="M8 26V12l8-6 8 6v14" />
        <path d="M14 26v-6h4v6" />
      </svg>
    )
  }
  if (id === 'mansion') {
    return (
      <svg {...common}>
        <path d="M4 26V14l6-4 6 4 6-4 6 4v12" />
        <path d="M14 26v-6h4v6" />
      </svg>
    )
  }
  if (id === 'apartment') {
    return (
      <svg {...common}>
        <rect x="8" y="6" width="16" height="20" rx="1" />
        <path d="M12 11h2M18 11h2M12 16h2M18 16h2M14 26v-4h4v4" />
      </svg>
    )
  }
  if (id === 'bungalow') {
    return (
      <svg {...common}>
        <path d="M5 16l11-8 11 8" />
        <path d="M8 15v11h16V15" />
      </svg>
    )
  }
  if (id === 'land') {
    return (
      <svg {...common}>
        <path d="M4 22c4-6 6-6 8 0s4 6 8 0 4-6 8 0" />
        <path d="M16 8v6" />
        <circle cx="16" cy="7" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <rect x="6" y="6" width="8" height="8" rx="1.5" />
      <rect x="18" y="6" width="8" height="8" rx="1.5" />
      <rect x="6" y="18" width="8" height="8" rx="1.5" />
      <rect x="18" y="18" width="8" height="8" rx="1.5" />
    </svg>
  )
}
