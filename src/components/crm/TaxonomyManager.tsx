'use client'

/* ══════════════════════════════════════════════════════════════
   TaxonomyManager — gestión de Tipos de contacto y Fuentes/Canales.
   Reutilizable: se usa en el modal (desde el formulario) y en la
   página de configuración CRM. Edición/borrado solo para admins.
══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

interface CType   { id: string; name: string; color: string; position: number }
interface CSource { id: string; name: string; position: number }

const PALETTE = [
  '#5B7FFF', '#E85D75', '#F59E0B', '#10B981',
  '#8B5CF6', '#EF4444', '#06B6D4', '#F97316',
  '#84CC16', '#EC4899', '#14B8A6', '#6366F1',
]

const inputSt: React.CSSProperties = {
  height: 34, border: '1px solid #e2e5ea', borderRadius: 8, padding: '0 10px',
  fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff', color: '#0d0f12',
}

export default function TaxonomyManager({
  tenantId, canEdit, onChanged,
}: {
  tenantId: string
  canEdit?: boolean          // si se omite, se resuelve por el rol del usuario
  onChanged?: () => void     // avisa al padre que la taxonomía cambió (para recargar)
}) {
  const [types,   setTypes]   = useState<CType[]>([])
  const [sources, setSources] = useState<CSource[]>([])
  const [loading, setLoading] = useState(true)
  const [adminAuto, setAdminAuto] = useState(false)
  const editable = canEdit ?? adminAuto

  const reload = useCallback(async () => {
    const sb = createClient()
    const [{ data: t }, { data: s }] = await Promise.all([
      sb.from('contact_types').select('id,name,color,position').eq('tenant_id', tenantId).order('position'),
      sb.from('contact_sources').select('id,name,position').eq('tenant_id', tenantId).order('position'),
    ])
    setTypes((t ?? []) as CType[])
    setSources((s ?? []) as CSource[])
    setLoading(false)
    onChanged?.()
  }, [tenantId, onChanged])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    if (canEdit !== undefined) return
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await sb.from('tenant_admins').select('role')
        .eq('user_id', user.id).eq('tenant_id', tenantId).single()
      setAdminAuto(data?.role === 'admin')
    })
  }, [canEdit, tenantId])

  /* ── Types ── */
  async function addType(name: string) {
    const color = PALETTE[types.length % PALETTE.length]
    await createClient().from('contact_types').insert({ tenant_id: tenantId, name, color, position: types.length })
    await reload()
  }
  async function saveType(id: string, name: string, color: string) {
    await createClient().from('contact_types').update({ name, color }).eq('id', id)
    await reload()
  }
  async function deleteType(t: CType) {
    if (!confirm(`¿Borrar el tipo "${t.name}"? Los contactos que lo tengan lo perderán.`)) return
    const sb = createClient()
    // Limpiar la columna legacy type_id (evita error de FK) — la tabla puente cae por cascade
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('crm_contacts').update({ type_id: null }).eq('tenant_id', tenantId).eq('type_id', t.id)
    await sb.from('contact_types').delete().eq('id', t.id)
    await reload()
  }

  /* ── Sources ── */
  async function addSource(name: string) {
    await createClient().from('contact_sources').insert({ tenant_id: tenantId, name, position: sources.length })
    await reload()
  }
  async function saveSource(id: string, name: string) {
    await createClient().from('contact_sources').update({ name }).eq('id', id)
    await reload()
  }
  async function deleteSource(s: CSource) {
    if (!confirm(`¿Borrar la fuente "${s.name}"? Los contactos que la tengan quedarán sin fuente.`)) return
    const sb = createClient()
    // Poner en null la fuente de los contactos que la usan (evita error de FK)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('crm_contacts').update({ source_id: null }).eq('tenant_id', tenantId).eq('source_id', s.id)
    await sb.from('contact_sources').delete().eq('id', s.id)
    await reload()
  }

  if (loading) return <div style={{ padding: 20, color: '#9ca3af', fontSize: 13 }}>Cargando…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* TIPOS */}
      <section>
        <SectionHead title="Tipos de contacto" hint="Un contacto puede tener varios tipos." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {types.map(t => (
            <TypeRow key={t.id} t={t} editable={editable}
              onSave={(name, color) => saveType(t.id, name, color)}
              onDelete={() => deleteType(t)} />
          ))}
          {types.length === 0 && <Empty>Sin tipos aún.</Empty>}
        </div>
        {editable && <AddRow placeholder="Nuevo tipo…" onAdd={addType} />}
      </section>

      {/* FUENTES */}
      <section>
        <SectionHead title="Fuentes / Canales" hint="Cómo llegó el contacto (uno por contacto)." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sources.map(s => (
            <SourceRow key={s.id} s={s} editable={editable}
              onSave={name => saveSource(s.id, name)}
              onDelete={() => deleteSource(s)} />
          ))}
          {sources.length === 0 && <Empty>Sin fuentes aún.</Empty>}
        </div>
        {editable && <AddRow placeholder="Nueva fuente…" onAdd={addSource} />}
      </section>

      {!editable && (
        <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Solo los administradores pueden editar la taxonomía.</p>
      )}
    </div>
  )
}

