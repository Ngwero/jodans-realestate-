import { useMemo, useRef } from 'react'

export type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'beds-desc' | 'newest'

export type QueryState = {
  q: string
  status: 'all' | 'sale' | 'rent'
  beds: number
  maxPrice: number
  currency: 'any' | 'UGX' | 'USD'
  sort: SortKey
}

const PLACE_SUGGESTIONS = [
  'Ntinda',
  'Kololo',
  'Naguru',
  'Muyenga',
  'Entebbe',
  'Kitende',
  'Kira',
  'Naalya',
  'Bukoto',
  'Bwebajja',
]

type Props = {
  value: QueryState
  onChange: (next: QueryState) => void
  resultCount: number
  priceCeiling: number
}

function formatBudget(amount: number, currency: QueryState['currency']) {
  if (currency === 'USD') return `$${amount.toLocaleString()}`
  if (amount >= 1_000_000_000) return `UGX ${(amount / 1_000_000_000).toFixed(1)}B`
  if (amount >= 1_000_000) return `UGX ${Math.round(amount / 1_000_000)}M`
  return `UGX ${amount.toLocaleString()}`
}

export function QueryPanel({ value, onChange, resultCount, priceCeiling }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof QueryState>(key: K, val: QueryState[K]) => {
    onChange({ ...value, [key]: val })
  }

  const budgetPresets = useMemo(() => {
    const caps = [
      { label: 'Any budget', value: priceCeiling },
      { label: 'Under 200M', value: 200_000_000 },
      { label: 'Under 500M', value: 500_000_000 },
      { label: 'Under 1B', value: 1_000_000_000 },
    ].filter((p) => p.value <= priceCeiling || p.value === priceCeiling)
    return caps
  }, [priceCeiling])

  const active = useMemo(() => {
    const chips: { key: keyof QueryState | 'reset'; label: string }[] = []
    if (value.q.trim()) chips.push({ key: 'q', label: value.q.trim() })
    if (value.status !== 'all') {
      chips.push({
        key: 'status',
        label: value.status === 'sale' ? 'For sale' : 'For rent',
      })
    }
    if (value.beds > 0) chips.push({ key: 'beds', label: `${value.beds}+ bedrooms` })
    if (value.maxPrice > 0 && value.maxPrice < priceCeiling) {
      chips.push({
        key: 'maxPrice',
        label: `Up to ${formatBudget(value.maxPrice, value.currency)}`,
      })
    }
    if (value.currency !== 'any') chips.push({ key: 'currency', label: value.currency })
    return chips
  }, [value, priceCeiling])

  const clearOne = (key: keyof QueryState | 'reset') => {
    if (key === 'reset') {
      onChange({
        q: '',
        status: 'all',
        beds: 0,
        maxPrice: priceCeiling,
        currency: 'any',
        sort: 'featured',
      })
      return
    }
    if (key === 'q') set('q', '')
    if (key === 'status') set('status', 'all')
    if (key === 'beds') set('beds', 0)
    if (key === 'maxPrice') set('maxPrice', priceCeiling)
    if (key === 'currency') set('currency', 'any')
  }

  return (
    <section className="query" aria-label="Search homes">
      <div className="query-card">
      <form className="query-bar" onSubmit={(e) => e.preventDefault()} role="search">
        <label className="query-search">
          <span className="query-ico" aria-hidden>
            ⌕
          </span>
          <input
            ref={inputRef}
            type="search"
            placeholder="Neighbourhood, area, or property type"
            value={value.q}
            onChange={(e) => set('q', e.target.value)}
            autoComplete="off"
            aria-label="Search by area or home type"
          />
          {value.q && (
            <button
              type="button"
              className="query-clear-input"
              aria-label="Clear search"
              onClick={() => {
                set('q', '')
                inputRef.current?.focus()
              }}
            >
              ×
            </button>
          )}
        </label>

        <div className="query-seg" role="group" aria-label="Buy or rent">
          {(
            [
              ['all', 'All homes'],
              ['sale', 'Buy'],
              ['rent', 'Rent'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={value.status === id ? 'on' : ''}
              onClick={() => set('status', id)}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="query-select">
          <span>Bedrooms</span>
          <select
            value={value.beds}
            onChange={(e) => set('beds', Number(e.target.value))}
            aria-label="Minimum bedrooms"
          >
            <option value={0}>Any</option>
            <option value={1}>1 or more</option>
            <option value={2}>2 or more</option>
            <option value={3}>3 or more</option>
            <option value={4}>4 or more</option>
            <option value={5}>5 or more</option>
            <option value={6}>6 or more</option>
          </select>
        </label>

        <label className="query-select">
          <span>Price in</span>
          <select
            value={value.currency}
            onChange={(e) =>
              set('currency', e.target.value as QueryState['currency'])
            }
            aria-label="Currency"
          >
            <option value="any">Any</option>
            <option value="UGX">UGX</option>
            <option value="USD">USD</option>
          </select>
        </label>

        <label className="query-select query-sort">
          <span>Sort by</span>
          <select
            value={value.sort}
            onChange={(e) => set('sort', e.target.value as SortKey)}
            aria-label="Sort results"
          >
            <option value="featured">Best match</option>
            <option value="newest">Newest</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="beds-desc">Most bedrooms</option>
          </select>
        </label>
      </form>

      <div className="query-suggest" aria-label="Popular areas">
        <span className="query-suggest-label">Popular</span>
        {PLACE_SUGGESTIONS.map((place) => (
          <button
            key={place}
            type="button"
            className={`query-suggest-chip${value.q.toLowerCase() === place.toLowerCase() ? ' on' : ''}`}
            onClick={() => set('q', place)}
          >
            {place}
          </button>
        ))}
      </div>

      <div className="query-budget" aria-label="Budget">
        <div className="query-budget-top">
          <span>Budget</span>
          <strong>{formatBudget(value.maxPrice, value.currency)}</strong>
        </div>
        <div className="query-budget-presets">
          {budgetPresets.map((p) => (
            <button
              key={p.label}
              type="button"
              className={
                value.maxPrice === p.value ||
                (p.value === priceCeiling && value.maxPrice >= priceCeiling)
                  ? 'on'
                  : ''
              }
              onClick={() => set('maxPrice', p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={priceCeiling}
          step={Math.max(1_000_000, Math.round(priceCeiling / 80))}
          value={Math.min(value.maxPrice, priceCeiling)}
          onChange={(e) => set('maxPrice', Number(e.target.value))}
          aria-label="Maximum price"
        />
      </div>
      </div>

      <div className="query-meta">
        <p>
          <strong>{resultCount.toLocaleString()}</strong>{' '}
          {resultCount === 1 ? 'home found' : 'homes found'}
        </p>
        {active.length > 0 && (
          <div className="query-chips">
            {active.map((c) => (
              <button
                key={c.key + c.label}
                type="button"
                className="query-chip"
                onClick={() => clearOne(c.key)}
              >
                {c.label} ×
              </button>
            ))}
            <button
              type="button"
              className="query-clear"
              onClick={() => clearOne('reset')}
            >
              Clear all
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
