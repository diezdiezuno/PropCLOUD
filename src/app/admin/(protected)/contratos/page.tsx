'use client'

// Administración › Contratos — el admin define los tipos de contrato y el
// texto fijo de cada uno. El agente después elige uno en la propiedad y el
// sistema le mete los datos.
//
// No hay chequeo de rol acá: la RLS de contract_templates ya deja escribir
// solo al admin. Duplicarlo en la UI sería una segunda fuente de verdad.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { getMembership } from '@/lib/membership'
import PageHeader from '@/components/admin/PageHeader'
import { VARIABLES, variablesDesconocidas } from '@/lib/contract-render'

interface Plantilla {
  id: string; nombre: string; descripcion: string | null
  cuerpo: string; position: number; active: boolean
}

const inputSt: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 12px', border: '1px solid #e2e5ea',
  borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: '#fff',
  color: '#0d0f12', outline: 'none', boxSizing: 'border-box',
}

export default function ContratosAdminPage() {
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [lista,    setLista]    = useState<Plantilla[]>([])
  const [loading,  setLoading]  = useState(true)
  const [editando, setEditando] = useState<Plantilla | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const cuerpoRef = useRef<HTMLTextAreaElement>(null)

  const cargar = useCallback(async (tid: string) => {
    const { data, error } = await createClient().from('contract_templates')
      .select('id,nombre,descripcion,cuerpo,position,active')
      .eq('tenant_id', tid).order('position')
    if (error) setError(error.message)
    else setLista((data ?? []) as Plantilla[])
    setLoading(false)
  }, [])

  useEffect(() => {
    getMembership().then(m => { if (m) { setTenantId(m.tenantId); cargar(m.tenantId) } })
  }, [cargar])

  function nueva() {
    setEditando({ id: '', nombre: '', descripcion: '', cuerpo: '', position: lista.length, active: true })
    setError(null)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!editando || !tenantId) return
    if (!editando.nombre.trim()) { setError('Poné un nombre.'); return }
    setSaving(true); setError(null)
    const sb = createClient()
    const payload = {
      tenant_id: tenantId,
      nombre: editando.nombre.trim(),
      descripcion: editando.descripcion?.trim() || null,
      cuerpo: editando.cuerpo,
      position: editando.position,
      active: editando.active,
      updated_at: new Date().toISOString(),
    }
    const { error } = editando.id
      ? await sb.from('contract_templates').update(payload).eq('id', editando.id)
      : await sb.from('contract_templates').insert(payload)
    if (error) { setError(`No se pudo guardar: ${error.message}`); setSaving(false); return }
    setSaving(false); setEditando(null)
    await cargar(tenantId)
  }

  // Archivar en vez de borrar: un contrato ya generado apunta a su plantilla.
  async function archivar(p: Plantilla) {
    if (!tenantId) return
    const { error } = await createClient().from('contract_templates')
      .update({ active: !p.active }).eq('id', p.id)
    if (error) { setError(error.message); return }
    await cargar(tenantId)
  }

  /** Mete el marcador donde está el cursor, que es lo que uno espera. */
  function insertar(clave: string) {
    if (!editando) return
    const ta = cuerpoRef.current
    const marca = `{{${clave}}}`
    if (!ta) { setEditando({ ...editando, cuerpo: editando.cuerpo + marca }); return }
    const ini = ta.selectionStart ?? editando.cuerpo.length
    const fin = ta.selectionEnd ?? ini
    const nuevo = editando.cuerpo.slice(0, ini) + marca + editando.cuerpo.slice(fin)
    setEditando({ ...editando, cuerpo: nuevo })
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(ini + marca.length, ini + marca.length)
    })
  }

  if (loading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>

  const desconocidas = editando ? variablesDesconocidas(editando.cuerpo) : []

  return (
    <div>
      <PageHeader title="Contratos"
        subtitle={`${lista.filter(p => p.active).length} tipo${lista.filter(p => p.active).length !== 1 ? 's' : ''} de contrato`}
        right={
          <button onClick={nueva}
            style={{ background: 'var(--color-primary, #111)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Nuevo tipo
          </button>
        } />

      {error && !editando && <p style={{ fontSize: 13, color: '#e53e3e' }}>{error}</p>}

      {editando && (
        <form onSubmit={guardar} style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: 12, padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 18 }}>
            {editando.id ? 'Editar tipo de contrato' : 'Nuevo tipo de contrato'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#5a6070', display: 'block', marginBottom: 5 }}>Nombre</label>
              <input value={editando.nombre} onChange={e => setEditando({ ...editando, nombre: e.target.value })}
                placeholder="Contrato de captación" style={inputSt} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#5a6070', display: 'block', marginBottom: 5 }}>Descripción (opcional)</label>
              <input value={editando.descripcion ?? ''} onChange={e => setEditando({ ...editando, descripcion: e.target.value })}
                placeholder="Para qué sirve, cuándo se usa" style={inputSt} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, alignItems: 'start' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#5a6070', display: 'block', marginBottom: 5 }}>Texto del contrato</label>
              <textarea ref={cuerpoRef} value={editando.cuerpo}
                onChange={e => setEditando({ ...editando, cuerpo: e.target.value })}
                rows={18}
                placeholder={'Entre {{oficina.nombre}} y {{duenos}} se acuerda…\n\nLa propiedad ubicada en {{propiedad.ubicacion}}, finca {{propiedad.finca}}, se ofrece por {{propiedad.precio}}.\n\nComisión pactada: {{contrato.comision}}.'}
                style={{ ...inputSt, height: 'auto', padding: 12, resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.6 }} />
              {desconocidas.length > 0 && (
                <p style={{ fontSize: 12, color: '#D97706', margin: '8px 0 0' }}>
                  Estos marcadores no existen y saldrán marcados en el contrato: {desconocidas.map(d => `{{${d}}}`).join(', ')}
                </p>
              )}
            </div>

            <div style={{ border: '1px solid #eceef1', borderRadius: 10, padding: 14, background: '#fafbfc' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#111', marginBottom: 4 }}>Datos disponibles</div>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 12px', lineHeight: 1.5 }}>
                Clic para insertarlo donde está el cursor. Al generar el contrato se
                reemplaza con el dato de la propiedad.
              </p>
              {VARIABLES.map(g => (
                <div key={g.grupo} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{g.grupo}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {g.items.map(i => (
                      <button key={i.clave} type="button" onClick={() => insertar(i.clave)} title={`{{${i.clave}}}`}
                        style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e5ea', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', color: '#5a6070' }}>
                        {i.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p style={{ fontSize: 13, color: '#e53e3e', margin: '12px 0 0' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="submit" disabled={saving}
              style={{ background: 'var(--color-primary, #111)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving ? .7 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" onClick={() => setEditando(null)}
              style={{ background: 'none', border: '1px solid #e2e5ea', borderRadius: 10, padding: '10px 24px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: '#5a6070' }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: 12, overflow: 'hidden' }}>
        {lista.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#bbb', fontSize: 13 }}>
            Sin tipos de contrato. Creá el primero —captación, por ejemplo— con “+ Nuevo tipo”.
          </div>
        )}
        {lista.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: '1px solid #f2f3f5', opacity: p.active ? 1 : .5 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0d0f12' }}>
                {p.nombre} {!p.active && <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>· archivado</span>}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.descripcion || `${p.cuerpo.length} caracteres`}
              </div>
            </div>
            <button onClick={() => { setEditando(p); setError(null) }}
              style={{ fontSize: 12, color: '#5a6070', background: 'none', border: '1px solid #e2e5ea', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Editar
            </button>
            <button onClick={() => archivar(p)}
              style={{ fontSize: 12, color: p.active ? '#b45309' : '#047857', background: 'none', border: '1px solid #e2e5ea', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
              {p.active ? 'Archivar' : 'Reactivar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
