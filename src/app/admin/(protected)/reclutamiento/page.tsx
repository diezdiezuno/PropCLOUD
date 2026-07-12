'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import PageHeader from '@/components/admin/PageHeader'

interface Application {
  id: string
  name: string
  email: string | null
  phone: string | null
  message: string | null
  created_at: string
  metadata: {
    apellido?: string
    zona?: string
    perfil?: string
    ocupacion?: string
    cv_link?: string
    linkedin?: string
    notes?: string
  } | null
}

const PERFIL_LABEL: Record<string, string> = {
  nuevo:       'Nuevo en bienes raíces',
  experiencia: 'Agente con experiencia',
  otro:        'Explorando opciones',
}

export default function AdminReclutamientoPage() {
  const [loading, setLoading]           = useState(true)
  const [apps, setApps]                 = useState<Application[]>([])
  const [expanded, setExpanded]         = useState<string | null>(null)
  const [notes, setNotes]               = useState<Record<string, string>>({})
  const [savingNote, setSavingNote]     = useState<string | null>(null)
  const [savedNote, setSavedNote]       = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting]         = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: adminRec } = await supabase
        .from('tenant_admins').select('tenant_id').eq('user_id', user.id).single()
      if (!adminRec) return

      const { data } = await supabase
        .from('leads')
        .select('id, name, email, phone, message, created_at, metadata')
        .eq('tenant_id', adminRec.tenant_id)
        .eq('source', 'reclutamiento')
        .order('created_at', { ascending: false })

      const list = (data as Application[]) ?? []
      setApps(list)
      // Pre-fill notes from metadata
      const n: Record<string, string> = {}
      list.forEach(a => { n[a.id] = a.metadata?.notes ?? '' })
      setNotes(n)
      setLoading(false)
    })
  }, [])

  function toggle(id: string) {
    setExpanded(prev => prev === id ? null : id)
    setConfirmDelete(null)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-CR', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  async function saveNote(app: Application) {
    setSavingNote(app.id)
    const supabase = createClient()
    const updatedMeta = { ...(app.metadata ?? {}), notes: notes[app.id] ?? '' }
    await supabase.from('leads').update({ metadata: updatedMeta }).eq('id', app.id)
    // Update local state
    setApps(prev => prev.map(a => a.id === app.id ? { ...a, metadata: updatedMeta } : a))
    setSavingNote(null)
    setSavedNote(app.id)
    setTimeout(() => setSavedNote(null), 2500)
  }

  async function deleteApp(id: string) {
    setDeleting(id)
    const supabase = createClient()
    await supabase.from('leads').delete().eq('id', id)
    setApps(prev => prev.filter(a => a.id !== id))
    setExpanded(null)
    setConfirmDelete(null)
    setDeleting(null)
  }

  if (loading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>

  return (
    <div>
      {/* Header */}
      <PageHeader title={<>Reclutamiento</>} subtitle={<>{apps.length === 0
            ? 'Aún no hay aplicaciones.'
            : `${apps.length} aplicación${apps.length !== 1 ? 'es' : ''} recibida${apps.length !== 1 ? 's' : ''}.`}</>} />

      {apps.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '60px 24px', border: '1px solid #ebebeb', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🌅</div>
          <p style={{ fontSize: 14, color: '#aaa', margin: 0 }}>Las aplicaciones enviadas por el formulario aparecerán aquí.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.5fr 1.5fr 140px 160px 150px',
            gap: 16, padding: '10px 20px',
            fontSize: 11, fontWeight: 600, color: '#aaa',
            textTransform: 'uppercase', letterSpacing: '.08em',
          }}>
            <span>Nombre</span>
            <span>Email</span>
            <span>Teléfono</span>
            <span>Perfil</span>
            <span>Fecha</span>
          </div>

          {apps.map(app => {
            const meta = app.metadata ?? {}
            const isOpen = expanded === app.id
            const perfilLabel = PERFIL_LABEL[meta.perfil ?? ''] ?? meta.perfil ?? '—'
            const isConfirming = confirmDelete === app.id
            const isDeleting = deleting === app.id
            const isSaving = savingNote === app.id
            const noteSaved = savedNote === app.id
            const hasNote = (meta.notes ?? '').trim().length > 0

            return (
              <div key={app.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #ebebeb', overflow: 'hidden' }}>
                {/* Row */}
                <button
                  onClick={() => toggle(app.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 1.5fr 140px 160px 150px',
                    gap: 16, padding: '16px 20px',
                    width: '100%', background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#111', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {app.name}
                    {hasNote && <span title="Tiene nota" style={{ fontSize: 10, background: 'rgba(107,63,160,.12)', color: 'var(--primary,#6b2fa0)', padding: '2px 7px', borderRadius: 100, fontWeight: 500 }}>nota</span>}
                  </span>
                  <span style={{ fontSize: 13, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.email ?? '—'}</span>
                  <span style={{ fontSize: 13, color: '#555' }}>{app.phone ?? '—'}</span>
                  <span>
                    {meta.perfil ? (
                      <span style={{
                        fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 100,
                        background: meta.perfil === 'nuevo' ? 'rgba(232,146,10,.1)' : meta.perfil === 'experiencia' ? 'rgba(107,63,160,.08)' : '#f5f5f5',
                        color: meta.perfil === 'nuevo' ? '#b45309' : meta.perfil === 'experiencia' ? 'var(--primary,#6b2fa0)' : '#666',
                        border: `1px solid ${meta.perfil === 'nuevo' ? 'rgba(232,146,10,.2)' : meta.perfil === 'experiencia' ? 'rgba(107,63,160,.18)' : '#e0e0e0'}`,
                      }}>
                        {perfilLabel}
                      </span>
                    ) : <span style={{ fontSize: 13, color: '#aaa' }}>—</span>}
                  </span>
                  <span style={{ fontSize: 12, color: '#aaa' }}>{formatDate(app.created_at)}</span>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #f0f0f0', padding: '20px 24px 24px', background: '#fafafa' }}>

                    {/* Fields grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 20 }}>
                      {meta.zona     && <Field label="Zona"             value={meta.zona} />}
                      {meta.ocupacion && <Field label="Ocupación actual" value={meta.ocupacion} />}
                      {app.message   && <div style={{ gridColumn: '1 / -1' }}><Field label="Motivación" value={app.message} multiline /></div>}
                      {(meta.cv_link || meta.linkedin) && (
                        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                          {meta.cv_link && (
                            <a href={meta.cv_link} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: 13, color: 'var(--primary,#6b2fa0)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                              📄 Ver CV →
                            </a>
                          )}
                          {meta.linkedin && (
                            <a href={meta.linkedin} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: 13, color: 'var(--primary,#6b2fa0)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                              💼 LinkedIn →
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Notas internas</div>
                      <textarea
                        value={notes[app.id] ?? ''}
                        onChange={e => setNotes(prev => ({ ...prev, [app.id]: e.target.value }))}
                        rows={3}
                        placeholder="Agregá notas sobre este candidato…"
                        style={{
                          width: '100%', border: '1px solid #e0e0e0', borderRadius: 8,
                          padding: '10px 12px', fontSize: 13, fontFamily: 'inherit',
                          resize: 'vertical', outline: 'none', background: '#fff',
                          boxSizing: 'border-box', lineHeight: 1.6,
                        }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                        <button
                          onClick={() => saveNote(app)}
                          disabled={isSaving}
                          style={{
                            fontSize: 13, fontWeight: 500, padding: '7px 16px',
                            borderRadius: 8, border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer',
                            background: '#111', color: '#fff', opacity: isSaving ? 0.6 : 1,
                            fontFamily: 'inherit',
                          }}
                        >
                          {isSaving ? 'Guardando…' : 'Guardar nota'}
                        </button>
                        {noteSaved && <span style={{ fontSize: 12, color: '#38a169' }}>✓ Guardado</span>}
                      </div>
                    </div>

                    {/* Actions bar */}
                    <div style={{ paddingTop: 16, borderTop: '1px solid #ebebeb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>

                      {/* Quick reply */}
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        {app.email && (
                          <a
                            href={`mailto:${app.email}?subject=Tu aplicación en TEAM SUNRISE | REMAX Central`}
                            style={{ fontSize: 13, fontWeight: 500, color: '#fff', background: '#111', padding: '8px 18px', borderRadius: 100, textDecoration: 'none' }}
                          >
                            Responder por email →
                          </a>
                        )}
                        {app.phone && (
                          <a
                            href={`https://wa.me/${app.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${app.name}, gracias por tu interés en TEAM SUNRISE. Nos gustaría conversar con vos sobre tu aplicación.`)}`}
                            target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 13, fontWeight: 500, color: '#fff', background: '#25D366', padding: '8px 18px', borderRadius: 100, textDecoration: 'none' }}
                          >
                            WhatsApp →
                          </a>
                        )}
                      </div>

                      {/* Delete */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {!isConfirming ? (
                          <button
                            onClick={() => setConfirmDelete(app.id)}
                            style={{ fontSize: 12, color: '#e53e3e', background: 'none', border: '1px solid #fca5a5', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            Eliminar
                          </button>
                        ) : (
                          <>
                            <span style={{ fontSize: 13, color: '#e53e3e', fontWeight: 500 }}>¿Eliminar esta aplicación?</span>
                            <button
                              onClick={() => deleteApp(app.id)}
                              disabled={isDeleting}
                              style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#e53e3e', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: isDeleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: isDeleting ? 0.6 : 1 }}
                            >
                              {isDeleting ? 'Eliminando…' : 'Sí, eliminar'}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              style={{ fontSize: 12, color: '#666', background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
                            >
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

function Field({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#333', lineHeight: multiline ? 1.6 : 1.4 }}>{value}</div>
    </div>
  )
}
