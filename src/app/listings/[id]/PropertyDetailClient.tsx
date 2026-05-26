'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Property } from '@/types'

interface Props {
  id: string
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

export default function PropertyDetailClient({ id }: Props) {
  const router = useRouter()
  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    fetch('/api/properties')
      .then(r => r.json())
      .then((data: Property[]) => {
        const found = data.find(p => p.id === id)
        if (found) {
          setProperty(found)
        } else {
          setNotFound(true)
        }
        setLoading(false)
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [id])

  if (loading) {
    return (
      <div style={{ paddingTop: 68, minHeight: '100vh', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '3px solid #e5e5e5', borderTopColor: '#555',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (notFound || !property) {
    return (
      <div style={{ paddingTop: 68, minHeight: '100vh', background: '#f5f5f7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ fontSize: 48 }}>🏠</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#333' }}>Propiedad no encontrada</div>
        <button
          onClick={() => router.push('/listings')}
          style={{ background: '#222', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Ver todas las propiedades
        </button>
      </div>
    )
  }

  const p = property
  const imgs = p.images.length > 0 ? p.images : []
  const location = [p.address, p.city, p.country].filter(Boolean).join(', ')
  const whatsappMsg = encodeURIComponent(`Hola, me interesa la propiedad: ${p.title}`)
  const whatsappUrl = p.agent_phone
    ? `https://wa.me/${p.agent_phone.replace(/\D/g, '')}?text=${whatsappMsg}`
    : null

  return (
    <div style={{ paddingTop: 68, minHeight: '100vh', background: '#f5f5f7' }}>

      {/* Back button */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px 0' }}>
        <button
          onClick={() => router.back()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: '#666', padding: '6px 0', fontFamily: 'inherit',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Volver a propiedades
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 24px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32, alignItems: 'start' }}>

          {/* LEFT */}
          <div>
            {/* Main image */}
            <div style={{
              borderRadius: 16, overflow: 'hidden', background: '#e5e5e5',
              position: 'relative', paddingTop: '60%', marginBottom: 12,
            }}>
              {imgs[activeIdx] ? (
                <img
                  src={imgs[activeIdx]}
                  alt={p.title}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 14,
                }}>
                  Sin imágenes
                </div>
              )}
              {/* Transaction badge */}
              <div style={{
                position: 'absolute', top: 16, left: 16,
                background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
                color: '#fff', fontSize: 11, fontWeight: 600,
                letterSpacing: '.1em', textTransform: 'uppercase',
                padding: '4px 10px', borderRadius: 20,
              }}>
                {p.transaction === 'rent' ? 'Alquiler' : 'Venta'}
              </div>
              {imgs.length > 1 && (
                <div style={{
                  position: 'absolute', bottom: 16, right: 16,
                  background: 'rgba(0,0,0,0.5)', color: '#fff',
                  fontSize: 12, padding: '3px 10px', borderRadius: 20,
                }}>
                  {activeIdx + 1} / {imgs.length}
                </div>
              )}
            </div>

            {/* Thumbnail strip */}
            {imgs.length > 1 && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {imgs.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIdx(i)}
                    style={{
                      flexShrink: 0, width: 80, height: 56,
                      borderRadius: 8, overflow: 'hidden',
                      border: i === activeIdx ? '2px solid #222' : '2px solid transparent',
                      padding: 0, cursor: 'pointer', background: '#e5e5e5',
                    }}
                  >
                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}

            {/* Title & location */}
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: '#aaa', marginBottom: 6 }}>
                {p.type}
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111', margin: '0 0 10px', lineHeight: 1.25 }}>
                {p.title}
              </h1>
              {location && (
                <div style={{ fontSize: 14, color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                    <circle cx="12" cy="9" r="2.5" />
                  </svg>
                  {location}
                </div>
              )}
            </div>

            {/* Stats row */}
            {(p.bedrooms != null || p.bathrooms != null || p.area_m2 != null) && (
              <div style={{
                display: 'flex', gap: 24, marginTop: 20,
                padding: '16px 0', borderTop: '1px solid #ebebeb', borderBottom: '1px solid #ebebeb',
              }}>
                {p.bedrooms != null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20 }}>🛏</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{p.bedrooms}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>Hab.</div>
                  </div>
                )}
                {p.bathrooms != null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20 }}>🚿</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{p.bathrooms}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>Baños</div>
                  </div>
                )}
                {p.area_m2 != null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20 }}>📐</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{p.area_m2}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>m²</div>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {p.description && (
              <div style={{ marginTop: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 10 }}>Descripción</h2>
                <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
                  {p.description}
                </p>
              </div>
            )}
          </div>

          {/* RIGHT — sticky price + agent */}
          <div style={{ position: 'sticky', top: 88 }}>

            {/* Price card */}
            <div style={{
              background: '#fff', borderRadius: 16, padding: '24px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: 16,
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#111', marginBottom: 4 }}>
                {fmtPrice(p.price, p.currency)}
              </div>
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 20 }}>
                {p.currency} · {p.transaction === 'rent' ? 'por mes' : 'precio de venta'}
              </div>

              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: '#25D366', color: '#fff', borderRadius: 10,
                    padding: '12px 16px', textDecoration: 'none',
                    fontSize: 14, fontWeight: 600, marginBottom: 10,
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
                  href={`mailto:${p.agent_email}?subject=Consulta sobre propiedad&body=${whatsappMsg}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: '#fff', color: '#333', borderRadius: 10,
                    padding: '11px 16px', textDecoration: 'none',
                    fontSize: 14, fontWeight: 600, border: '1px solid #e0e0e0',
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

            {/* Agent card */}
            {p.agent_name && (
              <div style={{
                background: '#fff', borderRadius: 16, padding: '20px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: 12 }}>
                  Agente
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>
                    👤
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{p.agent_name}</div>
                    {p.agent_phone && (
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{p.agent_phone}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
