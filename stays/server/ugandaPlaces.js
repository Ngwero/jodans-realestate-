/** Shared place centers for API geo aggregation (mirror of frontend lookup). */
export const UGANDA_PLACES = {
  Kampala: { lat: 0.3476, lng: 32.5825, district: 'Kampala' },
  Entebbe: { lat: 0.0512, lng: 32.4637, district: 'Wakiso' },
  Jinja: { lat: 0.4478, lng: 33.2026, district: 'Jinja' },
  Mukono: { lat: 0.3533, lng: 32.7553, district: 'Mukono' },
  Wakiso: { lat: 0.4043, lng: 32.4597, district: 'Wakiso' },
  Mbarara: { lat: -0.6072, lng: 30.6545, district: 'Mbarara' },
  Gulu: { lat: 2.7746, lng: 32.299, district: 'Gulu' },
  Mbale: { lat: 1.082, lng: 34.175, district: 'Mbale' },
  Masaka: { lat: -0.3411, lng: 31.7361, district: 'Masaka' },
  'Fort Portal': { lat: 0.671, lng: 30.275, district: 'Kabarole' },
  Lira: { lat: 2.249, lng: 32.8998, district: 'Lira' },
  Arua: { lat: 3.0201, lng: 30.9111, district: 'Arua' },
  Hoima: { lat: 1.4356, lng: 31.3436, district: 'Hoima' },
  Soroti: { lat: 1.7145, lng: 33.6111, district: 'Soroti' },
  Kira: { lat: 0.3975, lng: 32.639, district: 'Wakiso' },
  Ntinda: { lat: 0.3515, lng: 32.6205, district: 'Kampala' },
  Bukoto: { lat: 0.3488, lng: 32.6015, district: 'Kampala' },
  Kisaasi: { lat: 0.3705, lng: 32.605, district: 'Kampala' },
  Namugongo: { lat: 0.385, lng: 32.665, district: 'Wakiso' },
  Naalya: { lat: 0.377, lng: 32.635, district: 'Wakiso' },
  Matugga: { lat: 0.45, lng: 32.52, district: 'Wakiso' },
  Kyanja: { lat: 0.39, lng: 32.605, district: 'Kampala' },
  Kitende: { lat: 0.22, lng: 32.52, district: 'Wakiso' },
  Kololo: { lat: 0.3305, lng: 32.592, district: 'Kampala' },
  Bweyogerere: { lat: 0.365, lng: 32.66, district: 'Wakiso' },
  Muyenga: { lat: 0.295, lng: 32.61, district: 'Kampala' },
  Naguru: { lat: 0.34, lng: 32.605, district: 'Kampala' },
  Bwebajja: { lat: 0.215, lng: 32.5, district: 'Wakiso' },
  Kawanda: { lat: 0.42, lng: 32.54, district: 'Wakiso' },
  Kungu: { lat: 0.41, lng: 32.55, district: 'Wakiso' },
  Kansanga: { lat: 0.29, lng: 32.605, district: 'Kampala' },
  Kiwaatule: { lat: 0.37, lng: 32.63, district: 'Kampala' },
  Kireka: { lat: 0.355, lng: 32.65, district: 'Wakiso' },
  Najjera: { lat: 0.38, lng: 32.62, district: 'Wakiso' },
  Lubowa: { lat: 0.24, lng: 32.55, district: 'Wakiso' },
  Seeta: { lat: 0.365, lng: 32.72, district: 'Mukono' },
  Nansana: { lat: 0.375, lng: 32.52, district: 'Wakiso' },
  Gayaza: { lat: 0.45, lng: 32.6, district: 'Wakiso' },
  Makerere: { lat: 0.335, lng: 32.57, district: 'Kampala' },
  Kawempe: { lat: 0.38, lng: 32.56, district: 'Kampala' },
  Makindye: { lat: 0.29, lng: 32.58, district: 'Kampala' },
  Rubaga: { lat: 0.3, lng: 32.55, district: 'Kampala' },
  Nakawa: { lat: 0.335, lng: 32.62, district: 'Kampala' },
  Mbuya: { lat: 0.325, lng: 32.62, district: 'Kampala' },
  Bunga: { lat: 0.27, lng: 32.62, district: 'Kampala' },
  Kisugu: { lat: 0.3, lng: 32.61, district: 'Kampala' },
  Bugolobi: { lat: 0.315, lng: 32.61, district: 'Kampala' },
  Munyonyo: { lat: 0.24, lng: 32.625, district: 'Kampala' },
  Ggaba: { lat: 0.255, lng: 32.63, district: 'Kampala' },
  Kajjansi: { lat: 0.21, lng: 32.54, district: 'Wakiso' },
  Busega: { lat: 0.32, lng: 32.52, district: 'Kampala' },
  Nateete: { lat: 0.3, lng: 32.53, district: 'Kampala' },
  Wandegeya: { lat: 0.335, lng: 32.575, district: 'Kampala' },
  Kamwokya: { lat: 0.345, lng: 32.59, district: 'Kampala' },
  Mulago: { lat: 0.34, lng: 32.575, district: 'Kampala' },
}

const PLACE_KEYS = Object.keys(UGANDA_PLACES).sort((a, b) => b.length - a.length)
const BAD = new Set(['perfect', 'a', 'your', 'ideal', 'the', 'unknown', ''])

export function resolvePlace(listing) {
  const hay = [listing.region, listing.location, listing.district, listing.title]
    .filter(Boolean)
    .join(' ')
  for (const key of PLACE_KEYS) {
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (re.test(hay)) {
      return { name: key, ...UGANDA_PLACES[key] }
    }
  }
  const d = String(listing.district || '').trim()
  if (d && !BAD.has(d.toLowerCase()) && UGANDA_PLACES[d]) {
    return { name: d, ...UGANDA_PLACES[d] }
  }
  return { name: 'Kampala', ...UGANDA_PLACES.Kampala }
}
