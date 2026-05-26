'use client'

import { useEffect, useRef, useState } from 'react'
import type { Property } from '@/types'

interface MapViewProps {
  mapStyle: string
  mapboxToken: string
  mapCenter?: [number, number]
  mapZoom?: number
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
      ? (price / 1_000_000).toFixed(1).replace('.0', '') + 'M'
      : (price / 1_000).toFixed(0) + 'K')
  }
  return '$' + (price >= 1_000_000
    ? (price / 1_000_000).toFixed(1).replace('.0', '') + 'M'
    : (price / 1_000).toFixed(0) + 'K')
}

export default function MapView({ mapStyle, mapboxToken, mapCenter, mapZoom }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    if (!mapboxToken) {
      setErrorMsg('Mapbox token missing')
      setStatus('error')
      return
    }

    let map: any

    ;(async () => {
      try {
        const mapboxgl = (await import('mapbox-gl')).default
        mapboxgl.accessToken = mapboxToken

        map = new mapboxgl.Map({
          container: mapContainerRef.current!,
          style: mapStyle,
          center: mapCenter ?? [-84.0, 9.9],
          zoom: mapZoom ?? 7,
        })

        mapRef.current = map

        map.addControl(new mapboxgl.NavigationControl(), 'top-right')
        map.addControl(new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: false, maximumAge: 60000 },
          trackUserLocation: true,
          showUserHeading: false,
        }), 'top-right')

        map.on('load', async () => {
          try { map.setConfigProperty('basemap', 'lightPreset', getMapLightPreset()) } catch {}
          setStatus('ready')

          try {
            const res = await fetch('/api/properties')
            if (!res.ok) return
            const properties: Property[] = await res.json()

            properties.forEach(p => {
              if (!p.lat || !p.lng) return
              const pinEl = document.createElement('div')
              pinEl.className = 'map-pin'
              const loc = p.city?.split(',')[0].trim() ?? ''
              pinEl.innerHTML = `<div class="mp-price">${fmtPrice(p.price, p.currency)}</div>${loc ? `<div class="mp-loc">${loc}</div>` : ''}`

              const popup = new mapboxgl.Popup({ maxWidth: '240px', offset: 10 })
                .setHTML(`
                  <div style="font-family:sans-serif;min-width:200px">
                    ${p.images[0] ? `<img src="${p.images[0]}" style="width:100%;height:110px;object-fit:cover;display:block" />` : ''}
                    <div style="padding:10px 12px 12px">
                      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#999;margin-bottom:3px">${p.type}</div>
                      <div style="font-size:14px;font-weight:600;color:#111;margin-bottom:4px">${p.title}</div>
                      <div style="font-size:16px;font-weight:700;color:#111">${fmtPrice(p.price, p.currency)}</div>
                    </div>
                  </div>
                `)

              new mapboxgl.Marker({ element: pinEl, anchor: 'center' })
                .setLngLat([p.lng, p.lat])
                .setPopup(popup)
                .addTo(map)
            })
          } catch (e) {
            console.error('[MapView] error loading properties:', e)
          }
        })

        map.on('error', (e: any) => {
          console.error('[MapView] map error:', e)
          setErrorMsg(e?.error?.message ?? 'Map error')
          setStatus('error')
        })

      } catch (e: any) {
        console.error('[MapView] init error:', e)
        setErrorMsg(e?.message ?? 'Failed to load map')
        setStatus('error')
      }
    })()

    return () => {
      map?.remove()
      mapRef.current = null
    }
  }, [mapStyle, mapboxToken])

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 68px)', minHeight: '400px' }}>
      <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />

      {status === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.8)', zIndex: 10
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '3px solid #e5e5e5', borderTopColor: '#555',
            animation: 'spin 0.8s linear infinite', marginBottom: 12
          }} />
          <span style={{ fontSize: 14, color: '#888' }}>Cargando mapa...</span>
        </div>
      )}

      {status === 'error' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: '#fff', zIndex: 10
        }}>
          <p style={{ color: '#e00', fontSize: 14 }}>Error: {errorMsg}</p>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
