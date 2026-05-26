'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { Property } from '@/types'

interface Props { id: string }

function fmtFull(price: number, currency: string): string {
  if (!price) return 'Precio a consultar'
  if (currency === 'CRC') return '₡' + Number(price).toLocaleString('es-CR')
  return '$' + Number(price).toLocaleString('en-US')
}

export default function PropertyDetailClient({ id }: Props) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  // Lightbox
  const [lbOpen, setLbOpen] = useState(false)
  const [lbIdx, setLbIdx] = useState(0)
  const rightRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/properties/${id}`)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.json() })
      .then((data: Property) => { setProperty(data); setLoading(false) })
      .catch(() => {
        // fallback: fetch all and find
        fetch('/api/properties')
          .then(r => r.json())
          .then((data: Property[]) => {
            const found = data.find(p => p.id === id)
            if (found) setProperty(found)
            else setNotFound(true)
            setLoading(false)
          })
          .catch(() => { setNotFound(true); setLoading(false) })
      })
  }, [id])

  // Keyboard lightbox nav
  useEffect(() => {
    if (!lbOpen || !property) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLbOpen(false)
      if (e.key === 'ArrowRight') setLbIdx(i => Math.min(i + 1, property.images.length - 1))
      if (e.key === 'ArrowLeft') setLbIdx(i => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lbOpen, property])

  if (loading) {
    return (
      <div style={{ paddingTop: 'var(--nav-h,68px)', minHeight: '100vh', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="map-loading-ring" />
      </div>
    )
  }

  if (notFound || !property) {
    return (
      <div style={{ paddingTop: 'var(--nav-h,68px)', minHeight: '100vh', background: '#f5f5f7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ fontSize: 48 }}>🏠</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#333' }}>Propiedad no encontrada</div>
        <button onClick={() => router.push('/listings')} style={{ background: '#222', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
          Ver todas las propiedades
        </button>
      </div>
    )
  }

  const p = property
  const imgs = p.images.length > 0 ? p.images : ['https://via.placeholder.com/1200x800/e2e2e8/8a8a9a?text=Sin+imagen']
  const location = [p.city, p.country].filter(Boolean).join(', ')
  const address = p.address ?? ''
  const whatsappMsg = encodeURIComponent(`Hola, me interesa la propiedad: ${p.title}`)
  const whatsappUrl = p.agent_phone
    ? `https://wa.me/${p.agent_phone.replace(/\D/g, '')}?text=${whatsappMsg}`
    : null

  const openLb = (i: number) => { setLbIdx(i); setLbOpen(true) }

  return (
    <>
      {/* ── Split-screen / stacked container ── */}
      <div style={isMobile ? {
        paddingTop: 'var(--nav-h, 56px)',
        minHeight: '100vh',
        background: '#fff',
      } : {
        position: 'fixed',
        top: 'var(--nav-h, 68px)',
        left: 0, right: 0, bottom: 0,
        display: 'grid',
        gridTemplateColumns: '58% 42%',
      }}>

        {/* ══ LEFT — stacked photos ══ */}
        <div className={isMobile ? '' : 'det-left'}>
          {/* Mobile: show only first photo unless tapping for more */}
          {(isMobile ? imgs.slice(0, 1) : imgs).map((img, i) => (
            <div
              key={i}
              className={isMobile ? '' : 'det-photo'}
              onClick={() => openLb(i)}
              style={{ width: '100%', aspectRatio: isMobile ? '4/3' : (i === 0 ? '16/10' : '16/9'), position: 'relative', overflow: 'hidden', cursor: 'pointer', background: '#e5e5e5' }}
            >
              <img src={img} alt={`${p.title} ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {isMobile && imgs.length > 1 && (
                <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 12, padding: '4px 12px', borderRadius: 20, backdropFilter: 'blur(4px)' }}>
                  📷 {imgs.length} fotos
                </div>
              )}
              {!isMobile && <div className="det-photo-zoom">⤢</div>}
            </div>
          ))}
          {!isMobile && <div style={{ height: 40 }} />}
        </div>

        {/* ══ RIGHT — info panel ══ */}
        <div ref={rightRef} className={isMobile ? '' : 'det-right'} style={isMobile ? { background: '#fff' } : undefined}>

          {/* Back button */}
          <div style={{ padding: isMobile ? '16px 16px 0' : '20px 28px 0', flexShrink: 0 }}>
            <button
              onClick={() => router.back()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: '#999', padding: 0, fontFamily: 'inherit',
                letterSpacing: '.02em',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Volver
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: isMobile ? '16px 16px 60px' : '16px 28px 40px', flex: 1 }}>

            {/* Type tag */}
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent, #f5a623)', marginBottom: 8 }}>
              {p.type ?? ''}
              {p.transaction === 'rent'
                ? <span style={{ marginLeft: 8, color: '#bbb' }}>· Alquiler</span>
                : <span style={{ marginLeft: 8, color: '#bbb' }}>· Venta</span>
              }
            </div>

            {/* Title */}
            <h1 style={{ fontFamily: 'var(--font-heading, "Playfair Display", serif)', fontSize: 'clamp(22px, 2.5vw, 30px)', fontWeight: 700, color: '#1e1e2a', lineHeight: 1.25, margin: '0 0 12px' }}>
              {p.title}
            </h1>

            {/* Location */}
            {(location || address) && (
              <div style={{ fontSize: 13, color: '#8a8a9a', marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
                {[address, location].filter(Boolean).join(' · ')}
              </div>
            )}

            {/* Price */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 'clamp(26px, 3vw, 34px)', fontWeight: 700, color: '#1e1e2a', letterSpacing: '-.02em', lineHeight: 1 }}>
                {fmtFull(p.price, p.currency)}
              </div>
              <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>
                {p.currency}{p.transaction === 'rent' ? ' / mes' : ' · precio de venta'}
              </div>
            </div>

            {/* Stats */}
            {(p.bedrooms != null || p.bathrooms != null || p.area_m2 != null) && (
              <div style={{
                display: 'flex', gap: 0,
                border: '1px solid #f0f0f0', borderRadius: 10,
                overflow: 'hidden', marginBottom: 24,
              }}>
                {p.bedrooms != null && (
                  <div style={{ flex: 1, padding: '14px 0', textAlign: 'center', borderRight: p.bathrooms != null || p.area_m2 != null ? '1px solid #f0f0f0' : 'none' }}>
                    <div style={{ fontSize: 18, marginBottom: 2 }}>🛏</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#1e1e2a' }}>{p.bedrooms}</div>
                    <div style={{ fontSize: 10, color: '#bbb', letterSpacing: '.05em', textTransform: 'uppercase' }}>Hab.</div>
                  </div>
                )}
                {p.bathrooms != null && (
                  <div style={{ flex: 1, padding: '14px 0', textAlign: 'center', borderRight: p.area_m2 != null ? '1px solid #f0f0f0' : 'none' }}>
                    <div style={{ fontSize: 18, marginBottom: 2 }}>🚿</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#1e1e2a' }}>{p.bathrooms}</div>
                    <div style={{ fontSize: 10, color: '#bbb', letterSpacing: '.05em', textTransform: 'uppercase' }}>Baños</div>
                  </div>
                )}
                {p.area_m2 != null && (
                  <div style={{ flex: 1, padding: '14px 0', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, marginBottom: 2 }}>📐</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#1e1e2a' }}>{p.area_m2}</div>
                    <div style={{ fontSize: 10, color: '#bbb', letterSpacing: '.05em', textTransform: 'uppercase' }}>m²</div>
                  </div>
                )}
              </div>
            )}

            {/* CTA buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: '#25D366', color: '#fff', borderRadius: 8,
                    padding: '13px 16px', textDecoration: 'none',
                    fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Consultar por WhatsApp
                </a>
              )}
              {p.agent_email && (
                <a
                  href={`mailto:${p.agent_email}?subject=Consulta: ${encodeURIComponent(p.title)}&body=${whatsappMsg}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: '#fff', color: '#333', borderRadius: 8,
                    padding: '12px 16px', textDecoration: 'none',
                    fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                    border: '1px solid #e5e5e5',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  Enviar correo
                </a>
              )}
            </div>

            {/* Description */}
            {p.description && (
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#1e1e2a', marginBottom: 10 }}>
                  Descripción
                </h2>
                <p style={{ fontSize: 14, color: '#555', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap' }}>
                  {p.description}
                </p>
              </div>
            )}

            {/* Agent card */}
            {p.agent_name && (
              <div style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent,#f5a623), var(--primary,#6b2fa0))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  👤
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#bbb', marginBottom: 3 }}>Agente</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1e1e2a' }}>{p.agent_name}</div>
                  {p.agent_phone && <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{p.agent_phone}</div>}
                  {p.agent_email && <div style={{ fontSize: 12, color: '#999' }}>{p.agent_email}</div>}
                </div>
              </div>
            )}

            {/* Map preview (if lat/lng available) */}
            {p.lat && p.lng && (
              <div style={{ marginTop: 24 }}>
                <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#1e1e2a', marginBottom: 10 }}>
                  Ubicación
                </h2>
                <a
                  href={`https://www.google.com/maps?q=${p.lat},${p.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'block', borderRadius: 10, overflow: 'hidden', position: 'relative' }}
                >
                  <img
                    src={`https://api.mapbox.com/styles/v1/mapbox/light-v11/static/pin-s+f5a623(${p.lng},${p.lat})/${p.lng},${p.lat},13,0/480x220@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''}`}
                    alt="Mapa"
                    style={{ width: '100%', display: 'block' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 11, padding: '4px 10px', borderRadius: 20, backdropFilter: 'blur(4px)' }}>
                    Ver en Google Maps ↗
                  </div>
                </a>
              </div>
            )}

          </div>{/* /content */}
        </div>{/* /right */}
      </div>{/* /split */}

      {/* ── Lightbox ── */}
      <div className={`lightbox${lbOpen ? ' open' : ''}`} onClick={() => setLbOpen(false)}>
        <button className="lb-close" onClick={() => setLbOpen(false)}>✕</button>
        {imgs.length > 1 && (
          <>
            <button
              className="lb-prev"
              onClick={e => { e.stopPropagation(); setLbIdx(i => Math.max(i - 1, 0)) }}
            >‹</button>
            <button
              className="lb-next"
              onClick={e => { e.stopPropagation(); setLbIdx(i => Math.min(i + 1, imgs.length - 1)) }}
            >›</button>
          </>
        )}
        <img
          src={imgs[lbIdx]}
          alt=""
          onClick={e => e.stopPropagation()}
        />
        {imgs.length > 1 && (
          <div className="lb-counter">{lbIdx + 1} / {imgs.length}</div>
        )}
      </div>
    </>
  )
}
