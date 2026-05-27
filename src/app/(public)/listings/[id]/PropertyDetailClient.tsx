'use client'

import { useEffect, useState, useRef } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { Property } from '@/types'

interface Props {
  id: string
  contactMode?: 'agent' | 'office'
  officeWhatsapp?: string | null
  officeEmail?: string | null
  mapboxToken?: string
}

function fmtFull(price: number, currency: string): string {
  if (!price) return 'Precio a consultar'
  if (currency === 'CRC') return '₡' + Number(price).toLocaleString('es-CR')
  return '$' + Number(price).toLocaleString('en-US')
}

export default function PropertyDetailClient({
  id, contactMode = 'agent', officeWhatsapp, officeEmail, mapboxToken,
}: Props) {
  const isMobile = useIsMobile()
  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [lbOpen, setLbOpen] = useState(false)
  const [lbIdx, setLbIdx] = useState(0)
  const [toast, setToast] = useState('')
  // Contact form
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formMsg, setFormMsg] = useState('')
  const [formSent, setFormSent] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/properties/${id}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then((data: Property) => { setProperty(data); setLoading(false) })
      .catch(() => {
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

  useEffect(() => {
    if (!lbOpen || !property) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLbOpen(false)
      if (e.key === 'ArrowRight') setLbIdx(i => Math.min(i + 1, property.images.length - 1))
      if (e.key === 'ArrowLeft') setLbIdx(i => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [lbOpen, property])

  // Listen for events fired by the detail nav buttons (Share / Contactar)
  useEffect(() => {
    const onShare = () => shareProperty()
    const onScroll = () => scrollToForm()
    window.addEventListener('det-share', onShare)
    window.addEventListener('det-scroll-form', onScroll)
    return () => {
      window.removeEventListener('det-share', onShare)
      window.removeEventListener('det-scroll-form', onScroll)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  function shareProperty() {
    if (navigator.share) {
      navigator.share({ title: property?.title ?? '', url: window.location.href }).catch(() => {})
    } else {
      navigator.clipboard?.writeText(window.location.href)
      showToast('✓ Enlace copiado')
    }
  }

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function submitInquiry() {
    if (!formName.trim() || !formEmail.trim()) {
      showToast('Por favor completá nombre y correo.')
      return
    }
    // Build WhatsApp URL if available
    const phone = contactMode === 'office' ? officeWhatsapp : property?.agent_phone
    if (phone) {
      const msg = encodeURIComponent(
        `Hola, me interesa esta propiedad: ${property?.title}\n\nNombre: ${formName}\nCorreo: ${formEmail}${formPhone ? `\nTel: ${formPhone}` : ''}${formMsg ? `\n\n${formMsg}` : ''}`
      )
      window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${msg}`, '_blank')
    }
    setFormSent(true)
    showToast(`✓ Consulta enviada sobre: ${property?.title}`)
  }

  if (loading) {
    return (
      <div style={{ paddingTop: 'var(--nav-h,60px)', minHeight: '100vh', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="map-loading-ring" />
      </div>
    )
  }

  if (notFound || !property) {
    return (
      <div style={{ paddingTop: 'var(--nav-h,60px)', minHeight: '100vh', background: '#f5f5f7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ fontSize: 48 }}>🏠</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#333' }}>Propiedad no encontrada</div>
        <a href="/listings" style={{ background: '#222', color: '#fff', borderRadius: 10, padding: '10px 22px', fontSize: 14, textDecoration: 'none', fontFamily: 'inherit' }}>
          Ver todas las propiedades
        </a>
      </div>
    )
  }

  const p = property
  const imgs = p.images.length > 0 ? p.images : ['https://via.placeholder.com/1200x800/e2e2e8/8a8a9a?text=Sin+imagen']
  const loc = [p.city, p.country].filter(Boolean).join(', ')
  const type = p.type ?? 'Propiedad'
  const tagLabel = [type, loc].filter(Boolean).join(' · ')
  const contactPhone = contactMode === 'office' ? officeWhatsapp : p.agent_phone
  // Display info: when office mode show office/tenant name, else show agent
  const displayName    = contactMode === 'office'
    ? 'Oficina'
    : (p.agent_name ?? '')
  const displaySub     = contactMode === 'office'
    ? (officeEmail ?? officeWhatsapp ?? '')
    : (p.agent_email ?? p.agent_phone ?? 'RE/MAX')
  const displayInitial = displayName.trim() ? displayName.trim()[0].toUpperCase() : '?'
  const ctaLabel       = contactMode === 'office' ? 'Contactar oficina →' : 'Contactar agente →'
  const token = mapboxToken ?? (process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '')

  return (
    <>
      {/* ── Split-screen container ── */}
      <div style={isMobile ? {
        paddingTop: 'var(--nav-h,60px)',
        minHeight: '100vh',
        background: '#fff',
      } : {
        position: 'fixed',
        top: 'var(--nav-h,60px)',
        left: 0, right: 0, bottom: 0,
        display: 'grid',
        gridTemplateColumns: '58% 42%',
      }}>

        {/* ══ LEFT — stacked photos ══ */}
        <div className={isMobile ? '' : 'det-left'}>
          {(isMobile ? imgs.slice(0, 1) : imgs).map((src, i) => (
            <div
              key={i}
              className={isMobile ? '' : `det-photo ${i === 0 ? 'det-photo-main' : 'det-photo-rest'}`}
              onClick={() => { setLbIdx(i); setLbOpen(true) }}
              style={{
                width: '100%',
                height: isMobile ? undefined : (i === 0 ? '75vh' : '55vh'),
                aspectRatio: isMobile ? '4/3' : undefined,
                position: 'relative', overflow: 'hidden', cursor: 'pointer', background: '#e5e5e5',
              }}
            >
              <img src={src} alt="" loading={i === 0 ? 'eager' : 'lazy'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {i === 0 && imgs.length > 1 && (
                <div style={{ position: 'absolute', bottom: 16, right: 16, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: 11, fontWeight: 500, padding: '5px 12px', borderRadius: 20 }}>
                  {imgs.length} fotos
                </div>
              )}
              {!isMobile && <div className="det-photo-zoom">⤢</div>}
            </div>
          ))}
          {isMobile && imgs.length > 1 && (
            <div style={{ display: 'flex', gap: 4, padding: '8px 12px', overflowX: 'auto' }}>
              {imgs.map((src, i) => (
                <img key={i} src={src} alt="" onClick={() => { setLbIdx(i); setLbOpen(true) }}
                  style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0, cursor: 'pointer', border: lbIdx === i ? '2px solid #111' : '2px solid transparent' }} />
              ))}
            </div>
          )}
        </div>

        {/* ══ RIGHT — info panel ══ */}
        <div className={isMobile ? '' : 'det-right'} style={isMobile ? { background: '#fff' } : undefined}>
          <div style={{ padding: isMobile ? '24px 20px 60px' : '36px 36px 48px', display: 'flex', flexDirection: 'column', gap: 0, minHeight: '100%' }}>

            {/* Type · Location */}
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: '#aaa', marginBottom: 10 }}>
              {tagLabel}
            </div>

            {/* Title */}
            <h1 style={{ fontFamily: 'var(--font-heading,"Playfair Display",serif)', fontSize: 'clamp(22px,2.5vw,26px)', lineHeight: 1.25, margin: '0 0 10px', color: '#111', fontWeight: 700 }}>
              {p.title}
            </h1>

            {/* Price */}
            <div style={{ fontSize: 'clamp(26px,3vw,30px)', fontWeight: 700, color: '#111', marginBottom: 20, letterSpacing: '-.01em' }}>
              {fmtFull(p.price, p.currency)}
              {p.transaction === 'rent' && <span style={{ fontSize: 14, fontWeight: 400, color: '#aaa', marginLeft: 8 }}>/mes</span>}
            </div>

            {/* Action row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button onClick={shareProperty} style={actionBtn}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Compartir
              </button>
              <button onClick={scrollToForm} style={{ ...actionBtn, background: '#111', color: '#fff', borderColor: '#111' }}>
                Contactar agente →
              </button>
            </div>

            <Divider />

            {/* Stats — 2-col grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              {p.bedrooms != null && <Stat value={p.bedrooms} label="Habitaciones" />}
              {p.bathrooms != null && <Stat value={p.bathrooms} label="Baños" />}
              {p.area_m2 != null && <Stat value={`${p.area_m2} m²`} label="Construcción" />}
              {p.lot_m2 != null && <Stat value={`${p.lot_m2} m²`} label="Lote" />}
            </div>

            <Divider />

            {/* Description */}
            {p.description && (
              <>
                <SectionLabel>Descripción</SectionLabel>
                <p style={{ fontSize: 13, lineHeight: 1.75, color: '#666', margin: '0 0 18px', whiteSpace: 'pre-line' }}>
                  {p.description}
                </p>
                <Divider />
              </>
            )}

            {/* Location map */}
            {p.lat && p.lng && token && (
              <>
                <SectionLabel>Ubicación</SectionLabel>
                <a
                  href={`https://maps.google.com/?q=${p.lat},${p.lng}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}
                >
                  <img
                    src={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+6b2fa0(${p.lng},${p.lat})/${p.lng},${p.lat},14/800x300@2x?access_token=${token}`}
                    alt="Mapa de ubicación"
                    style={{ width: '100%', display: 'block' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </a>
                <a href={`https://maps.google.com/?q=${p.lat},${p.lng}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#e8531a', fontSize: 11, textDecoration: 'none', marginBottom: 18 }}>
                  🗺 Ver en Google Maps →
                </a>
                <Divider />
              </>
            )}

            {/* Agent + contact form sidebar — margin-top:auto pushes to bottom when content is short */}
            <div ref={formRef} style={{ background: '#f9f9f9', borderRadius: 10, padding: 22, border: '1px solid #eee', marginTop: 'auto' }}>
              {/* Agent / Office */}
              {displayName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #eee' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent,#f5a623),var(--primary,#6b2fa0))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
                    {displayInitial}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{displayName}</div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>{displaySub}</div>
                  </div>
                </div>
              )}

              {/* Form */}
              {formSent ? (
                <div style={{ textAlign: 'center', padding: '16px 0', color: '#38a169', fontSize: 14, fontWeight: 600 }}>
                  ✓ Consulta enviada. Te contactaremos pronto.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 14 }}>Solicitar información</div>
                  <input className="det-inp" type="text" placeholder="Nombre completo" value={formName} onChange={e => setFormName(e.target.value)} />
                  <input className="det-inp" type="email" placeholder="Correo electrónico" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
                  <input className="det-inp" type="tel" placeholder="WhatsApp" value={formPhone} onChange={e => setFormPhone(e.target.value)} />
                  <textarea className="det-inp" rows={3} placeholder="Me interesa esta propiedad..." value={formMsg} onChange={e => setFormMsg(e.target.value)} style={{ resize: 'none' }} />
                  <button onClick={submitInquiry} className="det-submit">
                    {contactPhone ? ctaLabel : 'Enviar consulta →'}
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lbOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 50000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setLbOpen(false)}>
          <button onClick={() => setLbOpen(false)} style={lbBtn}>✕</button>
          {imgs.length > 1 && <>
            <button onClick={e => { e.stopPropagation(); setLbIdx(i => Math.max(i - 1, 0)) }} style={{ ...lbBtn, position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)' }}>‹</button>
            <button onClick={e => { e.stopPropagation(); setLbIdx(i => Math.min(i + 1, imgs.length - 1)) }} style={{ ...lbBtn, position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)' }}>›</button>
          </>}
          <img src={imgs[lbIdx]} alt="" onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 4 }} />
          {imgs.length > 1 && (
            <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,.5)', color: '#fff', fontSize: 12, padding: '4px 14px', borderRadius: 20 }}>
              {lbIdx + 1} / {imgs.length}
            </div>
          )}
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 22px', borderRadius: 24, fontSize: 13, fontWeight: 500, zIndex: 60000, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ height: 1, background: '#f0f0f0', margin: '18px 0' }} />
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: '#aaa', marginBottom: 10 }}>{children}</div>
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ padding: 14, background: '#f8f8f8', borderRadius: 8 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#111', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#aaa', marginTop: 4 }}>{label}</div>
    </div>
  )
}

const actionBtn: React.CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '10px 14px', borderRadius: 8, fontFamily: 'inherit', fontSize: 13,
  fontWeight: 500, cursor: 'pointer', border: '1.5px solid #e0e0e0',
  background: '#fff', color: '#555', transition: 'all .2s',
}

const lbBtn: React.CSSProperties = {
  position: 'absolute', top: 20, right: 20,
  background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff',
  fontSize: 20, width: 44, height: 44, borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', backdropFilter: 'blur(4px)',
}
