'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useFilteredProperties } from '@/contexts/FilterContext'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { Property } from '@/types'

type ViewMode = 'grid' | 'hover' | 'dual' | 'list'
type Sort = 'price_asc' | 'price_desc' | 'newest'

interface Props {
  defaultView?: 'grid' | 'list'
  defaultCols?: number
  defaultSort?: Sort
}

function fmtPrice(price: number, currency: string) {
  const sym = currency === 'CRC' ? '₡' : '$'
  if (currency === 'CRC') return sym + (price >= 1e6 ? (price / 1e6).toFixed(1).replace('.0', '') + 'M' : Math.round(price / 1000) + 'K')
  return sym + (price >= 1e6 ? (price / 1e6).toFixed(1).replace('.0', '') + 'M' : Math.round(price / 1000) + 'K')
}

export default function ListingsClient({ defaultView = 'grid', defaultSort = 'price_asc' }: Props) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [allProperties, setAllProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>(defaultView === 'list' ? 'list' : 'grid')

  const filtered = useFilteredProperties(allProperties)

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (defaultSort === 'price_desc') return b.price - a.price
      if (defaultSort === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      return a.price - b.price
    })
  }, [filtered, defaultSort])

  useEffect(() => {
    fetch('/api/properties')
      .then(r => r.json())
      .then((data: Property[]) => { setAllProperties(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const go = (id: string) => router.push(`/listings/${id}`)

  return (
    <div style={{ paddingTop: 'var(--nav-h, 68px)', minHeight: '100vh', background: '#f5f5f7' }}>
      <section style={{ padding: isMobile ? '24px 16px 64px' : '40px 40px 64px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent, #f5a623)', fontWeight: 500, marginBottom: 8 }}>
            Portafolio
          </div>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 700, color: 'var(--dark, #1a1a1a)', lineHeight: 1.2, marginBottom: 4 }}>
            Todas las Propiedades
          </h2>
          <p style={{ color: 'var(--mid, #666)', fontSize: 15, fontWeight: 300 }}>
            {loading ? 'Cargando...' : `${sorted.length} propiedades encontradas`}
          </p>
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 3, background: '#f0f0f0', borderRadius: 8, padding: 3 }}>
            {[
              { mode: 'grid' as ViewMode, title: 'Masonry', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="9" rx="1"/><rect x="9" y="1" width="6" height="5" rx="1"/><rect x="1" y="12" width="6" height="3" rx="1"/><rect x="9" y="8" width="6" height="7" rx="1"/></svg> },
              { mode: 'hover' as ViewMode, title: 'Grid hover', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg> },
              { mode: 'dual' as ViewMode, title: 'Grid dual', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="14" rx="1"/><rect x="9" y="1" width="6" height="14" rx="1"/></svg> },
              { mode: 'list' as ViewMode, title: 'Lista', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="3" rx="1"/><rect x="1" y="7" width="14" height="3" rx="1"/><rect x="1" y="12" width="14" height="3" rx="1"/></svg> },
            ].map(({ mode, title, icon }) => (
              <button key={mode} onClick={() => setView(mode)} title={title} style={{
                background: view === mode ? '#fff' : 'none', border: 'none',
                padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                color: view === mode ? '#1a1a1a' : '#aaa',
                boxShadow: view === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex', alignItems: 'center', transition: 'all .15s',
              }}>
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: 36, height: 36, border: '2px solid #e5e5e5', borderTopColor: 'var(--accent,#f5a623)', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ color: '#999' }}>Cargando...</p>
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#aaa' }}>Sin resultados con esos filtros</div>
        ) : view === 'grid' ? (
          // Masonry
          <div style={{ columns: isMobile ? 1 : 4, columnGap: 8 }}>
            {sorted.map(p => <MasonryCard key={p.id} p={p} onClick={() => go(p.id)} />)}
          </div>
        ) : view === 'hover' ? (
          // Hover grid
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 6 }}>
            {sorted.map(p => <HoverCard key={p.id} p={p} onClick={() => go(p.id)} />)}
          </div>
        ) : view === 'dual' ? (
          // Dual
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 20 }}>
            {sorted.map(p => <DualCard key={p.id} p={p} onClick={() => go(p.id)} />)}
          </div>
        ) : (
          // List
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {sorted.map(p => <ListRow key={p.id} p={p} onClick={() => go(p.id)} />)}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Card components ──────────────────────────────────────────────────────────

function MasonryCard({ p, onClick }: { p: Property; onClick: () => void }) {
  const isRent = p.transaction === 'rent'
  const img = p.images[0]
  const loc = [p.city, p.country].filter(Boolean).join(', ')
  const feats = [
    p.bedrooms != null ? `🛏 ${p.bedrooms}` : '',
    p.bathrooms != null ? `🚿 ${p.bathrooms}` : '',
    p.area_m2 != null ? `📐 ${p.area_m2} m²` : '',
  ].filter(Boolean)
  return (
    <div className="property-card" onClick={onClick} style={{ breakInside: 'avoid', marginBottom: 8 }}>
      <div className="card-img">
        <img src={img || 'https://via.placeholder.com/600x400/e2e2e8/8a8a9a?text=Sin+imagen'} alt="" loading="lazy" />
        <span className={`card-badge${isRent ? ' rent' : ''}`}>{isRent ? 'Alquiler' : 'Venta'}</span>
        <div className="card-overlay">
          <div className="card-ov-type">{p.type}</div>
          <div className="card-ov-title">{p.title}</div>
          {loc && <div className="card-ov-loc">📍 {loc}</div>}
          <div className="card-ov-price">{fmtPrice(p.price, p.currency)}</div>
          {feats.length > 0 && <div className="card-ov-feats">{feats.map((f, i) => <span key={i} className="card-ov-feat">{f}</span>)}</div>}
        </div>
      </div>
    </div>
  )
}

function HoverCard({ p, onClick }: { p: Property; onClick: () => void }) {
  const isRent = p.transaction === 'rent'
  const img = p.images[0]
  const loc = [p.city, p.country].filter(Boolean).join(', ')
  return (
    <div className="property-card" onClick={onClick} style={{ breakInside: 'avoid', marginBottom: 0 }}>
      <div className="card-img square">
        <img src={img || 'https://via.placeholder.com/600x600/e2e2e8/8a8a9a?text=Sin+imagen'} alt="" loading="lazy" />
        <span className={`card-badge${isRent ? ' rent' : ''}`}>{isRent ? 'Alquiler' : 'Venta'}</span>
        <div className="card-overlay">
          <div className="card-ov-type">{p.type}</div>
          <div className="card-ov-title">{p.title}</div>
          {loc && <div className="card-ov-loc">📍 {loc}</div>}
          <div className="card-ov-price">{fmtPrice(p.price, p.currency)}</div>
        </div>
      </div>
    </div>
  )
}

function DualCard({ p, onClick }: { p: Property; onClick: () => void }) {
  const isRent = p.transaction === 'rent'
  const img = p.images[0]
  const loc = [p.city, p.country].filter(Boolean).join(', ')
  return (
    <div className="card-dual" onClick={onClick}>
      <div className="card-dual-img">
        <img src={img || 'https://via.placeholder.com/800x450/e2e2e8/8a8a9a?text=Sin+imagen'} alt="" loading="lazy" />
        <span className={`card-badge${isRent ? ' rent' : ''}`}>{isRent ? 'Alquiler' : 'Venta'}</span>
      </div>
      <div className="card-dual-body">
        <div className="card-dual-type">{p.type}</div>
        <div className="card-dual-title">{p.title}</div>
        {loc && <div className="card-dual-loc">📍 {loc}</div>}
        <div className="card-dual-price">{fmtPrice(p.price, p.currency)}</div>
      </div>
      <div className="card-dual-feats">
        {p.bedrooms != null && <div className="card-dual-feat"><strong>{p.bedrooms}</strong>🛏 Hab</div>}
        {p.bathrooms != null && <div className="card-dual-feat"><strong>{p.bathrooms}</strong>🚿 Baños</div>}
        {p.area_m2 != null && <div className="card-dual-feat"><strong>{p.area_m2}</strong>📐 m²</div>}
      </div>
    </div>
  )
}

function ListRow({ p, onClick }: { p: Property; onClick: () => void }) {
  const isRent = p.transaction === 'rent'
  const img = p.images[0]
  const loc = [p.city, p.country].filter(Boolean).join(', ')
  return (
    <div className="card-list-row" onClick={onClick} style={{ marginBottom: 0, borderBottom: '1px solid #ebebeb' }}>
      <div className="card-list-img">
        <img src={img || 'https://via.placeholder.com/400x300/e2e2e8/8a8a9a?text=Sin+imagen'} alt="" loading="lazy" />
        <span className={`card-badge${isRent ? ' rent' : ''}`}>{isRent ? 'Alquiler' : 'Venta'}</span>
      </div>
      <div className="card-list-body">
        <div className="card-type">{p.type}</div>
        <div className="card-title" style={{ fontSize: 15, marginBottom: 4 }}>{p.title}</div>
        {loc && <div className="card-location">📍 {loc}</div>}
        <div className="card-price" style={{ fontSize: 18 }}>{fmtPrice(p.price, p.currency)}</div>
      </div>
      <div className="card-list-foot">
        {p.bedrooms != null && <span className="card-feat">🛏 <strong>{p.bedrooms}</strong></span>}
        {p.bathrooms != null && <span className="card-feat">🚿 <strong>{p.bathrooms}</strong></span>}
        {p.area_m2 != null && <span className="card-feat">📐 <strong>{p.area_m2} m²</strong></span>}
      </div>
    </div>
  )
}
