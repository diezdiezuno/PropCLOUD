'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

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
  } | null
}

const PERFIL_LABEL: Record<string, string> = {
  nuevo:       'Nuevo en bienes raíces',
  experiencia: 'Agente con experiencia',
  otro:        'Explorando opciones',
}

export default function AdminReclutamientoPage() {
  const [loading, setLoading]   = useState(true)
  const [apps, setApps]         = useState<Application[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

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

      setApps((data as Application[]) ?? [])
      setLoading(false)
    })
  }, [])

  function toggle(id: string) {
    setExpanded(prev => prev === id ? null : id)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-CR', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  if (loading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>Reclutamiento</h1>
        <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>
          {apps.length === 0
            ? 'Aún no hay aplicaciones.'
            : `${apps.length} aplicación${apps.length !== 1 ? 'es' : ''} recibida${apps.length !== 1 ? 's' : ''}.`}
        </p>
      </div>

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
            const fullName = [app.name, meta.apellido].filter(Boolean).join(' ')
            // app.name already includes apellido if set via `${nombre} ${apellido}`
            // so just use app.name directly
            const isOpen = expanded === app.id
            const perfilLabel = PERFIL_LABEL[meta.perfil ?? ''] ?? meta.perfil ?? '—'

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
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{app.name}</span>
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
                  <div style={{ borderTop: '1px solid #f0f0f0', padding: '20px 20px 24px', background: '#fafafa' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>

                      {meta.zona && (
                        <Field label="Zona" value={meta.zona} />
                      )}
                      {meta.ocupacion && (
                        <Field label="Ocupación actual" value={meta.ocupacion} />
                      )}

                      {app.message && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <Field label="Motivación" value={app.message} multiline />
                        </div>
                      )}

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

                    {/* Quick reply */}
                    {app.email && (
                      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #ebebeb', display: 'flex', gap: 10, alignItems: 'center' }}>
                        <a
                          href={`mailto:${app.email}?subject=Tu aplicación en TEAM SUNRISE | REMAX Central`}
                          style={{
                            fontSize: 13, fontWeight: 500, color: '#fff',
                            background: '#111', padding: '8px 18px', borderRadius: 100,
                            textDecoration: 'none', display: 'inline-block',
                          }}
                        >
                          Responder por email →
                        </a>
                        {app.phone && (
                          <a
                            href={`https://wa.me/${app.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${app.name}, gracias por tu interés en TEAM SUNRISE. Nos gustaría conversar con vos sobre tu aplicación.`)}`}
                            target="_blank" rel="noopener noreferrer"
                            style={{
                              fontSize: 13, fontWeight: 500, color: '#fff',
                              background: '#25D366', padding: '8px 18px', borderRadius: 100,
                              textDecoration: 'none', display: 'inline-block',
                            }}
                          >
                            WhatsApp →
                          </a>
                        )}
                      </div>
                    )}
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