/* ── Rows & bits ─────────────────────────────────────────────── */
function TypeRow({ t, editable, onSave, onDelete }: {
  t: CType; editable: boolean; onSave: (name: string, color: string) => void; onDelete: () => void
}) {
  const [name, setName]   = useState(t.name)
  const [color, setColor] = useState(t.color || '#1B6EF3')
  const dirty = editable && (name.trim() !== t.name || color !== (t.color || '#1B6EF3')) && name.trim().length > 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input type="color" value={color} disabled={!editable} onChange={e => setColor(e.target.value)}
        style={{ width: 34, height: 34, padding: 2, border: '1px solid #e2e5ea', borderRadius: 8, cursor: editable ? 'pointer' : 'default', background: '#fff', flexShrink: 0 }} />
      <input value={name} disabled={!editable} onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && dirty) onSave(name.trim(), color) }}
        style={{ ...inputSt, flex: 1 }} />
      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 16, background: (color || '#1B6EF3') + '22', color: color || '#1B6EF3', whiteSpace: 'nowrap', flexShrink: 0 }}>{name || 'Tipo'}</span>
      {dirty && <SaveBtn onClick={() => onSave(name.trim(), color)} />}
      {editable && <DelBtn onClick={onDelete} />}
    </div>
  )
}

function SourceRow({ s, editable, onSave, onDelete }: {
  s: CSource; editable: boolean; onSave: (name: string) => void; onDelete: () => void
}) {
  const [name, setName] = useState(s.name)
  const dirty = editable && name.trim() !== s.name && name.trim().length > 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input value={name} disabled={!editable} onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && dirty) onSave(name.trim()) }}
        style={{ ...inputSt, flex: 1 }} />
      {dirty && <SaveBtn onClick={() => onSave(name.trim())} />}
      {editable && <DelBtn onClick={onDelete} />}
    </div>
  )
}

function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => void }) {
  const [name, setName] = useState('')
  function add() { if (name.trim()) { onAdd(name.trim()); setName('') } }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder={placeholder}
        onKeyDown={e => { if (e.key === 'Enter') add() }}
        style={{ ...inputSt, flex: 1 }} />
      <button type="button" onClick={add} disabled={!name.trim()}
        style={{ height: 34, padding: '0 14px', border: 'none', borderRadius: 8, background: '#111', color: '#fff', fontSize: 13, fontWeight: 600, cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: name.trim() ? 1 : .5, fontFamily: 'inherit', flexShrink: 0 }}>
        + Agregar
      </button>
    </div>
  )
}

function SaveBtn({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} title="Guardar"
    style={{ height: 34, minWidth: 34, border: 'none', borderRadius: 8, background: '#15803d', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>✓</button>
}
function DelBtn({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} title="Borrar"
    style={{ width: 34, height: 34, border: '1px solid #FECACA', borderRadius: 8, background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>🗑</button>
}
function SectionHead({ title, hint }: { title: string; hint: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0d0f12' }}>{title}</div>
      <div style={{ fontSize: 12, color: '#9ca3af' }}>{hint}</div>
    </div>
  )
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: '#9ca3af', padding: '6px 0' }}>{children}</div>
}
