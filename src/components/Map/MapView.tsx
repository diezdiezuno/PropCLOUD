'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useFilters, useFilteredProperties } from '@/contexts/FilterContext'
import { useLang, locProp, useUI } from '@/contexts/LanguageContext'
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

function fmtShort(price: number, currency: string): string {
  const sym = currency === 'CRC' ? '₡' : '$'
  if (currency === 'CRC') {
    if (price >= 1e9) return sym + (price / 1e9).toFixed(1).replace('.0', '') + 'B'
    if (price >= 1e6) return sym + Math.round(price / 1e6) + 'M'
    return sym + Math.round(price / 1000) + 'K'
  }
  if (price >= 1e6) return sym + (price / 1e6).toFixed(1).replace('.0', '') + 'M'
  if (price >= 1000) return sym + Math.round(price / 1000) + 'K'
  return sym + price.toLocaleString()
}

function fmtFull(price: number, currency: string): string {
  if (!price) return 'Precio a consultar'
  if (currency === 'CRC') return '₡' + Number(price).toLocaleString('es-CR')
  return '$' + Number(price).toLocaleString('en-US')
}

export default function MapView({ mapStyle, mapboxToken, mapCenter, mapZoom }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const allPropsRef = useRef<Property[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [count, setCount] = useState<number | null>(null)
  const f = useFilters()
  const { lang } = useLang()
  const t = useUI()
  const langRef = useRef(lang)
  langRef.current = lang

  // All properties from API
  const [allProperties, setAllProperties] = useState<Property[]>([])
  const filtered = useFilteredProperties(allProperties)

  const updateMarkers = useCallback((props: Property[], map: any) => {
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const bounds = map.getBounds()
    let visibleCount = 0

    props.forEach(p => {
      if (!p.lat || !p.lng) return
      if (bounds.contains([p.lng, p.lat])) visibleCount++

      const label = fmtShort(p.price, p.currency)
      const loc = p.city?.split(',')[0].trim() ?? ''

      const pinEl = document.createElement('div')
      pinEl.className = 'map-pin'
      pinEl.innerHTML = `<div class="mp-price">${label}</div>${loc ? `<div class="mp-loc">${loc}</div>` : ''}`

      const lp = locProp(p, langRef.current)
      const viewLabel = langRef.current === 'en' ? 'View property →' : 'Ver propiedad →'
      const popupHtml = `
        <div class="map-popup">
          ${p.images[0] ? `<img src="${p.images[0]}" alt="">` : ''}
          <div class="mp-body">
            <div class="mp-type">${lp.type ?? ''}</div>
            <div class="mp-title">${lp.title}</div>
            <div class="mp-loc-popup">📍 ${[p.city, p.country].filter(Boolean).join(', ')}</div>
            <div class="mp-price-popup">${fmtFull(p.price, p.currency)}</div>
            <button class="mp-btn" onclick="window.open('/listings/${p.id}','_blank','noopener')">${viewLabel}</button>
          </div>
        </div>`

      const mapboxgl = (window as any).mapboxgl
      const popup = new mapboxgl.Popup({ maxWidth: '240px', offset: 10 }).setHTML(popupHtml)
      const marker = new mapboxgl.Marker({ element: pinEl, anchor: 'center' })
        .setLngLat([p.lng, p.lat])
        .setPopup(popup)
        .addTo(map)
      markersRef.current.push(marker)
    })

    setCount(visibleCount)
  }, [])

  // Update markers when filter changes
  useEffect(() => {
    if (!mapRef.current || status !== 'ready') return
    updateMarkers(filtered, mapRef.current)
  }, [filtered, status, updateMarkers])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    if (!mapboxToken) { setErrorMsg('Mapbox token missing'); setStatus('error'); return }

    let map: any;

    (async () => {
      try {
        const mapboxgl = (await import('mapbox-gl')).default
        ;(window as any).mapboxgl = mapboxgl
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

        // Register zone fly-to handlers for Nav zone pills
        f.registerMapFlyTo(([lng, lat, zoom]) => {
          map?.flyTo({ center: [lng, lat], zoom, duration: 800 })
        })
        f.registerMapFitZone((zone) => {
          const props = allPropsRef.current.filter(p => {
            const loc = [p.city, p.country, p.address].filter(Boolean).join(' ').toLowerCase()
            return loc.includes(zone.toLowerCase()) && p.lat && p.lng
          })
          if (props.length) {
            const lats = props.map(p => p.lat!)
            const lngs = props.map(p => p.lng!)
            map?.fitBounds(
              [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
              { padding: 80, maxZoom: 14, duration: 800 }
            )
          }
        })

        map.on('load', async () => {
          try { map.setConfigProperty('basemap', 'lightPreset', getMapLightPreset()) } catch {}
          setStatus('ready')

          // Load properties
          try {
            const res = await fetch('/api/properties')
            if (res.ok) {
              const props: Property[] = await res.json()
              setAllProperties(props)
              allPropsRef.current = props
              updateMarkers(props, map)
            }
          } catch (e) {
            console.error('[MapView] error loading properties:', e)
          }
        })

        // Update count on pan/zoom
        map.on('moveend', () => {
          if (!mapRef.current) return
          const bounds = mapRef.current.getBounds()
          const visible = markersRef.current.filter(m => bounds.contains(m.getLngLat())).length
          setCount(visible)
        })

        map.on('error', (e: any) => {
          setErrorMsg(e?.error?.message ?? 'Map error')
          setStatus('error')
        })
      } catch (e: any) {
        setErrorMsg(e?.message ?? 'Failed to load map')
        setStatus('error')
      }
    })()

    return () => {
      map?.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
    {/* In-flow container — same height as viewport minus nav; footer sits naturally below */}
    <div style={{ marginTop: 'var(--nav-h, 68px)', height: 'calc(100vh - var(--nav-h, 68px))', position: 'relative' }}>
      <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Property count overlay */}
      {status === 'ready' && count !== null && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.45)', color: '#fff', padding: '7px 16px',
          borderRadius: 24, fontSize: 13, fontWeight: 500, zIndex: 400,
          pointerEvents: 'none', whiteSpace: 'nowrap', backdropFilter: 'blur(4px)',
        }}>
          {count} {t.propertiesInArea}
        </div>
      )}

      {/* Loading */}
      {status === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(248,248,248,0.96)', zIndex: 500, backdropFilter: 'blur(6px)',
          transition: 'opacity .5s',
        }}>
          <div className="map-loading-ring" />
          <p style={{ fontSize: 14, color: '#8a8a9a', fontWeight: 500, letterSpacing: '0.02em' }}>
            {t.loadingProperties}
          </p>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: '#fff', zIndex: 10,
        }}>
          <p style={{ color: '#e00', fontSize: 14 }}>Error: {errorMsg}</p>
        </div>
      )}
    </div>
    </>
  )
}
