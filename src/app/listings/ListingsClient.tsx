'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import PropertyCard from '@/components/PropertyCard/PropertyCard'
import type { Property } from '@/types'

const PRICE_MAX_USD = 5_000_000

export default function ListingsClient() {
  const router = useRouter()
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'sale' | 'rent'>('sale')
  const [search, setSearch] = useState('')
  const [maxPrice, setMaxPrice] = useState(PRICE_MAX_USD)

  useEffect(() => {
    fetch('/api/properties')
      .then(r => r.json())
      .then((data: Property[]) => { setProperties(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return properties.filter(p => {
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
  }, [properties, tab, search, maxPrice])

  return (
    <div style={{ paddingTop: 68, minHeight: '100vh', background: '#f5f5f7' }}>

      {/* Filter bar */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #ebebeb',
        padding: '0 24px', display: 'flex', alignItems: 'center',
        gap: 16, height: 56, position: 'sticky', top: 68, zIndex: 100,
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {(['sale', 'rent'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 18px', border: 'none', background: 'none',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              color: tab === t ? '#1a1a1a' : '#aaa',
              borderBottom: `2px solid ${tab === t ? '#aaa' : 'transparent'}`,
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

        {/* Count */}
        <span style={{ fontSize: 13, color: '#888' }}>
          {loading ? 'Cargando...' : `${filtered.length} propiedades`}
        </span>
      </div>

      {/* Grid */}
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
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20,
          }}>
            {filtered.map(p => (
              <PropertyCard
                key={p.id}
                property={p}
                onClick={() => router.push(`/listings/${p.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
