'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { getMembership } from '@/lib/membership'
import PageHeader from '@/components/admin/PageHeader'

interface Lead {
  id: string
  name: string
  email: string | null
  phone: string | null
  message: string | null
  source: string | null
  property_id: string | null
  created_at: string
  metadata: Record<string, string> | null
}

export default function AdminLeadsPage() {
  const [loading, setLoading]             = useState(true)
  const [leads, setLeads]                 = useState<Lead[]>([])
  const [tab, setTab]                     = useState<'compradores' | 'vendedores'>('compradores')
  const [expanded, setExpanded]           = useState<string | null>(null)
  const [notes, setNotes]                 = useState<Record<string, string>>({})
  const [savingNote, setSavingNote]       = useState<string | null>(null)
  const [savedNote, setSavedNote]         = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting]           = useState<string | null>(null)
  const [propertyTitles, setPropertyTitles] = useState<Record<string, string>>({})

  useEffect(() => {
    const supabase = createClient()
    getMembership().then(async m => {
      if (!m) return
      const adminRec = { tenant_id: m.tenantId }

      const { data } = await supabase
        .from('leads')
        .select('id, name, email, phone, message, source, property_id, created_at, metadata')
        .eq('tenant_id', adminRec.tenant_id)
        .neq('source', 'reclutamiento')
        .order('created_at', { ascending: false })

      const list = (data as Lead[]) ?? []
      setLeads(list)

      // Pre-fill notes
      const n: Record<string, string> = {}
      list.forEach(l => { n[l.id] = l.metadata?.notes ?? '' })
      setNotes(n)

      // Fetch property titles for leads with property_id
      const propIds = [...new Set(list.map(l => l.property_id).filter(Boolean))] as string[]
      if (propIds.length > 0) {
        const { data: props } = await supabase
          .from('properties').select('id, title').in('id', propIds)
        const titles: Record<string, string> = {}
        ;(props ?? []).forEach((p: { id: string; title: string }) => { titles[p.id] = p.title })
        setPropertyTitles(titles)
      }

      setLoading(false)
    })
  }, [])

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-CR', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function sourceLabel(source: string | null) {
    const map: Record<string, string> = {
      propiedad: 'Propiedad',
      contacto:  'Contacto',
      listar:    'Listar',
    }
    return map[source ?? ''] ?? source ?? '—'
  }

  function sourceBadgeStyle(source: string | null): React.CSSProperties {
    const styles: Record<string, React.CSSProperties> = {
      propiedad: { background: 'rgba(107,63,160,.08)', color: 'var(--primary,#6b2fa0)', border: '1px solid rgba(107,63,160,.18)' },
      contacto:  { background: 'rgba(232,146,10,.08)', color: '#b45309',               border: '1px solid rgba(232,146,10,.2)' },
      listar:    { background: 'rgba(56,161,105,.08)', color: '#276749',               border: '1px solid rgba(56,161,105,.2)' },
    }
    return {
      fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 100,
      background: '#f5f5f5', color: '#666', border: '1px solid #e0e0e0',
      ...(styles[source ?? ''] ?? {}),
    }
  }

  async function saveNote(lead: Lead) {
    setSavingNote(lead.id)
    const supabase = createClient()
    const updatedMeta = { ...(lead.metadata ?? {}), notes: notes[lead.id] ?? '' }
    await supabase.from('leads').update({ metadata: updatedMeta }).eq('id', lead.id)
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, metadata: updatedMeta } : l))
    setSavingNote(null)
    setSavedNote(lead.id)
    setTimeout(() => setSavedNote(null), 2500)
  }

  async function deleteLead(id: string) {
    setDeleting(id)
    const supabase = createClient()
    await supabase.from('leads').delete().eq('id', id)
    setLeads(prev => prev.filter(l => l.id !== id))
    setExpanded(null)
    setConfirmDelete(null)
    setDeleting(null)
  }

  if (loading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>

  const compradores = leads.filter(l => l.source !== 'listar')
  const vendedores  = leads.filter(l => l.source === 'listar')
  const visibleLeads = tab === 'compradores' ? compradores : vendedores

  return (
    <div>
      <PageHeader title={<>Leads</>} />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f5f5f7', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {([
          { key: 'compradores', label: 'Compradores', count: compradores.length },
          { key: 'vendedores',  label: 'Vendedores',  count: vendedores.length },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setExpanded(null); setConfirmDelete(null) }}
            style={{
              padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
              background: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? '#111' : '#888',
              boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
              transition: 'all .15s',
              display: 'flex', alignItems: 'center', gap: 7,
            }}
          >
            {t.label}
            <span style={{
              fontSize: 11, fontWeight: 600,
              background: tab === t.key ? '#111' : '#ddd',
              color: tab === t.key ? '#fff' : '#888',
              borderRadius: 100, padding: '1px 7px',
              transition: 'all .15s',
            }}>{t.count}</span>
          </button>
        ))}
      </div>

      {visibleLeads.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '60px 24px', border: '1px solid #ebebeb', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>{tab === 'compradores' ? '🔍' : '🏠'}</div>
          <p style={{ fontSize: 14, color: '#aaa', margin: 0 }}>
            {tab === 'compradores'
              ? 'Aún no hay leads de compradores.'
              : 'Aún no hay leads de vendedores.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 2fr 120px 150px',
            gap: 16, padding: '10px 20px',
            fontSize: 11, fontWeight: 600, color: '#aaa',
            textTransform: 'uppercase', letterSpacing: '.08em',
          }}>
            <span>Nombre</span><span>Email</span>
            <span>{tab === 'compradores' ? 'Propiedad / Fuente' : 'Ubicación / Fuente'}</span>
            <span>Teléfono</span><span>Fecha</span>
          </div>

          {visibleLeads.map(lead => {
            const isOpen = expanded === lead.id
            const isConfirming = confirmDelete === lead.id
            const isDeleting = deleting === lead.id
            const isSaving = savingNote === lead.id
            const noteSaved = savedNote === lead.id
            const hasNote = (lead.metadata?.notes ?? '').trim().length > 0
            const propTitle = (lead.property_id ? propertyTitles[lead.property_id] : null)
              ?? lead.metadata?.property_title
              ?? null
            const propUrl = lead.metadata?.property_url ?? null
            const isVendedor = lead.source === 'listar'
            const locationLabel = [lead.metadata?.provincia, lead.metadata?.canton].filter(Boolean).join(', ') || null

            return (
              <div key={lead.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #ebebeb', overflow: 'hidden' }}>
                <button
                  onClick={() => { setExpanded(prev => prev === lead.id ? null : lead.id); setConfirmDelete(null) }}
                  style={{
                    display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 2fr 120px 150px',
                    gap: 16, padding: '16px 20px', width: '100%', background: 'none',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'inherit', alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#111', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {lead.name}
                    {hasNote && <span style={{ fontSize: 10, background: 'rgba(107,63,160,.12)', color: 'var(--primary,#6b2fa0)', padding: '2px 7px', borderRadius: 100, fontWeight: 500 }}>nota</span>}
                  </span>
                  <span style={{ fontSize: 13, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.email ?? '—'}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
                    {isVendedor
                      ? locationLabel
                        ? <span style={{ fontSize: 13, fontWeight: 500, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{locationLabel}</span>
                        : <span style={{ fontSize: 13, color: '#aaa' }}>—</span>
                      : propTitle
                        ? <span style={{ fontSize: 13, fontWeight: 500, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{propTitle}</span>
                        : <span style={{ fontSize: 13, color: '#aaa' }}>—</span>
                    }
                    <span style={sourceBadgeStyle(lead.source)}>{sourceLabel(lead.source)}</span>
                  </span>
                  <span style={{ fontSize: 13, color: '#555' }}>{lead.phone ?? '—'}</span>
                  <span style={{ fontSize: 12, color: '#aaa' }}>{formatDate(lead.created_at)}</span>
                </button>

                {isOpen && (
                  <div style={{ borderTop: '1px solid #f0f0f0', padding: '20px 24px 24px', background: '#fafafa' }}>

                    {/* Property */}
                    {propTitle && (
                      <div style={{ marginBottom: 20, padding: '12px 16px', background: '#fff', borderRadius: 10, border: '1px solid #ebebeb' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Propiedad consultada</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: propUrl ? 6 : 0 }}>{propTitle}</div>
                        {propUrl && (
                          <a href={propUrl} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 12, color: 'var(--primary,#6b2fa0)', textDecoration: 'none' }}>
                            Ver propiedad →
                          </a>
                        )}
                      </div>
                    )}

                    {/* Listar metadata — structured fields */}
                    {lead.source === 'listar' && lead.metadata && Object.keys(lead.metadata).filter(k => k !== 'notes').length > 0 && (() => {
                      const LABELS: Record<string, string> = {
                        type: 'Tipo', transaction: 'Transacción',
                        provincia: 'Provincia', canton: 'Cantón', distrito: 'Distrito',
                        address: 'Dirección', finca: 'N° de finca',
                        plano: 'N° de plano', plano_url: 'Plano PDF',
                        area: 'Área construida', lot: 'Área de terreno',
                        bedrooms: 'Habitaciones', bathrooms: 'Baños',
                        timeline: '¿Cuándo vender?', contact_pref: 'Contacto preferido',
                        description: 'Descripción', coordinates: 'Ubicación en mapa',
                      }
                      // Separate coordinates from the rest
                      const coords = lead.metadata.coordinates ?? null
                      const mapsUrl = coords
                        ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}`
                        : null
                      const entries = Object.entries(lead.metadata).filter(([k, v]) => k !== 'notes' && k !== 'coordinates' && v)
                      return (
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Datos de la propiedad</div>

                          {/* Google Maps link */}
                          {mapsUrl && (
                            <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fff', borderRadius: 8, border: '1px solid #ebebeb', display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 16 }}>📍</span>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 2 }}>Ubicación marcada</div>
                                <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                                  style={{ fontSize: 13, color: 'var(--primary,#6b2fa0)', textDecoration: 'none', fontWeight: 500 }}>
                                  Ver en Google Maps →
                                </a>
                                <span style={{ fontSize: 11, color: '#bbb', marginLeft: 8 }}>{coords}</span>
                              </div>
                            </div>
                          )}

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                            {entries.map(([k, v]) => (
                              <div key={k}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 2 }}>{LABELS[k] ?? k}</div>
                                {k === 'plano_url'
                                  ? <a href={v} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--primary,#6b2fa0)', textDecoration: 'none' }}>Ver PDF →</a>
                                  : <div style={{ fontSize: 13, color: '#333' }}>{v}</div>
                                }
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Message (non-listar) */}
                    {lead.source !== 'listar' && lead.message && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Mensaje</div>
                        <div style={{ fontSize: 14, color: '#333', lineHeight: 1.6 }}>{lead.message}</div>
                      </div>
                    )}

                    {/* Notes */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Notas internas</div>
                      <textarea
                        value={notes[lead.id] ?? ''}
                        onChange={e => setNotes(prev => ({ ...prev, [lead.id]: e.target.value }))}
                        rows={3}
                        placeholder="Agregá notas sobre este lead…"
                        style={{ width: '100%', border: '1px solid #e0e0e0', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', background: '#fff', boxSizing: 'border-box', lineHeight: 1.6 }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                        <button onClick={() => saveNote(lead)} disabled={isSaving}
                          style={{ fontSize: 13, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer', background: 'var(--color-primary, #111)', color: '#fff', opacity: isSaving ? 0.6 : 1, fontFamily: 'inherit' }}>
                          {isSaving ? 'Guardando…' : 'Guardar nota'}
                        </button>
                        {noteSaved && <span style={{ fontSize: 12, color: '#38a169' }}>✓ Guardado</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ paddingTop: 16, borderTop: '1px solid #ebebeb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {lead.email && (
                          <a href={`mailto:${lead.email}`}
                            style={{ fontSize: 13, fontWeight: 500, color: '#fff', background: 'var(--color-primary, #111)', padding: '8px 18px', borderRadius: 100, textDecoration: 'none' }}>
                            Responder por email →
                          </a>
                        )}
                        {lead.phone && (
                          <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 13, fontWeight: 500, color: '#fff', background: '#25D366', padding: '8px 18px', borderRadius: 100, textDecoration: 'none' }}>
                            WhatsApp →
                          </a>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {!isConfirming ? (
                          <button onClick={() => setConfirmDelete(lead.id)}
                            style={{ fontSize: 12, color: '#e53e3e', background: 'none', border: '1px solid #fca5a5', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                            Eliminar
                          </button>
                        ) : (
                          <>
                            <span style={{ fontSize: 13, color: '#e53e3e', fontWeight: 500 }}>¿Eliminar este lead?</span>
                            <button onClick={() => deleteLead(lead.id)} disabled={isDeleting}
                              style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#e53e3e', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: isDeleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: isDeleting ? 0.6 : 1 }}>
                              {isDeleting ? 'Eliminando…' : 'Sí, eliminar'}
                            </button>
                            <button onClick={() => setConfirmDelete(null)}
                              style={{ fontSize: 12, color: '#666', background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                              Cancelar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
