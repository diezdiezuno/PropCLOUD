'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { track } from '@/lib/gtag'
import { createClient } from '@/lib/supabase-browser'
import { getCantons, getDistricts } from '@/data/cr-divisions'
import type mapboxgl from 'mapbox-gl'

/* ─── Constants ────────────────────────────────────────────── */

const BENEFITS = [
  {
    id: 'market',
    icon: '📊',
    title: 'Valuación precisa de mercado',
    desc: 'Analizamos propiedades comparables y tendencias actuales para fijar el precio correcto desde el primer día.',
  },
  {
    id: 'network',
    icon: '🌐',
    title: 'Red internacional REMAX',
    desc: 'Tu propiedad se expone a miles de compradores activos a nivel nacional e internacional.',
  },
  {
    id: 'marketing',
    icon: '📸',
    title: 'Marketing profesional',
    desc: 'Fotografía, video y publicidad digital que destacan los atributos únicos de tu propiedad.',
  },
  {
    id: 'legal',
    icon: '📋',
    title: 'Gestión legal sin complicaciones',
    desc: 'Acompañamiento en escrituras, trámites notariales y toda la parte legal de la transacción.',
  },
]

const STEPS = [
  { num: '01', title: 'Contanos sobre tu propiedad', desc: 'Completá el formulario con los datos básicos. Un agente te contactará en menos de 24 horas.' },
  { num: '02', title: 'Valuación y estrategia', desc: 'Visitamos la propiedad, analizamos el mercado y definimos juntos el precio y el plan de venta.' },
  { num: '03', title: 'Publicación y compradores', desc: 'Publicamos en los mejores portales y activamos nuestra red de compradores activos.' },
  { num: '04', title: 'Cierre exitoso', desc: 'Negociamos en tu nombre y coordinamos todos los trámites hasta la firma de escritura.' },
]

const TIMELINE_OPTIONS = [
  { value: 'Ya', label: 'Lo antes posible', icon: '🔥' },
  { value: '3-6 meses', label: '3 a 6 meses', icon: '📅' },
  { value: '6-12 meses', label: '6 a 12 meses', icon: '🗓️' },
  { value: 'Más de 1 año', label: 'Más de 1 año', icon: '⏳' },
]

const PROVINCIAS = ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón']

/* ─── Component ────────────────────────────────────────────── */

