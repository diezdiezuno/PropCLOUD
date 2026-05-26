'use client'

import type { Property } from '@/types'

interface Props {
  property: Property
  onClick?: (p: Property) => void
}

function fmtPrice(price: number, currency: string): string {
  if (currency === 'CRC') {
    return '₡' + (price >= 1_000_000
      ? (price / 1_000_000).toFixed(1).replace('.0', '') + 'M'
      : (price / 1_000).toFixed(0) + 'K')
  }
  return price >= 1_000_000
    ? '$' + (price / 1_000_000).toFixed(1).replace('.0', '') + 'M'
    : '$' + (price / 1_000).toFixed(0) + 'K'
}

export default function PropertyCard({ property: p, onClick }: Props) {
  const img = p.images[0]
  const location = [p.city, p.country].filter(Boolean).join(', ')

  return (
    <div
      onClick={() => onClick?.(p)}
      style={{
        background: '#fff',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'transform .2s, box-shadow .2s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = ''
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', paddingTop: '65%', background: '#f0f0f0' }}>
        {img && (
          <img
            src={img}
            alt={p.title}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
          color: '#fff', fontSize: 10, fontWeight: 600,
          letterSpacing: '.1em', textTransform: 'uppercase',
          padding: '3px 8px', borderRadius: 20,
        }}>
          {p.transaction === 'rent' ? 'Alquiler' : 'Venta'}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: '#aaa', marginBottom: 4 }}>
          {p.type}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 4, lineHeight: 1.3,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {p.title}
        </div>
        {location && (
          <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
            📍 {location}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>
            {fmtPrice(p.price, p.currency)}
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 12, color: '#666' }}>
            {p.bedrooms != null && <span>🛏 {p.bedrooms}</span>}
            {p.bathrooms != null && <span>🚿 {p.bathrooms}</span>}
            {p.area_m2 != null && <span>📐 {p.area_m2}m²</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
