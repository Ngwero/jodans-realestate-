import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice, isForSale, type Listing } from '../data/listings'

type Props = {
  listing: Listing
}

export function ListingCard({ listing }: Props) {
  const [saved, setSaved] = useState(false)
  const sale = isForSale(listing)
  const rent = (listing.status || '').toLowerCase().includes('rent')

  return (
    <Link to={`/stay/${listing.id}`} className="listing-card">
      <div className="listing-media">
        <img src={listing.images[0]} alt={listing.title} loading="lazy" />
        <span className={`listing-badge${rent ? ' rent' : ''}`}>
          {sale ? 'For sale' : rent ? 'For rent' : listing.status || 'Listing'}
        </span>
        <button
          type="button"
          className={`heart${saved ? ' saved' : ''}`}
          aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setSaved((v) => !v)
          }}
        >
          {saved ? '♥' : '♡'}
        </button>
      </div>
      <div className="listing-body">
        <div className="listing-top">
          <span className="listing-place">{listing.region}</span>
          <span className="rating">★ {listing.rating.toFixed(2)}</span>
        </div>
        <div className="listing-loc">{listing.title}</div>
        <div className="listing-meta">
          {listing.type} · {listing.bedrooms} bed
          {listing.bedrooms === 1 ? '' : 's'}
          {listing.baths ? ` · ${listing.baths} bath` : ''}
        </div>
        <div className="listing-price">
          <strong>{formatPrice(listing)}</strong>{' '}
          <span>{sale ? 'asking' : 'rent'}</span>
        </div>
      </div>
    </Link>
  )
}