export default function ListarClientSunrise() {
  // Contact fields
  const [nombre,    setNombre]    = useState('')
  const [email,     setEmail]     = useState('')
  const [telefono,  setTelefono]  = useState('')

  // Property fields
  const [provincia,   setProvincia]   = useState('')
  const [canton,      setCanton]      = useState('')
  const [distrito,    setDistrito]    = useState('')
  const [address,     setAddress]     = useState('')
  const [finca,       setFinca]       = useState('')
  const [plano,       setPlano]       = useState('')
  const [planoPdf,    setPlanoPdf]    = useState<File | null>(null)
  const [price,       setPrice]       = useState('')
  const [area,        setArea]        = useState('')
  const [bedrooms,    setBedrooms]    = useState('')
  const [bathrooms,   setBathrooms]   = useState('')
  const [timeline,    setTimeline]    = useState('')
  const [description, setDescription] = useState('')

  // Map state
  const [mapLng,  setMapLng]  = useState<number | null>(null)
  const [mapLat,  setMapLat]  = useState<number | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)

  // Cascading dropdowns
  const cantons  = provincia ? getCantons(provincia)  : []
  const districts = (provincia && canton) ? getDistricts(provincia, canton) : []

  function handleProvinciaChange(v: string) {
    setProvincia(v)
    setCanton('')
    setDistrito('')
  }
  function handleCantonChange(v: string) {
    setCanton(v)
    setDistrito('')
  }

  // UI state
  const [sending,  setSending]  = useState(false)
  const [sent,     setSent]     = useState(false)
  const [error,    setError]    = useState('')
  const [hoveredBenefit, setHoveredBenefit] = useState<string | null>(null)

  // File input ref
  const planoInputRef = useRef<HTMLInputElement>(null)

  // Mapbox refs
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  const canSubmit = nombre.trim() && email.trim() && telefono.trim() && provincia && canton && timeline

  /* ── Mapbox init ─────────────────────────────────────────── */
  useEffect(() => {
    if (!mapContainerRef.current) return
    if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return

    let map: mapboxgl.Map
    let marker: mapboxgl.Marker

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      import('mapbox-gl/dist/mapbox-gl.css').catch(() => {})
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

      map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-84.0, 9.93],
        zoom: 10,
      })

      map.addControl(new mapboxgl.NavigationControl(), 'top-right')

      // Click to place marker
      map.on('click', (e) => {
        const { lng, lat } = e.lngLat
        if (marker) {
          marker.setLngLat([lng, lat])
        } else {
          marker = new mapboxgl.Marker({ color: '#6b2fa0', draggable: true })
            .setLngLat([lng, lat])
            .addTo(map)
          markerRef.current = marker
          marker.on('dragend', () => {
            const pos = marker.getLngLat()
            setMapLng(Math.round(pos.lng * 1e6) / 1e6)
            setMapLat(Math.round(pos.lat * 1e6) / 1e6)
          })
        }
        markerRef.current = marker
        setMapLng(Math.round(lng * 1e6) / 1e6)
        setMapLat(Math.round(lat * 1e6) / 1e6)
      })

      mapRef.current = map
    })

    return () => {
      if (map) map.remove()
    }
  }, [])

  /* ── Geolocation ─────────────────────────────────────────── */
  const flyToLocation = useCallback((lng: number, lat: number) => {
    if (!mapRef.current) return
    import('mapbox-gl').then(({ default: mapboxgl }) => {
      mapRef.current!.flyTo({ center: [lng, lat], zoom: 17, duration: 1200 })
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat])
      } else {
        const marker = new mapboxgl.Marker({ color: '#6b2fa0', draggable: true })
          .setLngLat([lng, lat])
          .addTo(mapRef.current!)
        markerRef.current = marker
        marker.on('dragend', () => {
          const pos = marker.getLngLat()
          setMapLng(Math.round(pos.lng * 1e6) / 1e6)
          setMapLat(Math.round(pos.lat * 1e6) / 1e6)
        })
      }
      setMapLng(Math.round(lng * 1e6) / 1e6)
      setMapLat(Math.round(lat * 1e6) / 1e6)
    })
  }, [])

  function useMyLocation() {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        flyToLocation(pos.coords.longitude, pos.coords.latitude)
        setGeoLoading(false)
      },
      () => setGeoLoading(false),
      { timeout: 8000 }
    )
  }

  /* ── Submit ──────────────────────────────────────────────── */
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSending(true)
    setError('')
    track('contact_form_submit', { source: 'listar' })

    try {
      // Upload plano PDF if provided
      let planoUrl = ''
      if (planoPdf) {
        const supabase = createClient()
        const ext = planoPdf.name.split('.').pop()
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('planos-uploads')
          .upload(path, planoPdf, { upsert: false })
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('planos-uploads').getPublicUrl(path)
          planoUrl = urlData.publicUrl
        }
      }

      // Build metadata
      const metadata: Record<string, string> = {}
      if (provincia)   metadata.provincia   = provincia
      if (canton)      metadata.canton      = canton
      if (distrito)    metadata.distrito    = distrito
      if (address)     metadata.address     = address
      if (finca)       metadata.finca       = finca
      if (plano)       metadata.plano       = plano
      if (planoUrl)    metadata.plano_url   = planoUrl
      if (price)       metadata.price       = price
      if (area)        metadata.area        = area
      if (bedrooms)    metadata.bedrooms    = bedrooms
      if (bathrooms)   metadata.bathrooms   = bathrooms
      if (timeline)    metadata.timeline    = timeline
      if (description) metadata.description = description
      if (mapLng !== null && mapLat !== null) {
        metadata.coordinates = `${mapLat}, ${mapLng}`
      }

      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nombre,
          email,
          phone: telefono,
          message: null,
          source: 'listar',
          listar_metadata: metadata,
        }),
      })

      // WhatsApp message
      const lines = [
        `Nombre: ${nombre}`,
        `Email: ${email}`,
        `Teléfono: ${telefono}`,
        provincia && `Provincia: ${provincia}`,
        canton    && `Cantón: ${canton}`,
        distrito  && `Distrito: ${distrito}`,
        address   && `Dirección: ${address}`,
        finca     && `N° de finca: ${finca}`,
        plano     && `N° de plano: ${plano}`,
        price     && `Precio: ${price}`,
        area      && `Área construida: ${area} m²`,
        bedrooms  && `Habitaciones: ${bedrooms}`,
        bathrooms && `Baños: ${bathrooms}`,
        timeline  && `¿Cuándo vender? ${timeline}`,
        description && `Descripción: ${description}`,
        mapLat !== null && `Coordenadas: ${mapLat}, ${mapLng}`,
      ].filter(Boolean).join('\n')

      const waMsg = encodeURIComponent(`Hola, quiero vender mi propiedad con SUNRISE | REMAX Central.\n\n${lines}`)
      window.open(`https://wa.me/50688887777?text=${waMsg}`, '_blank')

      setSent(true)
    } catch {
      setError('Hubo un error al enviar. Por favor intentá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  /* ── Success screen ──────────────────────────────────────── */
  if (sent) {
    return (
      <div style={{
        paddingTop: 'var(--nav-h,68px)', minHeight: '100vh',
        background: 'linear-gradient(135deg,#f5f0fa 0%,#faf5eb 50%,#f0f5fa 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center', padding: 40, maxWidth: 480 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏠</div>
          <h2 style={{
            fontFamily: 'var(--font-heading,serif)',
            fontSize: 28, fontWeight: 700, color: '#111', marginBottom: 12,
          }}>¡Solicitud enviada!</h2>
          <p style={{ fontSize: 15, color: '#666', lineHeight: 1.7, margin: '0 0 8px' }}>
            Te contactaremos en las próximas 24 horas para coordinar una visita y presentarte nuestra estrategia.
          </p>
          <p style={{ fontSize: 13, color: '#aaa' }}>Revisá tu WhatsApp — te abrimos una conversación para seguir en contacto.</p>
        </div>
      </div>
    )
  }

  /* ── Main render ─────────────────────────────────────────── */
  return (
    <div style={{ paddingTop: 'var(--nav-h,68px)', fontFamily: 'var(--font-body,system-ui,sans-serif)' }}>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', textAlign: 'center',
        padding: 'clamp(36px,4vw,56px) clamp(24px,3vw,48px) clamp(44px,5vw,68px)',
        maxWidth: 1440, margin: '0 auto',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 500, letterSpacing: '.16em',
          textTransform: 'uppercase', color: 'var(--primary,#6b2fa0)',
          marginBottom: 18,
        }}>
          SUNRISE | REMAX Central
        </div>

        <h1 style={{
          fontFamily: 'var(--font-heading,serif)',
          fontSize: 'clamp(48px,7vw,88px)',
          fontWeight: 900, lineHeight: .93,
          letterSpacing: '-.03em', marginBottom: 28, maxWidth: 900,
        }}>
          Vendé tu propiedad{' '}
          <span style={{
            background: 'linear-gradient(90deg,var(--primary,#6b2fa0),#D44E2A,#E8920A)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>con los expertos.</span>
        </h1>

        <p style={{
          fontSize: 'clamp(16px,1.8vw,20px)', fontWeight: 300,
          color: '#888480', maxWidth: 680, lineHeight: 1.65, marginBottom: 44,
        }}>
          Más de 30 agentes especializados en el mercado del Gran Área Metropolitana.
          Precio justo, exposición máxima y cierre seguro.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 64 }}>
          <a href="#formulario" style={{
            background: '#111', color: '#fff', fontSize: 15, fontWeight: 500,
            padding: '16px 36px', borderRadius: 100, textDecoration: 'none', display: 'inline-block',
          }}>Listar mi propiedad</a>
          <a href="#proceso" style={{
            background: 'transparent', color: '#111', fontSize: 15, fontWeight: 400,
            padding: '16px 36px', borderRadius: 100, border: '1.5px solid #e8e4df',
            textDecoration: 'none', display: 'inline-block',
          }}>¿Cómo funciona?</a>
        </div>

        <div style={{ display: 'flex', gap: 64, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { num: '+500',  label: 'Propiedades vendidas' },
            { num: '#1',    label: 'Oficina en el GAM' },
            { num: '24h',   label: 'Respuesta garantizada' },
          ].map(({ num, label }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: 'var(--font-heading,serif)',
                fontSize: 44, fontWeight: 700, lineHeight: 1,
                letterSpacing: '-.02em', color: '#111',
              }}>{num}</div>
              <div style={{ fontSize: 12, color: '#888480', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 6 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BENEFICIOS ──────────────────────────────────────── */}
      <section style={{
        padding: 'clamp(44px,5vw,68px) clamp(24px,3vw,48px)',
        maxWidth: 1440, margin: '0 auto',
        borderTop: '1px solid #e8e4df',
      }}>
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--primary,#6b2fa0)', marginBottom: 14, textAlign: 'center' }}>
          Por qué elegirnos
        </p>
        <h2 style={{
          fontFamily: 'var(--font-heading,serif)',
          fontSize: 'clamp(28px,3.5vw,46px)', fontWeight: 700,
          lineHeight: 1.1, letterSpacing: '-.02em',
          marginBottom: 52, textAlign: 'center',
        }}>
          Vendé con confianza y respaldo profesional.
        </h2>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2,1fr)',
          gap: 1, background: '#e8e4df',
          border: '1px solid #e8e4df', borderRadius: 20, overflow: 'hidden',
        }}>
          {BENEFITS.map(({ id, icon, title, desc }) => {
            const isHov = hoveredBenefit === id
            return (
              <div
                key={id}
                onMouseEnter={() => setHoveredBenefit(id)}
                onMouseLeave={() => setHoveredBenefit(null)}
                style={{
                  background: isHov ? '#111' : '#fff',
                  padding: 'clamp(28px,3vw,44px)',
                  transition: 'background .2s',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 16 }}>{icon}</div>
                <div style={{
                  fontFamily: 'var(--font-heading,serif)',
                  fontSize: 20, fontWeight: 700, lineHeight: 1.25,
                  color: isHov ? '#fff' : '#111', marginBottom: 10, transition: 'color .2s',
                }}>{title}</div>
                <div style={{
                  fontSize: 14, lineHeight: 1.65,
                  color: isHov ? 'rgba(255,255,255,.7)' : '#666', transition: 'color .2s',
                }}>{desc}</div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── PROCESO ─────────────────────────────────────────── */}
      <section id="proceso" style={{
        padding: 'clamp(44px,5vw,68px) clamp(24px,3vw,48px)',
        maxWidth: 1440, margin: '0 auto',
        borderTop: '1px solid #e8e4df',
      }}>
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--primary,#6b2fa0)', marginBottom: 14, textAlign: 'center' }}>
          Proceso de venta
        </p>
        <h2 style={{
          fontFamily: 'var(--font-heading,serif)',
          fontSize: 'clamp(28px,3.5vw,46px)', fontWeight: 700,
          lineHeight: 1.1, letterSpacing: '-.02em',
          marginBottom: 52, textAlign: 'center',
        }}>
          De la consulta al cierre, paso a paso.
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
          gap: 2, background: '#e8e4df',
          border: '1px solid #e8e4df', borderRadius: 20, overflow: 'hidden',
        }}>
          {STEPS.map(({ num, title, desc }) => (
            <div key={num} style={{ background: '#fff', padding: 'clamp(24px,2.5vw,36px)' }}>
              <div style={{
                fontFamily: 'var(--font-heading,serif)',
                fontSize: 40, fontWeight: 900, lineHeight: 1,
                color: '#e8e4df', marginBottom: 16, letterSpacing: '-.02em',
              }}>{num}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 8, lineHeight: 1.3 }}>{title}</div>
              <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FORMULARIO ──────────────────────────────────────── */}
      <section id="formulario" style={{
        padding: 'clamp(44px,5vw,68px) clamp(24px,3vw,48px) 80px',
        maxWidth: 1440, margin: '0 auto',
        borderTop: '1px solid #e8e4df',
      }}>
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--primary,#6b2fa0)', marginBottom: 14, textAlign: 'center' }}>
          Empezá ahora
        </p>
        <h2 style={{
          fontFamily: 'var(--font-heading,serif)',
          fontSize: 'clamp(28px,3.5vw,46px)', fontWeight: 700,
          lineHeight: 1.1, letterSpacing: '-.02em',
          marginBottom: 8, textAlign: 'center',
        }}>
          Contanos sobre tu propiedad.
        </h2>
        <p style={{ textAlign: 'center', color: '#888', fontSize: 15, marginBottom: 52, lineHeight: 1.6 }}>
          Completá el formulario y un agente de SUNRISE te contactará en menos de 24 horas.
        </p>

        <form
          onSubmit={submit}
          style={{
            background: 'linear-gradient(135deg,#f5f0fa 0%,#faf5eb 50%,#f0f5fa 100%)',
            borderRadius: 20, padding: 'clamp(28px,4vw,52px)',
            border: '1px solid #e8e4df',
            maxWidth: 900, margin: '0 auto',
            display: 'flex', flexDirection: 'column', gap: 32,
          }}
        >

          {/* Tus datos */}
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <SectionLabel>Tus datos</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
              <Inp label="Nombre completo *" value={nombre} onChange={setNombre} placeholder="Tu nombre" />
              <Inp label="Email *" value={email} onChange={setEmail} placeholder="tu@email.com" type="email" />
              <Inp label="Teléfono *" value={telefono} onChange={setTelefono} placeholder="+506 8888-8888" type="tel" />
            </div>
          </fieldset>

          {/* Ubicación */}
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <SectionLabel>Ubicación de la propiedad</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }}>

              {/* Provincia */}
              <div>
                <label style={labelSt}>Provincia *</label>
                <select
                  value={provincia}
                  onChange={e => handleProvinciaChange(e.target.value)}
                  style={inpSt}
                >
                  <option value="">Seleccionar…</option>
                  {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* Cantón */}
              <div>
                <label style={labelSt}>Cantón *</label>
                <select
                  value={canton}
                  onChange={e => handleCantonChange(e.target.value)}
                  disabled={!provincia}
                  style={{ ...inpSt, opacity: !provincia ? 0.5 : 1 }}
                >
                  <option value="">Seleccionar…</option>
                  {cantons.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              {/* Distrito */}
              <div>
                <label style={labelSt}>Distrito</label>
                <select
                  value={distrito}
                  onChange={e => setDistrito(e.target.value)}
                  disabled={!canton}
                  style={{ ...inpSt, opacity: !canton ? 0.5 : 1 }}
                >
                  <option value="">Seleccionar…</option>
                  {districts.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <Inp
              label="Dirección / señas exactas"
              value={address}
              onChange={setAddress}
              placeholder="Ej: 200m norte de la iglesia, casa azul con portón negro"
            />
          </fieldset>

          {/* Mapa */}
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <SectionLabel>Ubicación exacta en el mapa (opcional)</SectionLabel>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
              Hacé clic en el mapa para marcar la ubicación exacta de la propiedad, o usá tu ubicación actual.
            </p>
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid #e0e0e0' }}>
              <div ref={mapContainerRef} style={{ height: 340, width: '100%' }} />
              <button
                type="button"
                onClick={useMyLocation}
                disabled={geoLoading}
                style={{
                  position: 'absolute', bottom: 12, left: 12,
                  background: '#fff', border: '1px solid #e0e0e0',
                  borderRadius: 8, padding: '8px 14px',
                  fontSize: 12, fontWeight: 500, cursor: geoLoading ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  boxShadow: '0 2px 8px rgba(0,0,0,.1)',
                  fontFamily: 'inherit',
                }}
              >
                <span>{geoLoading ? '…' : '📍'}</span>
                {geoLoading ? 'Localizando…' : 'Usar mi ubicación'}
              </button>
            </div>
            {mapLat !== null && (
              <p style={{ fontSize: 11, color: '#888', marginTop: 8 }}>
                ✓ Marcador en {mapLat}, {mapLng}
              </p>
            )}
          </fieldset>

          {/* Datos registrales */}
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <SectionLabel>Datos registrales</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Inp label="Número de finca" value={finca} onChange={setFinca} placeholder="Ej: 1-12345-000" />
              <Inp label="Número de plano catastrado" value={plano} onChange={setPlano} placeholder="Ej: SJ-1234567-2010" />
            </div>

            {/* Plano PDF upload */}
            <div style={{ marginTop: 14 }}>
              <label style={labelSt}>Subir plano en PDF (opcional)</label>
              <div
                onClick={() => planoInputRef.current?.click()}
                style={{
                  border: '2px dashed #d0d0d0', borderRadius: 10, padding: '18px 20px',
                  cursor: 'pointer', textAlign: 'center',
                  background: planoPdf ? 'rgba(107,63,160,.04)' : '#fff',
                  transition: 'border-color .2s, background .2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary,#6b2fa0)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#d0d0d0')}
              >
                {planoPdf ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>📄</span>
                    <span style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>{planoPdf.name}</span>
                    <button
                      type="button"
                      onClick={ev => { ev.stopPropagation(); setPlanoPdf(null) }}
                      style={{ fontSize: 11, color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                    >Quitar</button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>📎</div>
                    <div style={{ fontSize: 13, color: '#888' }}>Clic para subir el plano en PDF</div>
                    <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>Máximo 10 MB</div>
                  </div>
                )}
              </div>
              <input
                ref={planoInputRef}
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f && f.size <= 10 * 1024 * 1024) setPlanoPdf(f)
                }}
              />
            </div>
          </fieldset>

          {/* Características */}
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <SectionLabel>Características (opcional)</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
              <Inp label="Área construida (m²)" value={area}      onChange={setArea}      placeholder="120" type="number" />
              <Inp label="Precio estimado"       value={price}     onChange={setPrice}     placeholder="$250,000" />
              <Inp label="Habitaciones"          value={bedrooms}  onChange={setBedrooms}  placeholder="3" type="number" />
              <Inp label="Baños"                 value={bathrooms} onChange={setBathrooms} placeholder="2" type="number" />
            </div>
          </fieldset>

          {/* Timeline */}
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <SectionLabel>¿Cuándo querés vender? *</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {TIMELINE_OPTIONS.map(({ value, label, icon }) => {
                const selected = timeline === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTimeline(value)}
                    style={{
                      padding: '14px 12px',
                      borderRadius: 12,
                      border: selected ? '2px solid var(--primary,#6b2fa0)' : '2px solid #e0e0e0',
                      background: selected ? 'rgba(107,63,160,.06)' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all .15s',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                    <div style={{
                      fontSize: 12, fontWeight: selected ? 600 : 400,
                      color: selected ? 'var(--primary,#6b2fa0)' : '#555',
                      lineHeight: 1.3,
                    }}>{label}</div>
                  </button>
                )
              })}
            </div>
          </fieldset>

          {/* Descripción */}
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <SectionLabel>Descripción adicional (opcional)</SectionLabel>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder="Información adicional sobre la propiedad, estado actual, particularidades…"
              style={{ ...inpSt, resize: 'vertical', lineHeight: 1.6 }}
            />
          </fieldset>

          {/* Error */}
          {error && (
            <p style={{ fontSize: 13, color: '#e53e3e', margin: 0 }}>{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={sending || !canSubmit}
            style={{
              padding: '16px 32px',
              borderRadius: 100,
              background: 'var(--primary,#6b2fa0)',
              color: '#fff',
              border: 'none',
              fontSize: 15,
              fontWeight: 600,
              cursor: (sending || !canSubmit) ? 'not-allowed' : 'pointer',
              opacity: (sending || !canSubmit) ? 0.6 : 1,
              fontFamily: 'inherit',
              transition: 'opacity .15s',
            }}
          >
            {sending ? 'Enviando…' : '📲 Enviar por WhatsApp'}
          </button>
        </form>
      </section>
    </div>
  )
}

/* ─── Helper components ─────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase',
      letterSpacing: '.1em', marginBottom: 14,
    }}>{children}</div>
  )
}

function Inp({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label style={labelSt}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={inpSt}
      />
    </div>
  )
}

const labelSt: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6,
}
const inpSt: React.CSSProperties = {
  width: '100%', border: '1px solid #e0e0e0', borderRadius: 8, padding: '10px 12px',
  fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff',
}
