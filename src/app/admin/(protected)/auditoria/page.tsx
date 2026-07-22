'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import PageHeader from '@/components/admin/PageHeader'

// Auditoría: quién cambió qué. Igual que la bitácora, no comprueba el rol acá
// —la policy de `audit_log` solo devuelve filas a los admins de la oficina— y
// tampoco puede escribir: la tabla no tiene policy de insert, update ni delete.

interface Evento {
  id: number
  tabla: string
  operacion: 'INSERT' | 'UPDATE' | 'DELETE'
  registro_id: string | null
  etiqueta: string | null
  cambios: Record<string, unknown> | null
  actor_id: string | null
  actor_rol: string | null
  creado_en: string
}

const TABLA: Record<string, string> = {
  crm_contacts: 'Contacto', crm_companies: 'Empresa', crm_contact_agents: 'Asignación',
  properties: 'Propiedad', users: 'Usuario', tenant_admins: 'Permisos',
  invitations: 'Invitación', tenant_config: 'Sitio', tenants: 'Oficina',
}
const OP: Record<string, { label: string; bg: string; fg: string }> = {
  INSERT: { label: 'Creó',   bg: '#E7F6EC', fg: '#0F7A3D' },
  UPDATE: { label: 'Editó',  bg: '#EEF4FF', fg: '#1B6EF3' },
  DELETE: { label: 'Borró',  bg: '#FDECEC', fg: '#C0392B' },
}
// Los nombres de columna se muestran tal cual salvo estos, que son los que
// más aparecen. Traducir todas sería un diccionario que se desactualiza.
const CAMPO: Record<string, string> = {
  name: 'nombre', last_name: 'apellido', phone: 'teléfono', email: 'correo',
  notes: 'notas', price: 'precio', title: 'título', active: 'activo',
  created_by: 'dueño', role: 'rol', tenant_id: 'oficina', agent_id: 'agente',
}

const valor = (v: unknown) =>
  v === null || v === undefined || v === '' ? '—'
    : typeof v === 'object' ? JSON.stringify(v)
    : String(v)

