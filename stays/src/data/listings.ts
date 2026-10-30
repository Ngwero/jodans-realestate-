import redScraped from './red-scraped.json'

export type Listing = {
  id: string
  code?: string
  title: string
  location: string
  region: string
  district?: string
  price: number
  currency?: string
  rating: number
  reviews: number
  guests: number
  bedrooms: number
  beds: number
  baths: number
  type: string
  category: string
  host: string
  hostYears: number
  phone?: string
  status?: string
  description: string
  amenities: string[]
  images: string[]
  sourceUrl?: string
  source?: string
  lat: number
  lng: number
}

/** Uganda places & landscapes only — no people stock photos */
export const ugandaImages = {
  kampalaSunset:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Kampala_sunset_20221101.jpg/1920px-Kampala_sunset_20221101.jpg',
  kampalaDay:
    'https://upload.wikimedia.org/wikipedia/commons/4/48/Overcast_weather_on_an_afternoon_in_Kampala_Uganda_01.jpg',
  bunyonyi:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Lake_Bunyonyi_%28%22Place_of_many_little_birds%22%29.jpg/1920px-Lake_Bunyonyi_%28%22Place_of_many_little_birds%22%29.jpg',
  /** Listing exteriors (houses only) */
  kitende:
    'https://www.realestatedatabase.net/PropertyPhotos/589/202609180234322808_NewThumbImage.jpeg',
  ntinda:
    'https://www.realestatedatabase.net/PropertyPhotos/589/202609180134266268_NewThumbImage.jpeg',
  entebbeHome:
    'https://www.realestatedatabase.net/PropertyPhotos/589/202609180107289022_NewThumbImage.jpeg',
  lungujja:
    'https://www.realestatedatabase.net/PropertyPhotos/589/202609181259366727_NewThumbImage.jpeg',
  akright:
    'https://www.realestatedatabase.net/PropertyPhotos/770/202609181226432753_NewThumbImage.jpeg',
  kyanja:
    'https://www.realestatedatabase.net/PropertyPhotos/104/202609181004285172_NewThumbImage.jpeg',
}

export const categories = [
  { id: 'all', label: 'All', icon: '🏠' },
  { id: 'sale', label: 'For sale', icon: '💰' },
  { id: 'rent', label: 'For rent', icon: '🔑' },
  { id: 'mansion', label: 'Mansions', icon: '🏡' },
  { id: 'storeyed', label: 'Storeyed', icon: '🏢' },
  { id: 'apartment', label: 'Apartments', icon: '🏬' },
  { id: 'bungalow', label: 'Bungalows', icon: '🏘️' },
  { id: 'duplex', label: 'Duplexes', icon: '🏗️' },
  { id: 'land', label: 'Land', icon: '🌳' },
  { id: 'kampala', label: 'Kampala', icon: '📍' },
  { id: 'wakiso', label: 'Wakiso', icon: '📍' },
  { id: 'entebbe', label: 'Entebbe', icon: '🌊' },
] as const

export const destinations = [
  {
    name: 'Kampala',
    tagline: 'Capital skyline & city homes',
    image: ugandaImages.kampalaSunset,
  },
  {
    name: 'Ntinda',
    tagline: 'Family mansions & apartments',
    image: ugandaImages.ntinda,
  },
  {
    name: 'Entebbe',
    tagline: 'Homes near the airport',
    image: ugandaImages.entebbeHome,
  },
  {
    name: 'Kitende',
    tagline: 'Storeyed houses on Entebbe Road',
    image: ugandaImages.kitende,
  },
  {
    name: 'Lake Bunyonyi',
    tagline: 'Terraced hills & quiet water',
    image: ugandaImages.bunyonyi,
  },
  {
    name: 'Kyanja',
    tagline: 'New builds & family homes',
    image: ugandaImages.kyanja,
  },
]

/** Listings imported for Jodans Bloka */
function cleanListing(raw: Listing): Listing {
  const host =
    !raw.host || /^RED\s*Agent$/i.test(raw.host) ? 'Local agent' : raw.host.replace(/^RED\s+/i, '')
  const description = (raw.description || '')
    .replace(/\s*[—–-]\s*listed on Real Estate Database \(RED\)\.?/gi, '')
    .replace(/Real Estate Database \(RED\)/gi, '')
    .replace(/\bRED\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || `${raw.title} available on Jodans Bloka.`

  return {
    ...raw,
    host,
    description,
    source: undefined,
  }
}

export const listings: Listing[] = (redScraped as Listing[]).map(cleanListing)

export function formatUgx(amount: number): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatPrice(listing: { price: number; currency?: string }): string {
  if (listing.currency === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(listing.price)
  }
  return formatUgx(listing.price)
}

export function getListing(id: string): Listing | undefined {
  return listings.find((l) => l.id === id)
}

export function isForSale(listing: Listing): boolean {
  return (listing.status || '').toLowerCase().includes('sale')
}
