'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const CRM_STATUS_LABELS: Record<string, string> = {
  draft:        'Borrador',
  captacion:    'En captación',
  preparacion:  'En preparación',
  lista:        'Lista para publicar',
  active:       'Publicada',
  bajo_oferta:  'Bajo oferta',
  sold:         'Cerrada',
  archived:     'Archivada',
}

const CRM_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  draft:        { bg: '#f5f5f5',              color: '#888' },
  captacion:    { bg: 'rgba(37,99,235,.08)',   color: '#1d4ed8' },
  preparacion:  { bg: 'rgba(217,119,6,.08)',   color: '#b45309' },
  lista:        { bg: 'rgba(107,47,160,.08)',  color: '#6b2fa0' },
  active:       { bg: 'rgba(5,150,105,.08)',   color: '#047857' },
  bajo_oferta:  { bg: 'rgba(234,88,12,.08)',   color: '#c2410c' },
  sold:         { bg: '#111',                  color: '#fff' },
  archived:     { bg: '#f5f5f5',              color: '#aaa' },
}

interface PropRow {
  id: string
  title: string
  type: string
  transaction: string
  price: number
  currency: string
  crm_status: string | null
  status: string
  address: string | null
  provincia: string | null
  canton: string | null
  images: string[]
  agent_id: string | null
  created_at: string
}

export default function InventarioPage() {
  const [loading,  setLoading]  = useState(true)
  const [props,    setProps]    = useState<PropRow[]>([])
  const [tenantId, setTenantId] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: adminRec } = await supabase
        .from('tenant_admins').select('tenant_id').eq('user_id', user.id).single()
      if (!adminRec) return
      setTenantId(adminRec.tenant_id)

      const { data } = await supabase
        .from('properties')
        .select('id,title,type,transaction,price,currency,crm_status,status,address,provincia,canton,images,agent_id,created_at')
        .eq('tenant_id', adminRec.tenant_id)
        .eq('source', 'manual')
        .order('created_at', { ascending: false })

      setProps((data ?? []) as PropRow[])
      setLoading(false)
    })
  }, [])

  function formatPrice(price: number, currency: string) {
    if (currency === 'USD') return `$${price.toLocaleString('en-US')}`
    return `₡${price.toLocaleString('es-CR')}`
  }

  if (loading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>Propiedades</h1>
          <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>
            {props.length === 0
              ? 'Sin propiedades manuales aún.'
              : `${props.length} propiedad${props.length !== 1 ? 'es' : ''} en inventario.`}
          </p>
        </div>
        <a href="/admin/inventario/nueva"
          style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>
          + Nueva propiedad
        </a>
      </div>

      {props.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '60px 24px', border: '1px solid #ebebeb', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏘️</div>
          <p style={{ fontSize: 14, color: '#aaa', margin: '0 0 20px' }}>
            Las propiedades cargadas manualmente aparecerán aquí.
          </p>
          <a href="/admin/inventario/nueva"
            style={{ display: 'inline-block', background: '#111', color: '#fff', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            Cargar primera propiedad
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Header row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '56px 1fr 140px 120px 130px 110px 80px',
            gap: 12, padding: '8px 16px',
            fontSize: 11, fontWeight: 600, color: '#aaa',
            textTransform: 'uppercase', letterSpacing: '.07em',
          }}>
            <span></span>
            <span>Propiedad</span>
            <span>Ubicación</span>
            <span>Precio</span>
            <span>Estado CRM</span>
            <span>Fecha</span>
            <span></span>
          </div>

          {props.map(p => {
            const statusKey = p.crm_status ?? 'draft'
            const statusStyle = CRM_STATUS_COLORS[statusKey] ?? CRM_STATUS_COLORS.draft
            const thumb = p.images?.[0]

            return (
              <div key={p.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #ebebeb', overflow: 'hidden' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '56px 1fr 140px 120px 130px 110px 80px',
                  gap: 12, padding: '14px 16px', alignItems: 'center',
                }}>
                  {/* Thumb */}
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: '#f0ede8', overflow: 'hidden', flexShrink: 0 }}>
                    {thumb
                      ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏠</div>
                    }
                  </div>

                  {/* Title + type */}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.title || <span style={{ color: '#bbb', fontWeight: 400 }}>Sin título</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      {[p.type, p.transaction === 'sale' ? 'Venta' : p.transaction === 'rent' ? 'Alquiler' : ''].filter(Boolean).join(' · ')}
                    </div>
                  </div>

                  {/* Location */}
                  <div style={{ fontSize: 12, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[p.canton, p.provincia].filter(Boolean).join(', ') || p.address || '—'}
                  </div>

                  {/* Price */}
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
                    {p.price ? formatPrice(p.price, p.currency) : '—'}
                  </div>

                  {/* CRM Status */}
                  <div>
                    <span style={{
                      fontSize: 11, fontWeight: 500, borderRadius: 100, padding: '3px 10px',
                      background: statusStyle.bg, color: statusStyle.color,
                      border: `1px solid ${statusStyle.color}22`,
                    }}>
                      {CRM_STATUS_LABELS[statusKey] ?? statusKey}
                    </span>
                  </div>

                  {/* Date */}
                  <div style={{ fontSize: 12, color: '#aaa' }}>
                    {new Date(p.created_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </div>

                  {/* Actions */}
                  <div>
                    <a href={`/admin/inventario/${p.id}`}
                      style={{ fontSize: 12, color: '#555', border: '1px solid #e0e0e0', borderRadius: 7, padding: '5px 12px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                      Editar
                    </a>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
