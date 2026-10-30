import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type GeoPlace = {
  name: string
  lat: number
  lng: number
  district: string
  count: number
  approved: number
  pending: number
  forSale: number
  forRent: number
}

type Props = {
  places: GeoPlace[]
  bounds?: { south: number; west: number; north: number; east: number }
}

export function UgandaMap({ places, bounds }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)

    if (bounds) {
      map.fitBounds(
        [
          [bounds.south, bounds.west],
          [bounds.north, bounds.east],
        ],
        { padding: [12, 12] },
      )
    } else {
      map.setView([1.3733, 32.2903], 7)
    }

    mapRef.current = map

    const onResize = () => map.invalidateSize()
    window.addEventListener('resize', onResize)
    // Leaflet needs a tick after layout
    requestAnimationFrame(() => map.invalidateSize())

    return () => {
      window.removeEventListener('resize', onResize)
      map.remove()
      mapRef.current = null
    }
  }, [bounds])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const layer = L.layerGroup().addTo(map)
    const max = Math.max(...places.map((p) => p.count), 1)

    for (const p of places) {
      const radius = 8 + Math.sqrt(p.count / max) * 28
      const marker = L.circleMarker([p.lat, p.lng], {
        radius,
        color: '#003087',
        weight: 2,
        fillColor: p.pending > 0 ? '#E30613' : '#003087',
        fillOpacity: 0.45,
      })
      marker.bindPopup(
        `<strong>${p.name}</strong><br/>${p.district}<br/>` +
          `${p.count.toLocaleString()} homes<br/>` +
          `${p.approved} live · ${p.pending} pending<br/>` +
          `${p.forSale} sale · ${p.forRent} rent`,
      )
      marker.bindTooltip(`${p.name} · ${p.count}`, { direction: 'top', offset: [0, -4] })
      layer.addLayer(marker)
    }

    if (places.length) {
      const latLngs = places.map((p) => L.latLng(p.lat, p.lng))
      // Prefer Greater Kampala cluster if most inventory is there
      const kampalaHeavy =
        places.filter((p) => p.district === 'Kampala' || p.district === 'Wakiso')
          .reduce((s, p) => s + p.count, 0) /
          places.reduce((s, p) => s + p.count, 0) >
        0.7
      if (kampalaHeavy) {
        map.fitBounds(L.latLngBounds(latLngs).pad(0.2), { maxZoom: 11 })
      } else {
        map.fitBounds(L.latLngBounds(latLngs).pad(0.35), { maxZoom: 8 })
      }
    }

    return () => {
      map.removeLayer(layer)
    }
  }, [places])

  return (
    <div className="uganda-map-wrap">
      <div ref={containerRef} className="uganda-map" role="img" aria-label="Map of listings in Uganda" />
      <p className="uganda-map-hint">
        Circle size = homes in that area. Red tint = pending reviews. Click a marker for details.
      </p>
    </div>
  )
}
