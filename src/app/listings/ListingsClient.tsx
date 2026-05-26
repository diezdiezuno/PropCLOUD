'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import PropertyCard from '@/components/PropertyCard/PropertyCard'
import type { Property } from '@/types'

type View = 'grid' | 'list'
type Sort = 'price_asc' | 'price_desc' | 'newest'

interface Props {
  defaultView?: View
  defaultCols?: number
  defaultSort?: Sort
}

const PRICE_MAX_USD = 5_000_000

function sortProperties(props: Property[], sort: Sort): Property[] {
  return [...props].sort((a, b) => {
    if (sort === 'price_asc') return a.price - b.price
    if (sort === 'price_desc') return b.price - a.price
    // newest
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export default function ListingsClient({ defaultView = 'grid', defaultCols = 3, defaultSort = 'price_asc' }: Props) {
  const router = useRouter()
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'sale' | 'rent'>('sale')
  const [search, setSearch] = useState('')
  const [maxPrice, setMaxPrice] = useState(PRICE_MAX_USD)
  const [view, setView] = useState<View>(defaultView)

  useEffect(() => {
    fetch('/api/properties')
      .then(r => r.json())
      .then((data: Property[]) => { setProperties(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const base = properties.filter(p => {
      if (p.transaction !== tab) return false
      if (p.currency === 'USD' && p.price > maxPrice) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          p.title?.toLowerCase().includes(q) ||
          p.city?.toLowerCase().includes(q) ||
          p.type?.toLowerCase().includes(q)
        )
      }
      return true
    })
    return sortProperties(base, defaultSort)
  }, [properties, tab, search, maxPrice, defaultSort])

  const gridCols = `repeat(${defaultCols}, minmax(0, 1fr))`

  return (
    <div style={{ paddingTop: 68, minHeight: '100vh', background: '#f5f5f7' }}>

      {/* Filter bar */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #ebebeb',
        padding: '0 24px', display: 'flex', alignItems: 'center',
        gap: 16, height: 56, position: 'sticky', top: 68, zIndex: 100,
      }}>
        {/* Sale/Rent tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {(['sale', 'rent'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 18px', border: 'none', background: 'none',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              color: tab === t ? '#1a1a1a' : '#aaa',
              borderBottom: `2px solid ${tab === t ? 'var(--accent, #aaa)' : 'transparent'}`,
              fontFamily: 'inherit', transition: 'color .2s',
            }}>
              {t === 'sale' ? 'Venta' : 'Alquiler'}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: '#e5e5e5' }} />

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por zona, tipo..."
          style={{
            border: '1px solid #e5e5e5', borderRadius: 8, padding: '6px 12px',
            fontSize: 13, outline: 'none', width: 220, fontFamily: 'inherit',
          }}
        />

        <div style={{ flex: 1 }} />

        {/* View toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['grid', 'list'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} title={v === 'grid' ? 'Cuadrícula' : 'Lista'} style={{
              width: 32, height: 32, borderRadius: 6, border: '1px solid #e5e5e5',
              background: view === v ? '#111' : '#fff',
              color: view === v ? '#fff' : '#888',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {v === 'grid'
                ? <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="0" y="0" width="6" height="6" rx="1"/><rect x="10" y="0" width="6" height="6" rx="1"/><rect x="0" y="10" width="6" height="6" rx="1"/><rect x="10" y="10" width="6" height="6" rx="1"/></svg>
                : <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="0" y="1" width="16" height="2" rx="1"/><rect x="0" y="7" width="16" height="2" rx="1"/><rect x="0" y="13" width="16" height="2" rx="1"/></svg>
              }
            </button>
          ))}
        </div>

        {/* Count */}
        <span style={{ fontSize: 13, color: '#888' }}>
          {loading ? 'Cargando...' : `${filtered.length} propiedades`}
        </span>
      </div>

      {/* Properties */}
      <div style={{ padding: '24px', maxWidth: 1280, margin: '0 auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '3px solid #e5e5e5', borderTopColor: '#555',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 80, color: '#aaa', fontSize: 15 }}>
            No hay propiedades con esos filtros
          </div>
        ) : view === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 20 }}>
            {filtered.map(p => (
              <PropertyCard key={p.id} property={p} onClick={() => router.push(`/listings/${p.id}`)} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(p => (
              <PropertyListRow key={p.id} property={p} onClick={() => router.push(`/listings/${p.id}`)} />
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function fmtPrice(price: number, currency: string) {
  if (currency === 'CRC') return '₡' + (price >= 1e6 ? (price / 1e6).toFixed(1).replace('.0', '') + 'M' : (price / 1000).toFixed(0) + 'K')
  return '$' + (price >= 1e6 ? (price / 1e6).toFixed(1).replace('.0', '') + 'M' : (price / 1000).toFixed(0) + 'K')
}

function PropertyListRow({ property: p, onClick }: { property: Property; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
      display: 'flex', gap: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      transition: 'box-shadow .2s',
    }}
      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.09)'}
      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)'}
    >
      <div style={{ width: 200, flexShrink: 0, background: '#f0f0f0', position: 'relative' }}>
        {p.images[0] && <img src={p.images[0]} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      </div>
      <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: '#aaa', marginBottom: 4 }}>{p.type}</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 6 }}>{p.title}</div>
        {p.city && <div style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>📍 {p.city}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111' }}>{fmtPrice(p.price, p.currency)}</div>
          <div style={{ display: 'flex', gap: 10, fontSize: 13, color: '#666' }}>
            {p.bedrooms != null && <span>🛏 {p.bedrooms}</span>}
            {p.bathrooms != null && <span>🚿 {p.bathrooms}</span>}
            {p.area_m2 != null && <span>📐 {p.area_m2}m²</span>}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', color: '#ccc', fontSize: 20 }}>›</div>
    </div>
  )
}
