import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../lib/api'

const empty = {
  title: '',
  location: '',
  region: '',
  district: 'Kampala',
  type: 'Apartment',
  category: 'apartment',
  status: 'For Sale',
  currency: 'UGX',
  price: '',
  bedrooms: '2',
  baths: '1',
  phone: '',
  description: '',
  image: '',
}

export function HostListingForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    api
      .hostListings()
      .then((res) => {
        const listing = res.listings.find((l) => l.id === id)
        if (!listing) throw new Error('Listing not found')
        setForm({
          title: listing.title,
          location: listing.location,
          region: listing.region,
          district: listing.district || 'Kampala',
          type: listing.type,
          category: listing.category,
          status: listing.status || 'For Sale',
          currency: listing.currency || 'UGX',
          price: String(listing.price || ''),
          bedrooms: String(listing.bedrooms || 1),
          baths: String(listing.baths || 1),
          phone: listing.phone || '',
          description: listing.description || '',
          image: listing.images?.[0] || '',
        })
      })
      .catch((e) => setError(e.message))
  }, [id])

  const set = (key: keyof typeof empty, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const payload = {
      title: form.title,
      location: form.location,
      region: form.region || form.location.split(',')[0]?.trim() || form.location,
      district: form.district,
      type: form.type,
      category: form.category,
      status: form.status,
      currency: form.currency,
      price: Number(form.price),
      bedrooms: Number(form.bedrooms),
      baths: Number(form.baths),
      phone: form.phone,
      description: form.description,
      images: form.image ? [form.image, form.image, form.image] : undefined,
    }
    try {
      if (isEdit && id) await api.updateListing(id, payload)
      else await api.createListing(payload)
      navigate('/host')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="portal-page">
      <header className="portal-page-head">
        <div>
          <h1>{isEdit ? 'Edit property' : 'Add a property'}</h1>
          <p>New listings go to admin for approval before they appear publicly.</p>
        </div>
        <Link to="/host" className="btn btn-ghost">
          Cancel
        </Link>
      </header>

      <form className="listing-form" onSubmit={submit}>
        <label>
          Title
          <input
            required
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. 3 bedroom apartment in Ntinda"
          />
        </label>
        <div className="form-grid">
          <label>
            Location
            <input
              required
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="Ntinda, Kampala"
            />
          </label>
          <label>
            Area / region
            <input
              required
              value={form.region}
              onChange={(e) => set('region', e.target.value)}
              placeholder="Ntinda"
            />
          </label>
          <label>
            District
            <input value={form.district} onChange={(e) => set('district', e.target.value)} />
          </label>
          <label>
            Phone
            <input
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+256…"
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Type
            <select value={form.type} onChange={(e) => set('type', e.target.value)}>
              {['Apartment', 'Mansion', 'Storeyed house', 'Bungalow', 'Duplex', 'Land'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select value={form.category} onChange={(e) => set('category', e.target.value)}>
              {['apartment', 'mansion', 'storeyed', 'bungalow', 'duplex', 'land', 'city'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option>For Sale</option>
              <option>For Rent</option>
            </select>
          </label>
          <label>
            Currency
            <select value={form.currency} onChange={(e) => set('currency', e.target.value)}>
              <option>UGX</option>
              <option>USD</option>
            </select>
          </label>
          <label>
            Price
            <input
              required
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
            />
          </label>
          <label>
            Bedrooms
            <input
              type="number"
              min={0}
              value={form.bedrooms}
              onChange={(e) => set('bedrooms', e.target.value)}
            />
          </label>
          <label>
            Baths
            <input
              type="number"
              min={0}
              value={form.baths}
              onChange={(e) => set('baths', e.target.value)}
            />
          </label>
        </div>
        <label>
          Photo URL
          <input
            value={form.image}
            onChange={(e) => set('image', e.target.value)}
            placeholder="https://…"
          />
        </label>
        <label>
          Description
          <textarea
            rows={5}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Tell guests what’s special about this place…"
          />
        </label>
        {error && <p className="portal-error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Submit for approval'}
        </button>
      </form>
    </div>
  )
}
