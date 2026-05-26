'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

interface Agent {
  id: string; name: string; email: string | null; phone: string | null
  whatsapp: string | null; photo_url: string | null; bio: string | null; is_active: boolean
}

const emptyAgent = (): Omit<Agent, 'id' | 'is_active'> =>
  ({ name: '', email: '', phone: '', whatsapp: '', photo_url: '', bio: '' })

export default function AgentesPage() {
  const [loading, setLoading] = useState(true)
  const [tenantId, setTenantId] = useState('')
  const [agents, setAgents] = useState<Agent[]>([])
  const [editing, setEditing] = useState<Agent | null>(null)
  const [form, setForm] = useState(emptyAgent())
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load(tid: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('agents').select('*').eq('tenant_id', tid).order('name')
    setAgents(data ?? [])
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

  function openNew() { setEditing(null); setForm(emptyAgent()); setShowForm(true) }
  function openEdit(a: Agent) { setEditing(a); setForm({ name: a.name, email: a.email ?? '', phone: a.phone ?? '', whatsapp: a.whatsapp ?? '', photo_url: a.photo_url ?? '', bio: a.bio ?? '' }); setShowForm(true) }
  function cancel() { setShowForm(false); setEditing(null) }

  async function saveAgent(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const payload = {
      tenant_id: tenantId,
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      photo_url: form.photo_url || null,
      bio: form.bio || null,
    }
    if (editing) {
      await supabase.from('agents').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('agents').insert(payload)
    }
    await load(tenantId)
    setSaving(false); cancel()
  }

  async function toggleActive(a: Agent) {
    const supabase = createClient()
    await supabase.from('agents').update({ is_active: !a.is_active }).eq('id', a.id)
    setAgents(prev => prev.map(x => x.id === a.id ? { ...x, is_active: !x.is_active } : x))
  }

  async function deleteAgent(id: string) {
    if (!confirm('¿Eliminar este agente?')) return
    const supabase = createClient()
    await supabase.from('agents').delete().eq('id', id)
    setAgents(prev => prev.filter(a => a.id !== id))
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  if (loading) return <PageLoader />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 6px' }}>Agentes</h1>
          <p style={{ fontSize: 14, color: '#888', margin: 0 }}>Gestión del equipo de agentes inmobiliarios</p>
        </div>
        {!showForm && (
          <button onClick={openNew} style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Nuevo agente
          </button>
        )}
      </div>

      {/* Agent form */}
      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: '24px', border: '1px solid #ebebeb', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 20 }}>
            {editing ? 'Editar agente' : 'Nuevo agente'}
          </div>
          <form onSubmit={saveAgent}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Nombre *"><input value={form.name} onChange={f('name')} required style={inputStyle} /></Field>
              <Field label="Email"><input type="email" value={form.email ?? ''} onChange={f('email')} style={inputStyle} /></Field>
              <Field label="Teléfono"><input value={form.phone ?? ''} onChange={f('phone')} placeholder="+506 8888 8888" style={inputStyle} /></Field>
              <Field label="WhatsApp (sin + ni espacios)"><input value={form.whatsapp ?? ''} onChange={f('whatsapp')} placeholder="50688888888" style={inputStyle} /></Field>
              <Field label="URL de foto" ><input value={form.photo_url ?? ''} onChange={f('photo_url')} placeholder="https://..." style={inputStyle} /></Field>
            </div>
            <Field label="Bio">
              <textarea value={form.bio ?? ''} onChange={f('bio')} rows={3}
                style={{ ...inputStyle, resize: 'vertical' }} />
            </Field>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button type="submit" disabled={saving} style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>
                {saving ? 'Guardando…' : (editing ? 'Guardar cambios' : 'Agregar agente')}
              </button>
              <button type="button" onClick={cancel} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 10, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Agent list */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #ebebeb', overflow: 'hidden' }}>
        {agents.length === 0 ? (
          <div style={{ padding: '32px 24px', textAlign: 'center', color: '#aaa', fontSize: 14 }}>
            No hay agentes registrados
          </div>
        ) : (
          agents.map((a, i) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', gap: 14, borderTop: i > 0 ? '1px solid #f0f0f0' : 'none' }}>
              {/* Avatar */}
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f0f0f0', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                {a.photo_url ? <img src={a.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{a.name}</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 1 }}>{[a.email, a.phone].filter(Boolean).join(' · ')}</div>
              </div>
              {/* Active toggle */}
              <div onClick={() => toggleActive(a)} style={{ width: 40, height: 22, borderRadius: 11, background: a.is_active ? '#111' : '#e0e0e0', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: a.is_active ? 21 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
              {/* Actions */}
              <button onClick={() => openEdit(a)} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Editar</button>
              <button onClick={() => deleteAgent(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 16, padding: '0 4px' }}>✕</button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>{label}</label>{children}</div>
}
function PageLoader() { return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div> }
const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #e0e0e0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
