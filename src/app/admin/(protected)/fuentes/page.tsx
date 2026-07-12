'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

interface Source { id: string; type: string; config: Record<string, string>; is_active: boolean }

const SOURCE_TYPES = [
  { value: 'remax_cca', label: 'RE/MAX CCA' },
  { value: 'custom_api', label: 'API personalizada' },
  { value: 'manual', label: 'Manual (Supabase)' },
]

export default function FuentesPage() {
  const [loading, setLoading] = useState(true)
  const [tenantId, setTenantId] = useState('')
  const [sources, setSources] = useState<Source[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [addType, setAddType] = useState('remax_cca')
  const [addOfficeId, setAddOfficeId] = useState('')
  const [addApiUrl, setAddApiUrl] = useState('')
  const [adding, setAdding] = useState(false)

  async function load(tid: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('property_sources').select('*').eq('tenant_id', tid).order('created_at')
    setSources(data ?? [])
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: adminRec } = await supabase
        .from('tenant_admins').select('tenant_id').eq('user_id', user.id).single()
      if (!adminRec) return
      setTenantId(adminRec.tenant_id)
      await load(adminRec.tenant_id)
      setLoading(false)
    })
  }, [])

  async function addSource(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    const supabase = createClient()
    const config: Record<string, string> = {}
    if (addType === 'remax_cca') config.officeId = addOfficeId
    if (addType === 'custom_api') config.url = addApiUrl
    await supabase.from('property_sources').insert({ tenant_id: tenantId, type: addType, config })
    await load(tenantId)
    setShowAdd(false); setAddOfficeId(''); setAddApiUrl(''); setAdding(false)
  }

  async function toggleActive(src: Source) {
    const supabase = createClient()
    await supabase.from('property_sources').update({ is_active: !src.is_active }).eq('id', src.id)
    setSources(prev => prev.map(s => s.id === src.id ? { ...s, is_active: !s.is_active } : s))
  }

  async function deleteSource(id: string) {
    if (!confirm('¿Eliminar esta fuente de propiedades?')) return
    const supabase = createClient()
    await supabase.from('property_sources').delete().eq('id', id)
    setSources(prev => prev.filter(s => s.id !== id))
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="Fuentes de propiedades" desc="APIs y conexiones de donde se obtienen las propiedades" />

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #ebebeb', overflow: 'hidden', marginBottom: 16 }}>
        {sources.length === 0 ? (
          <div style={{ padding: '32px 24px', textAlign: 'center', color: '#aaa', fontSize: 14 }}>
            No hay fuentes configuradas
          </div>
        ) : (
          sources.map((src, i) => (
            <div key={src.id} style={{
              display: 'flex', alignItems: 'center', padding: '14px 20px', gap: 16,
              borderTop: i > 0 ? '1px solid #f0f0f0' : 'none',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
                  {SOURCE_TYPES.find(t => t.value === src.type)?.label ?? src.type}
                </div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                  {src.type === 'remax_cca' && `Office ID: ${src.config.officeId}`}
                  {src.type === 'custom_api' && `URL: ${src.config.url}`}
                  {src.type === 'manual' && 'Propiedades cargadas manualmente en Supabase'}
                </div>
              </div>
              {/* Toggle */}
              <div onClick={() => toggleActive(src)} style={{
                width: 44, height: 24, borderRadius: 12,
                background: src.is_active ? '#111' : '#e0e0e0',
                position: 'relative', cursor: 'pointer', flexShrink: 0,
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3, left: src.is_active ? 23 : 3, transition: 'left .2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
              <span style={{ fontSize: 12, color: src.is_active ? '#38a169' : '#aaa', width: 60 }}>
                {src.is_active ? 'Activa' : 'Inactiva'}
              </span>
              <button onClick={() => deleteSource(src.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 16, padding: '0 4px',
              }}>✕</button>
            </div>
          ))
        )}
      </div>

      {showAdd ? (
        <form onSubmit={addSource} style={{ background: '#fff', borderRadius: 12, padding: '22px 24px', border: '1px solid #ebebeb' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Nueva fuente
          </div>
          <Field label="Tipo">
            <select value={addType} onChange={e => setAddType(e.target.value)} style={selectStyle}>
              {SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          {addType === 'remax_cca' && (
            <Field label="Office ID (GUID del grupo RE/MAX CCA)">
              <input value={addOfficeId} onChange={e => setAddOfficeId(e.target.value)}
                placeholder="4E4F611D-B908-45DC-8A11-C0A00E600AC9"
                required style={inputStyle} />
            </Field>
          )}
          {addType === 'custom_api' && (
            <Field label="URL del endpoint (debe retornar JSON compatible)">
              <input value={addApiUrl} onChange={e => setAddApiUrl(e.target.value)}
                placeholder="https://api.ejemplo.com/propiedades"
                required style={inputStyle} />
            </Field>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="submit" disabled={adding} style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: adding ? 'not-allowed' : 'pointer', opacity: adding ? 0.7 : 1, fontFamily: 'inherit' }}>
              {adding ? 'Agregando…' : 'Agregar fuente'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 10, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowAdd(true)} style={{ background: 'none', border: '2px dashed #e0e0e0', borderRadius: 12, padding: '14px 24px', fontSize: 13, color: '#888', cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}>
          + Agregar fuente
        </button>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>{label}</label>{children}</div>
}
function PageLoader() { return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div> }
function PageHeader({ title, desc }: { title: string; desc: string }) {
  return <div style={{ borderLeft: '3px solid #111', paddingLeft: 14, marginBottom: 32 }}><h1 style={{ fontSize: 26, fontWeight: 700, color: '#111', margin: 0, lineHeight: 1.2 }}>{title}</h1><p style={{ fontSize: 14, color: '#888', margin: '5px 0 0' }}>{desc}</p></div>
}
const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #e0e0e0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const selectStyle: React.CSSProperties = { ...inputStyle, background: '#fff', cursor: 'pointer' }
