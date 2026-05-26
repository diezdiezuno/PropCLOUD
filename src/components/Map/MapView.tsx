'use client'

import { useEffect, useRef, useState } from 'react'
import type { Property } from '@/types'

interface MapViewProps {
  mapStyle: string
  mapboxToken: string
}

function getMapLightPreset(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 8) return 'dawn'
  if (h >= 8 && h < 16) return 'day'
  if (h >= 16 && h < 21) return 'dusk'
  return 'night'
}

function fmtPrice(price: number, currency: string): string {
  if (currency === 'CRC') {
    return '₡' + (price >= 1_000_000
      ? (price / 1_000_000).toFixed(price % 1_000_000 === 0 ? 0 : 1) + 'M'
      : (price / 1_000).toFixed(0) + 'K')
  }
  return '$' + (price >= 1_000_000
    ? (price / 1_000_000).toFixed(price % 1_000_000 === 0 ? 0 : 1) + 'M'
    : (price / 1_000).toFixed(0) + 'K')
}

export default function MapView({ mapStyle, mapboxToken }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let map: any

    async function initMap() {
      const mapboxgl = (await import('mapbox-gl')).default

      if (!mapContainerRef.current || mapRef.current) return

      mapboxgl.accessToken = mapboxToken

      map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: mapStyle,
        center: [-84.0, 9.9],
        zoom: 7,
      })

      mapRef.current = map

      map.addControl(new mapboxgl.NavigationControl(), 'top-right')
      map.addControl(new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: false, maximumAge: 60000 },
        trackUserLocation: true,
        showUserHeading: false,
      }), 'top-right')

      map.on('load', async () => {
        try {
          map.setConfigProperty('basemap', 'lightPreset', getMapLightPreset())
        } catch {}

        // Fetch properties
        const res = await fetch('/api/properties')
        if (!res.ok) { setLoading(false); return }
        const properties: Property[] = await res.json()
        setLoading(false)

        // Add markers
        markersRef.current.forEach(m => m.remove())
        markersRef.current = []

        properties.forEach(p => {
          if (!p.lat || !p.lng) return

          const pinEl = document.createElement('div')
          pinEl.className = 'map-pin'
          const loc = p.city?.split(',')[0].trim() ?? ''
          pinEl.innerHTML = `<div class="mp-price">${fmtPrice(p.price, p.currency)}</div>${loc ? `<div class="mp-loc">${loc}</div>` : ''}`

          const popup = new mapboxgl.Popup({ maxWidth: '240px', offset: 10 })
            .setHTML(`
              <div style="font-family:'Outfit',sans-serif;min-width:200px">
                ${p.images[0] ? `<img src="${p.images[0]}" style="width:100%;height:110px;object-fit:cover;display:block" />` : ''}
                <div style="padding:10px 12px 12px">
                  <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#999;margin-bottom:3px">${p.type}</div>
                  <div style="font-size:14px;font-weight:600;color:#111;margin-bottom:4px">${p.title}</div>
                  <div style="font-size:16px;font-weight:700;color:#111">${fmtPrice(p.price, p.currency)}</div>
                </div>
              </div>
            `)

          const marker = new mapboxgl.Marker({ element: pinEl, anchor: 'center' })
            .setLngLat([p.lng, p.lat])
            .setPopup(popup)
            .addTo(map)

          markersRef.current.push(marker)
        })
      })
    }

    initMap()

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [mapStyle, mapboxToken])

  return (
    <div className="relative w-full" style={{ height: 'calc(100vh - 68px)', minHeight: '400px' }}>
      <div ref={mapContainerRef} className="absolute inset-0" />
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 pointer-events-none z-10">
          <div className="w-10 h-10 rounded-full border-2 border-stone-200 border-t-stone-600 animate-spin mb-3" />
          <span className="text-sm text-stone-400">Cargando propiedades...</span>
        </div>
      )}
    </div>
  )
}
