'use client'

import { useState, useEffect, useCallback } from 'react'

// Fecha + reloj en vivo + clima, para la barra superior del admin.
// Clima: Open-Meteo (gratis, sin key). Ubicación por búsqueda de ciudad o
// geolocalización (con reverse-geocoding para mostrar el nombre real).
// Config y ubicación se guardan en localStorage ('dash_clima').

function weatherEmoji(code: number) {
  if (code === 0) return '☀️'
  if (code <= 2) return '🌤️'
  if (code === 3) return '☁️'
  if (code <= 48) return '🌫️'
  if (code <= 67) return '🌦️'
  if (code <= 77) return '🌨️'
  if (code <= 82) return '🌧️'
  return '⛈️'
}

interface ClimaCfg { tz?: string; lat?: number; lon?: number; label?: string }

// Zona horaria configurada (para que el saludo del dashboard también la use)
export function getClimaTz(): string | undefined {
  try { return (JSON.parse(localStorage.getItem('dash_clima') || 'null') || {}).tz || undefined } catch { return undefined }
}

export default function DateTimeWeather() {
  const [now, setNow] = useState<Date | null>(null)
  const [cfg, setCfg] = useState<ClimaCfg>({})
  const [weather, setWeather] = useState<{ t: number; code: number } | null>(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [zones, setZones] = useState<string[]>([])

  useEffect(() => {
    setNow(new Date())
    const i = setInterval(() => setNow(new Date()), 1000)
    try { setCfg(JSON.parse(localStorage.getItem('dash_clima') || 'null') ?? {}) } catch { /* ignorar */ }
    try { setZones((Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone')) } catch { /* select vacío */ }
    return () => clearInterval(i)
  }, [])

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`)
      const j = await r.json()
      if (j.current) setWeather({ t: Math.round(j.current.temperature_2m), code: j.current.weather_code })
    } catch { /* sin clima */ }
  }, [])

  function save(c: ClimaCfg) { setCfg(c); localStorage.setItem('dash_clima', JSON.stringify(c)) }

  // Reverse geocode → nombre real de la ubicación (sin key, CORS abierto)
  const reverseGeocode = useCallback(async (lat: number, lon: number): Promise<string | undefined> => {
    try {
      const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=es`)
      const j = await r.json()
      return j.city || j.locality || j.principalSubdivision || undefined
    } catch { return undefined }
  }, [])

  useEffect(() => {
    if (cfg.lat != null && cfg.lon != null) {
      fetchWeather(cfg.lat, cfg.lon)
      // si la ubicación guardada no tiene nombre (o quedó "Mi ubicación"), resolverlo
      if (!cfg.label || cfg.label === 'Mi ubicación') {
        reverseGeocode(cfg.lat, cfg.lon).then(name => {
          if (name) save({ ...cfg, label: name })
        })
      }
      return
    }
    navigator.geolocation?.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lon } = pos.coords
      const name = await reverseGeocode(lat, lon)
      save({ ...cfg, lat, lon, label: name })
    }, () => { /* denegado → elegir ciudad con ⚙ */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.lat, cfg.lon, fetchWeather, reverseGeocode])

  async function searchCity() {
    if (!q.trim()) return
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=1&language=es`)
      const j = await r.json()
      const g = j.results?.[0]
      if (g) { save({ ...cfg, lat: g.latitude, lon: g.longitude, label: g.name, tz: cfg.tz || g.timezone }); setQ('') }
    } catch { /* sin resultados */ }
  }

  const tz = cfg.tz || undefined

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <div style={{ fontSize: 13, color: '#555', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
        {now && <span>Hoy es {now.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz })}, {now.toLocaleTimeString('es-CR', { timeZone: tz })}</span>}
        {weather && <span>· {weatherEmoji(weather.code)} {weather.t}°C{cfg.label ? ` ${cfg.label}` : ''}</span>}
        <button onClick={() => setOpen(o => !o)} title="Zona horaria y clima"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#b6bcc6', padding: 0, lineHeight: 1 }}>⚙</button>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, background: '#fff', border: '1px solid #e2e5ea', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.12)', padding: 16, zIndex: 400, width: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9aa1ad', marginBottom: 4 }}>Zona horaria</div>
            <select value={cfg.tz ?? ''} onChange={e => save({ ...cfg, tz: e.target.value || undefined })}
              style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 8, border: '1px solid #e2e5ea', fontFamily: 'inherit' }}>
              <option value="">Automática (del sistema)</option>
              {zones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9aa1ad', marginBottom: 4 }}>Ciudad para el clima</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchCity()}
                placeholder="Ej: San José" style={{ flex: 1, fontSize: 12, padding: '6px 8px', borderRadius: 8, border: '1px solid #e2e5ea', fontFamily: 'inherit', outline: 'none' }} />
              <button onClick={searchCity} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: 'none', background: 'var(--color-primary, #111)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Buscar</button>
            </div>
          </div>
          <button onClick={() => { localStorage.removeItem('dash_clima'); setCfg({}); setWeather(null) }}
            style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e5ea', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>
            📍 Usar mi ubicación actual
          </button>
        </div>
      )}
    </div>
  )
}
