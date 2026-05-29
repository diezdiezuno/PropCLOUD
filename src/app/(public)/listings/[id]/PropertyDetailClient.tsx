'use client'

import { useEffect, useState, useRef } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useLang, locProp, useUI } from '@/contexts/LanguageContext'
import { track } from '@/lib/gtag'
import type { Property } from '@/types'

interface Props {
  id: string
  layout?: 'A' | 'B' | 'C' | 'D'
  contactMode?: 'agent' | 'office'
  officeWhatsapp?: string | null
  officeEmail?: string | null
  mapboxToken?: string
}

function fmtFull(price: number, currency: string, noPrice: string): string {
  if (!price) return noPrice
  if (currency === 'CRC') return '₡' + Number(price).toLocaleString('es-CR')
  return '$' + Number(price).toLocaleString('en-US')
}

export default function PropertyDetailClient({
  id, layout = 'C', contactMode = 'agent', officeWhatsapp, officeEmail, mapboxToken,
}: Props) {
  const isMobile = useIsMobile()
  const { lang } = useLang()
  const t = useUI()
  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [lbOpen, setLbOpen] = useState(false)
  const [lbIdx, setLbIdx] = useState(0)
  const [toast, setToast] = useState('')
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

  useEffect(() => {
    const onShare = () => shareProperty()
    const onScroll = () => scrollToForm()
    window.addEventListener('det-share', onShare)
    window.addEventListener('det-scroll-form', onScroll)
    return () => { window.removeEventListener('det-share', onShare); window.removeEventListener('det-scroll-form', onScroll) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3500) }
  function shareProperty() {
    if (navigator.share) { navigator.share({ title: property?.title ?? '', url: window.location.href }).catch(() => {}) }
    else { navigator.clipboard?.writeText(window.location.href); showToast(t.linkCopied) }
  }
  function scrollToForm() { formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
  function openWhatsApp() {
    if (!officeWhatsapp) return
    track('whatsapp_click', { property_id: id, property_title: property?.title })
    const msg = encodeURIComponent(`Hola, me interesa esta propiedad: ${property?.title ?? ''}\n${window.location.href}`)
    window.open(`https://wa.me/${officeWhatsapp.replace(/\D/g,'')}?text=${msg}`, '_blank')
  }

  function submitInquiry() {
    if (!formName.trim() || !formEmail.trim()) { showToast(t.fillNameEmail); return }
    track('inquiry_submit', { property_id: id, property_title: property?.title, contact_mode: contactMode })

    // Save lead + send email notification
    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formName, email: formEmail, phone: formPhone,
        message: formMsg, source: 'propiedad',
        property_id: id, property_title: property?.title ?? '',
        property_url: window.location.href,
      }),
    }).catch(() => {})
    setFormSent(true)
    showToast(`${t.contact}: ${property?.title}`)
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
        <div style={{ fontSize: 18, fontWeight: 600, color: '#333' }}>{t.propertyNotFound}</div>
        <a href="/listings" style={{ background: '#222', color: '#fff', borderRadius: 10, padding: '10px 22px', fontSize: 14, textDecoration: 'none', fontFamily: 'inherit' }}>
          {t.viewAllProperties}
        </a>
      </div>
    )
  }

  const p = locProp(property, lang)
  const fmt = (price: number, currency: string) => fmtFull(price, currency, t.priceOnRequest)
  const imgs = p.images.length > 0 ? p.images : ['https://via.placeholder.com/1200x800/e2e2e8/8a8a9a?text=Sin+imagen']
  const loc = [p.city, p.country].filter(Boolean).join(', ')
  const type = p.type ?? 'Propiedad'
  const tagLabel = [type, loc].filter(Boolean).join(' · ')
  const contactPhone = contactMode === 'office' ? officeWhatsapp : p.agent_phone
  const displayName    = contactMode === 'office' ? t.office : (p.agent_name ?? '')
  const displaySub     = contactMode === 'office' ? (officeEmail ?? officeWhatsapp ?? '') : (p.agent_email ?? p.agent_phone ?? 'RE/MAX')
  const displayInitial = displayName.trim() ? displayName.trim()[0].toUpperCase() : '?'
  const ctaLabel       = contactMode === 'office' ? t.contactOffice : t.contactAgent
  const token = mapboxToken ?? (process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '')
  const mapSrc = p.lat && p.lng && token
    ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+6b2fa0(${p.lng},${p.lat})/${p.lng},${p.lat},14/800x300@2x?access_token=${token}`
    : null

  // ── Shared sub-blocks ────────────────────────────────────────────────────────

  const agentCard = contactMode !== 'office' && displayName ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: '#f5f5f5', borderRadius: 8, marginBottom: 16 }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent,#f5a623),var(--primary,#6b2fa0))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
        {displayInitial}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{displayName}</div>
        <div style={{ fontSize: 11, color: '#aaa' }}>{displaySub}</div>
      </div>
    </div>
  ) : null

  const contactForm = (
    <div ref={formRef}>
      {formSent ? (
        <div style={{ textAlign: 'center', padding: '16px 0', color: '#38a169', fontSize: 14, fontWeight: 600 }}>
          {t.inquirySent}
        </div>
      ) : (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 14 }}>{t.requestInfo}</div>
          <input className="det-inp" type="text" placeholder={t.fullName} value={formName} onChange={e => setFormName(e.target.value)} />
          <input className="det-inp" type="email" placeholder={t.email} value={formEmail} onChange={e => setFormEmail(e.target.value)} />
          <input className="det-inp" type="tel" placeholder={t.whatsapp} value={formPhone} onChange={e => setFormPhone(e.target.value)} />
          <textarea className="det-inp" rows={3} placeholder={t.interestedMsg} value={formMsg} onChange={e => setFormMsg(e.target.value)} style={{ resize: 'none' }} />
          <button onClick={submitInquiry} className="det-submit">{contactPhone ? `${ctaLabel} →` : t.sendInquiry}</button>
        </>
      )}
    </div>
  )

  const staticMap = mapSrc ? (
    <a href={`https://maps.google.com/?q=${p.lat},${p.lng}`} target="_blank" rel="noopener noreferrer"
      style={{ display: 'block', borderRadius: 10, overflow: 'hidden', marginBottom: 8, flexShrink: 0 }}>
      <img className="det-map-static" src={mapSrc} alt={t.location} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
    </a>
  ) : null

  const lightbox = lbOpen ? (
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
  ) : null

  const toastEl = toast ? (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 22px', borderRadius: 24, fontSize: 13, fontWeight: 500, zIndex: 60000, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
      {toast}
    </div>
  ) : null

  // ── Mobile layout (shared for all layouts) ───────────────────────────────────

  if (isMobile) {
    return (
      <>
        <div style={{ paddingTop: 'var(--nav-h,60px)', minHeight: '100vh', background: '#fff' }}>
          <div style={{ position: 'relative', aspectRatio: '4/3', background: '#e5e5e5', overflow: 'hidden', cursor: 'pointer' }}
            onClick={() => { setLbIdx(0); setLbOpen(true) }}>
            <img src={imgs[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {imgs.length > 1 && (
              <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: 11, fontWeight: 500, padding: '4px 12px', borderRadius: 20 }}>
                {imgs.length} {t.photos}
              </div>
            )}
          </div>
          {imgs.length > 1 && (
            <div style={{ display: 'flex', gap: 4, padding: '8px 12px', overflowX: 'auto' }}>
              {imgs.map((src, i) => (
                <img key={i} src={src} alt="" onClick={() => { setLbIdx(i); setLbOpen(true) }}
                  style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0, cursor: 'pointer', border: lbIdx === i ? '2px solid #111' : '2px solid transparent' }} />
              ))}
            </div>
          )}
          <div style={{ padding: '24px 20px 60px' }}>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: '#aaa', marginBottom: 8 }}>{tagLabel}</div>
            <h1 style={{ fontFamily: 'var(--font-heading,"Playfair Display",serif)', fontSize: 24, lineHeight: 1.25, margin: '0 0 10px', color: '#111' }}>{p.title}</h1>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#111', marginBottom: 20 }}>
              {fmt(p.price, p.currency)}
              {p.transaction === 'rent' && <span style={{ fontSize: 13, fontWeight: 400, color: '#aaa', marginLeft: 8 }}>{t.perMonth}</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button onClick={shareProperty} style={actionBtn}>{t.share}</button>
              {officeWhatsapp && (
                <button onClick={openWhatsApp} style={{ ...actionBtn, background: '#25D366', color: '#fff', borderColor: '#25D366' }}>
                  <WAIcon /> WhatsApp
                </button>
              )}
              <button onClick={scrollToForm} style={{ ...actionBtn, background: '#111', color: '#fff', borderColor: '#111' }}>{t.contact} →</button>
            </div>
            <Divider />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              {p.bedrooms != null && <Stat value={p.bedrooms} label={t.bedrooms} />}
              {p.bathrooms != null && <Stat value={p.bathrooms} label={t.bathrooms} />}
              {p.area_m2 != null && <Stat value={`${p.area_m2} m²`} label={t.built} />}
              {p.lot_m2 != null && <Stat value={`${p.lot_m2} m²`} label={t.lot} />}
            </div>
            {p.description && (<><Divider /><p style={{ fontSize: 14, lineHeight: 1.75, color: '#666', margin: '0 0 18px', whiteSpace: 'pre-line' }}>{p.description}</p></>)}
            {staticMap && (<><Divider /><SectionLabel>{t.location}</SectionLabel>{staticMap}</>)}
            <Divider />
            <div style={{ background: '#f9f9f9', borderRadius: 10, padding: 20, border: '1px solid #eee' }}>
              {agentCard}
              {contactForm}
            </div>
          </div>
        </div>
        {lightbox}{toastEl}
      </>
    )
  }

  // ── LAYOUT A — Hero overlay + sticky sidebar ──────────────────────────────────

  if (layout === 'A') return (
    <>
      <div style={{ marginTop: 'var(--nav-h,60px)', background: '#fff' }}>
        {/* Hero */}
        <div style={{ height: 460, position: 'relative', overflow: 'hidden' }}>
          <img src={imgs[0]} alt="" onClick={() => { setLbIdx(0); setLbOpen(true) }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer', transition: 'transform .5s' }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.75) 0%, rgba(0,0,0,.1) 50%, transparent 100%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '40px 48px' }}>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>{tagLabel}</div>
            <h1 style={{ fontFamily: 'var(--font-heading,"Playfair Display",serif)', fontSize: 'clamp(28px,3vw,36px)', color: '#fff', lineHeight: 1.2, margin: '0 0 10px' }}>{p.title}</h1>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>
              {fmt(p.price, p.currency)}
              {p.transaction === 'rent' && <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 8, opacity: 0.7 }}>{t.perMonth}</span>}
            </div>
          </div>
          {imgs.length > 1 && (
            <button onClick={() => { setLbIdx(0); setLbOpen(true) }}
              style={{ position: 'absolute', bottom: 44, right: 44, background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.3)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '8px 18px', borderRadius: 24, cursor: 'pointer', fontFamily: 'inherit' }}>
              {t.viewPhotos(imgs.length)}
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px' }}>
          {/* Left */}
          <div style={{ padding: '40px 48px 80px' }}>
            {/* Stats row */}
            <div style={{ display: 'flex', gap: 40, padding: '20px 0', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', marginBottom: 32 }}>
              {p.bedrooms != null && <AHeroStat val={p.bedrooms} lbl={t.bedrooms} />}
              {p.bathrooms != null && <AHeroStat val={p.bathrooms} lbl={t.bathrooms} />}
              {p.area_m2 != null && <AHeroStat val={p.area_m2} lbl={t.builtShort} />}
              {p.lot_m2 != null && <AHeroStat val={p.lot_m2} lbl={t.lotShort} />}
            </div>
            {/* Share row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
              <button onClick={shareProperty} style={actionBtn}>
                <ShareIcon /> {t.share}
              </button>
              {officeWhatsapp && (
                <button onClick={openWhatsApp} style={{ ...actionBtn, background: '#25D366', color: '#fff', borderColor: '#25D366' }}>
                  <WAIcon /> WhatsApp
                </button>
              )}
              <button onClick={scrollToForm} style={{ ...actionBtn, background: '#111', color: '#fff', borderColor: '#111' }}>
                {ctaLabel} →
              </button>
            </div>
            {/* Description */}
            {p.description && <p style={{ fontSize: 14, lineHeight: 1.85, color: '#555', marginBottom: 32, whiteSpace: 'pre-line' }}>{p.description}</p>}
            {/* Gallery thumbnails */}
            {imgs.length > 1 && (
              <>
                <SectionLabel>{t.gallery}</SectionLabel>
                <div style={{ display: 'flex', gap: 6, height: 160, marginBottom: 32, borderRadius: 8, overflow: 'hidden' }}>
                  <div onClick={() => { setLbIdx(0); setLbOpen(true) }}
                    style={{ flex: 2, overflow: 'hidden', borderRadius: 6, cursor: 'pointer', background: '#e5e5e5' }}>
                    <img src={imgs[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {imgs.slice(1, 3).map((src, i) => (
                      <div key={i} onClick={() => { setLbIdx(i + 1); setLbOpen(true) }}
                        style={{ flex: 1, overflow: 'hidden', borderRadius: 6, cursor: 'pointer', background: '#e5e5e5', position: 'relative' }}>
                        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {i === 1 && imgs.length > 3 && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 600 }}>
                            +{imgs.length - 3}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            {/* Map */}
            {staticMap && (
              <>
                <SectionLabel>{t.location}</SectionLabel>
                {staticMap}
                <a href={`https://maps.google.com/?q=${p.lat},${p.lng}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--primary,#6b2fa0)', fontSize: 11, textDecoration: 'none', marginBottom: 28 }}>
                  {t.viewOnGoogleMaps}
                </a>
              </>
            )}
          </div>

          {/* Right — sticky sidebar */}
          <div style={{ padding: '32px 32px 32px 0', position: 'sticky', top: 'var(--nav-h,60px)', alignSelf: 'start', maxHeight: 'calc(100vh - var(--nav-h,60px))', overflowY: 'auto' }}>
            {agentCard}
            <div style={{ background: '#f9f9f9', border: '1px solid #eee', borderRadius: 10, padding: 22 }}>
              {contactForm}
            </div>
          </div>
        </div>
      </div>
      {lightbox}{toastEl}
    </>
  )

  // ── LAYOUT B — Editorial vertical ────────────────────────────────────────────

  if (layout === 'B') return (
    <>
      <div style={{ marginTop: 'var(--nav-h,60px)', background: '#fff' }}>
        {/* Hero */}
        <div style={{ height: 500, position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
          onClick={() => { setLbIdx(0); setLbOpen(true) }}>
          <img src={imgs[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .5s' }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} />
          {imgs.length > 1 && (
            <div style={{ position: 'absolute', bottom: 20, right: 24, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: 11, fontWeight: 500, padding: '5px 12px', borderRadius: 20 }}>
              {imgs.length} {t.photos}
            </div>
          )}
        </div>

        {/* Editorial content */}
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 32px 80px' }}>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.18em', textTransform: 'uppercase', color: '#aaa', marginBottom: 12 }}>{tagLabel}</div>
          <h1 style={{ fontFamily: 'var(--font-heading,"Playfair Display",serif)', fontSize: 'clamp(28px,4vw,38px)', lineHeight: 1.2, color: '#111', margin: '0 0 12px' }}>{p.title}</h1>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#111', marginBottom: 24, letterSpacing: '-.01em' }}>
            {fmt(p.price, p.currency)}
            {p.transaction === 'rent' && <span style={{ fontSize: 14, fontWeight: 400, color: '#aaa', marginLeft: 10 }}>{t.perMonth}</span>}
          </div>

          {/* Action row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
            <button onClick={shareProperty} style={actionBtn}><ShareIcon /> {t.share}</button>
            {officeWhatsapp && (
              <button onClick={openWhatsApp} style={{ ...actionBtn, background: '#25D366', color: '#fff', borderColor: '#25D366' }}>
                <WAIcon /> WhatsApp
              </button>
            )}
            <button onClick={scrollToForm} style={{ ...actionBtn, background: '#111', color: '#fff', borderColor: '#111' }}>{ctaLabel} →</button>
          </div>

          {/* Stat pills */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
            {p.bedrooms != null && <BPill label={t.bedroomsLower} value={p.bedrooms} />}
            {p.bathrooms != null && <BPill label={t.bathroomsLower} value={p.bathrooms} />}
            {p.area_m2 != null && <BPill label={t.builtLower} value={p.area_m2} />}
            {p.lot_m2 != null && <BPill label={t.lotLower} value={p.lot_m2} />}
          </div>

          {/* Description */}
          {p.description && (
            <>
              <Divider />
              <p style={{ fontSize: 15, lineHeight: 1.85, color: '#555', margin: '24px 0 32px', fontWeight: 300, whiteSpace: 'pre-line' }}>{p.description}</p>
            </>
          )}

          {/* Gallery horizontal scroll */}
          {imgs.length > 1 && (
            <>
              <SectionLabel>{t.gallery}</SectionLabel>
              <div style={{ display: 'flex', gap: 10, height: 200, overflowX: 'auto', marginBottom: 36, paddingBottom: 4, scrollbarWidth: 'thin' }}>
                {imgs.map((src, i) => (
                  <div key={i} onClick={() => { setLbIdx(i); setLbOpen(true) }}
                    style={{ flexShrink: 0, width: 280, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: '#e5e5e5' }}>
                    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .4s' }}
                      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Map */}
          {staticMap && (
            <>
              <Divider />
              <SectionLabel>{t.location}</SectionLabel>
              <div style={{ marginBottom: 8 }}>{staticMap}</div>
              <a href={`https://maps.google.com/?q=${p.lat},${p.lng}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--primary,#6b2fa0)', fontSize: 11, textDecoration: 'none', marginBottom: 36 }}>
                {t.viewOnGoogleMaps}
              </a>
            </>
          )}

          {/* Contact form */}
          <Divider />
          <div style={{ background: '#f9f9f9', border: '1px solid #eee', borderRadius: 12, padding: 32 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 4 }}>{t.interestedTitle}</div>
            <div style={{ fontSize: 13, color: '#aaa', marginBottom: 20 }}>{t.agentContact24h}</div>
            {agentCard}
            {contactForm}
          </div>
        </div>
      </div>
      {lightbox}{toastEl}
    </>
  )

  // ── LAYOUT D — Immersive sections ─────────────────────────────────────────────

  if (layout === 'D') return (
    <>
      <div style={{ marginTop: 'var(--nav-h,60px)', background: '#fff' }}>
        {/* Hero section */}
        <div style={{ height: 520, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <img src={imgs[0]} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
            onClick={() => { setLbIdx(0); setLbOpen(true) }} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.38)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '32px 48px', maxWidth: 700 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)', marginBottom: 16 }}>{tagLabel}</div>
            <h1 style={{ fontFamily: 'var(--font-heading,"Playfair Display",serif)', fontSize: 'clamp(32px,5vw,48px)', color: '#fff', lineHeight: 1.15, margin: '0 0 14px' }}>{p.title}</h1>
            <div style={{ fontSize: 'clamp(24px,3vw,34px)', fontWeight: 300, color: '#fff', letterSpacing: '.02em' }}>
              {fmt(p.price, p.currency)}
              {p.transaction === 'rent' && <span style={{ fontSize: 14, marginLeft: 10, opacity: 0.7 }}>{t.perMonth}</span>}
            </div>
          </div>
          <div style={{ position: 'absolute', bottom: 24, right: 24, display: 'flex', gap: 8 }}>
            <button onClick={shareProperty}
              style={{ background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.3)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '8px 18px', borderRadius: 24, cursor: 'pointer', fontFamily: 'inherit' }}>
              {t.share}
            </button>
            {officeWhatsapp && (
              <button onClick={openWhatsApp}
                style={{ background: '#25D366', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, padding: '8px 18px', borderRadius: 24, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                <WAIcon /> WhatsApp
              </button>
            )}
            <button onClick={scrollToForm}
              style={{ background: 'rgba(255,255,255,.9)', border: 'none', color: '#111', fontSize: 12, fontWeight: 600, padding: '8px 18px', borderRadius: 24, cursor: 'pointer', fontFamily: 'inherit' }}>
              {ctaLabel} →
            </button>
          </div>
          {imgs.length > 1 && (
            <button onClick={() => { setLbIdx(0); setLbOpen(true) }}
              style={{ position: 'absolute', bottom: 24, left: 24, background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', fontSize: 11, fontWeight: 500, padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit' }}>
              {imgs.length} {t.photos}
            </button>
          )}
        </div>

        {/* Stats section */}
        {(p.bedrooms != null || p.bathrooms != null || p.area_m2 != null || p.lot_m2 != null) && (
          <div style={{ padding: '56px 48px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 0, flexWrap: 'wrap' }}>
              {p.bedrooms != null && <DStatItem val={p.bedrooms} lbl={t.bedrooms} />}
              {p.bathrooms != null && <DStatItem val={p.bathrooms} lbl={t.bathrooms} />}
              {p.area_m2 != null && <DStatItem val={p.area_m2} lbl={t.builtShort} />}
              {p.lot_m2 != null && <DStatItem val={p.lot_m2} lbl={t.lotShort} />}
            </div>
          </div>
        )}

        {/* Description section */}
        {p.description && (
          <div style={{ maxWidth: 660, margin: '0 auto', padding: '56px 32px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ fontFamily: 'var(--font-heading,"Playfair Display",serif)', fontSize: 22, fontStyle: 'italic', color: '#888', marginBottom: 20 }}>
              {t.propertyQuote}
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.9, color: '#666', fontWeight: 300, whiteSpace: 'pre-line', margin: 0 }}>{p.description}</p>
          </div>
        )}

        {/* Filmstrip gallery */}
        {imgs.length > 1 && (
          <div style={{ padding: '40px 0', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
            <div style={{ display: 'flex', gap: 8, padding: '0 48px', overflowX: 'auto', scrollbarWidth: 'thin' }}>
              {imgs.map((src, i) => (
                <div key={i} onClick={() => { setLbIdx(i); setLbOpen(true) }}
                  style={{ flexShrink: 0, height: 180, width: 280, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', background: '#e5e5e5' }}>
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .4s' }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Map section */}
        {staticMap && (
          <div style={{ borderBottom: '1px solid #f0f0f0' }}>
            <a href={`https://maps.google.com/?q=${p.lat},${p.lng}`} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', height: 280, overflow: 'hidden' }}>
              <img src={mapSrc!} alt={t.location}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={e => { (e.target as HTMLImageElement).closest('a')!.style.display = 'none' }} />
            </a>
          </div>
        )}

        {/* Contact form section */}
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '56px 32px 80px' }}>
          <div style={{ fontFamily: 'var(--font-heading,"Playfair Display",serif)', fontSize: 26, textAlign: 'center', marginBottom: 6, color: '#111' }}>
            {t.interestedTitle}
          </div>
          <div style={{ fontSize: 13, color: '#aaa', textAlign: 'center', marginBottom: 28 }}>{t.agentContact24h}</div>
          {agentCard}
          <div style={{ background: '#f9f9f9', border: '1px solid #eee', borderRadius: 12, padding: 28 }}>
            {contactForm}
          </div>
        </div>
      </div>
      {lightbox}{toastEl}
    </>
  )

  // ── LAYOUT C — Split screen (default) ─────────────────────────────────────────

  return (
    <>
      <div style={isMobile ? {
        paddingTop: 'var(--nav-h,60px)',
        minHeight: '100vh',
        background: '#fff',
      } : {
        marginTop: 'var(--nav-h,60px)',
        height: 'calc(100vh - var(--nav-h,60px))',
        display: 'grid',
        gridTemplateColumns: '58% 42%',
      }}>
        {/* Left — stacked photos */}
        <div className="det-left">
          {imgs.map((src, i) => (
            <div key={i} className={`det-photo ${i === 0 ? 'det-photo-main' : ''}`}
              onClick={() => { setLbIdx(i); setLbOpen(true) }}
              style={{ width: '100%', height: i === 0 ? '75vh' : '55vh', position: 'relative', overflow: 'hidden', cursor: 'pointer', background: '#e5e5e5' }}>
              <img src={src} alt="" loading={i === 0 ? 'eager' : 'lazy'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {i === 0 && imgs.length > 1 && (
                <div style={{ position: 'absolute', bottom: 16, right: 16, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: 11, fontWeight: 500, padding: '5px 12px', borderRadius: 20 }}>
                  {imgs.length} {t.photos}
                </div>
              )}
              <div className="det-photo-zoom">⤢</div>
            </div>
          ))}
        </div>

        {/* Right — info panel */}
        <div className="det-right">
          <div style={{ padding: '36px 36px 48px', display: 'flex', flexDirection: 'column', gap: 0, minHeight: '100%' }}>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: '#aaa', marginBottom: 10 }}>{tagLabel}</div>
            <h1 style={{ fontFamily: 'var(--font-heading,"Playfair Display",serif)', fontSize: 'clamp(22px,2.5vw,26px)', lineHeight: 1.25, margin: '0 0 10px', color: '#111', fontWeight: 700 }}>{p.title}</h1>
            <div style={{ fontSize: 'clamp(26px,3vw,30px)', fontWeight: 700, color: '#111', marginBottom: 20, letterSpacing: '-.01em' }}>
              {fmt(p.price, p.currency)}
              {p.transaction === 'rent' && <span style={{ fontSize: 14, fontWeight: 400, color: '#aaa', marginLeft: 8 }}>{t.perMonth}</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button onClick={shareProperty} style={actionBtn}><ShareIcon /> {t.share}</button>
              {officeWhatsapp && (
                <button onClick={openWhatsApp} style={{ ...actionBtn, background: '#25D366', color: '#fff', borderColor: '#25D366' }}>
                  <WAIcon /> WhatsApp
                </button>
              )}
              <button onClick={scrollToForm} style={{ ...actionBtn, background: '#111', color: '#fff', borderColor: '#111' }}>{ctaLabel} →</button>
            </div>
            <Divider />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              {p.bedrooms != null && <Stat value={p.bedrooms} label={t.bedrooms} />}
              {p.bathrooms != null && <Stat value={p.bathrooms} label={t.bathrooms} />}
              {p.area_m2 != null && <Stat value={`${p.area_m2} m²`} label={t.built} />}
              {p.lot_m2 != null && <Stat value={`${p.lot_m2} m²`} label={t.lot} />}
            </div>
            <Divider />
            {p.description && (
              <>
                <SectionLabel>{t.description}</SectionLabel>
                <p style={{ fontSize: 13, lineHeight: 1.75, color: '#666', margin: '0 0 18px', whiteSpace: 'pre-line' }}>{p.description}</p>
                <Divider />
              </>
            )}
            {staticMap && (
              <>
                <SectionLabel>{t.location}</SectionLabel>
                {staticMap}
                <a href={`https://maps.google.com/?q=${p.lat},${p.lng}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--primary,#6b2fa0)', fontSize: 11, textDecoration: 'none', marginBottom: 18 }}>
                  {t.viewOnGoogleMaps}
                </a>
                <Divider />
              </>
            )}
            <div style={{ background: '#f9f9f9', borderRadius: 10, padding: 22, border: '1px solid #eee', marginTop: 'auto' }}>
              {agentCard}
              {contactForm}
            </div>
          </div>
        </div>
      </div>
      {lightbox}{toastEl}
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
function AHeroStat({ val, lbl }: { val: string | number; lbl: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#111', lineHeight: 1 }}>{val}</div>
      <div style={{ fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 4 }}>{lbl}</div>
    </div>
  )
}
function BPill({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f5f5f5', borderRadius: 6, padding: '10px 18px', fontSize: 13, color: '#555' }}>
      <strong style={{ color: '#111', fontWeight: 700 }}>{value}</strong> {label}
    </div>
  )
}
function DStatItem({ val, lbl }: { val: string | number; lbl: string }) {
  return (
    <div style={{ padding: '0 48px', borderRight: '1px solid #eee' }}>
      <div style={{ fontSize: 42, fontWeight: 700, color: '#111', lineHeight: 1 }}>{val}</div>
      <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#bbb', marginTop: 8 }}>{lbl}</div>
    </div>
  )
}
function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}
function WAIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
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