const cuando = (iso: string) =>
  new Date(iso).toLocaleString('es-CR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function AuditoriaPage() {
  const [eventos, setEventos] = useState<Evento[]>([])
  const [gente, setGente] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [abierto, setAbierto] = useState<number | null>(null)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('audit_log')
        .select('id, tabla, operacion, registro_id, etiqueta, cambios, actor_id, actor_rol, creado_en')
        .order('creado_en', { ascending: false }).limit(200),
      sb.from('users').select('auth_id, name'),
    ]).then(([{ data: ev }, { data: us }]) => {
      setEventos((ev ?? []) as Evento[])
      setGente(Object.fromEntries((us ?? []).filter(u => u.auth_id).map(u => [u.auth_id as string, u.name as string])))
      setLoading(false)
    })
  }, [])

  // El actor puede ya no existir —justo el caso que interesa auditar— así que
  // el nombre se resuelve si se puede y si no se dice qué se sabe.
  const quien = (e: Evento) =>
    e.actor_rol === 'service_role' || !e.actor_id ? 'Sistema'
      : gente[e.actor_id] ?? 'Usuario eliminado'

  const tablas = [...new Set(eventos.map(e => e.tabla))]
  const visibles = filtro ? eventos.filter(e => e.tabla === filtro) : eventos

  return (
    <>
      <PageHeader title={<>Auditoría</>} subtitle={<>Cada cambio en el CRM, los permisos y el sitio.</>} />

      {loading ? (
        <div style={{ color: '#8a909b', fontSize: 13.5 }}>Cargando…</div>
      ) : eventos.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #ececf0', borderRadius: 14, padding: '38px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Todavía no hay movimientos</div>
          <p style={{ fontSize: 12.5, color: '#8a909b', margin: 0, lineHeight: 1.6, maxWidth: 460, marginInline: 'auto' }}>
            Se registra cada alta, edición y borrado de contactos, empresas, propiedades,
            usuarios y permisos. Las lecturas no quedan registradas.
          </p>
        </div>
      ) : (
        <>
          {tablas.length > 1 && (
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
              {['', ...tablas].map(t => (
                <button key={t || 'todos'} onClick={() => setFiltro(t)}
                  style={{
                    fontSize: 12, borderRadius: 8, padding: '5px 11px', cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${filtro === t ? '#111' : '#edeef1'}`,
                    background: filtro === t ? '#111' : '#f7f8fa',
                    color: filtro === t ? '#fff' : '#555',
                  }}>
                  {t ? (TABLA[t] ?? t) : 'Todo'}
                </button>
              ))}
            </div>
          )}

          <div style={{ background: '#fff', border: '1px solid #ececf0', borderRadius: 14, overflow: 'hidden' }}>
            {visibles.map((e, i) => {
              const op = OP[e.operacion]
              const esUpdate = e.operacion === 'UPDATE'
              const campos = e.cambios ? Object.keys(e.cambios) : []
              const abrir = abierto === e.id
              return (
                <div key={e.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #f0f1f4' }}>
                  <div onClick={() => setAbierto(abrir ? null : e.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: op.bg, color: op.fg, whiteSpace: 'nowrap' }}>
                      {op.label}
                    </span>
                    <span style={{ fontSize: 12, color: '#8a909b', whiteSpace: 'nowrap' }}>{TABLA[e.tabla] ?? e.tabla}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#0d0f12', flex: 1, minWidth: 120 }}>
                      {e.etiqueta ?? <span style={{ color: '#c5cad3', fontWeight: 400 }}>sin nombre</span>}
                    </span>
                    {esUpdate && campos.length > 0 && (
                      <span style={{ fontSize: 12, color: '#5a6070', whiteSpace: 'nowrap' }}>
                        {campos.length === 1 ? (CAMPO[campos[0]] ?? campos[0]) : `${campos.length} campos`}
                      </span>
                    )}
                    <span style={{ fontSize: 12.5, color: '#5a6070', whiteSpace: 'nowrap' }}>{quien(e)}</span>
                    <span style={{ fontSize: 12, color: '#a9aeb8', whiteSpace: 'nowrap' }}>{cuando(e.creado_en)}</span>
                  </div>

                  {abrir && e.cambios && (
                    <div style={{ padding: '0 16px 15px', background: '#fbfcfd' }}>
                      {esUpdate ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                          <tbody>
                            {campos.map(k => {
                              const d = (e.cambios as Record<string, { antes: unknown; despues: unknown }>)[k]
                              return (
                                <tr key={k}>
                                  <td style={{ padding: '5px 10px 5px 0', color: '#8a909b', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{CAMPO[k] ?? k}</td>
                                  <td style={{ padding: '5px 10px 5px 0', color: '#c0392b', textDecoration: 'line-through', wordBreak: 'break-word' }}>{valor(d?.antes)}</td>
                                  <td style={{ padding: '5px 0', color: '#0F7A3D', wordBreak: 'break-word' }}>{valor(d?.despues)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12.5 }}>
                          {campos.filter(k => valor((e.cambios as Record<string, unknown>)[k]) !== '—').map(k => (
                            <span key={k} style={{ background: '#fff', border: '1px solid #edeef1', borderRadius: 7, padding: '3px 9px' }}>
                              <span style={{ color: '#8a909b' }}>{CAMPO[k] ?? k}: </span>
                              {valor((e.cambios as Record<string, unknown>)[k])}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <p style={{ fontSize: 12, color: '#8a909b', marginTop: 14, lineHeight: 1.6 }}>
            {visibles.length} movimiento{visibles.length === 1 ? '' : 's'}
            {eventos.length === 200 && ' — se muestran los 200 más recientes'}.
            Las lecturas no se registran: esto son cambios, no consultas.
          </p>
        </>
      )}
    </>
  )
}
