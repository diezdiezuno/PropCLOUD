'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const POSITIONS = ['Broker', 'Team Leader', 'Asesor Inmobiliario', 'Administrativo', 'Asistente'] as const
type Position = typeof POSITIONS[number]

interface Agent {
  id: string
  name: string
  position: Position | null
  email: string | null
  phone: string | null
  photo_url: string | null
  instagram: string | null
  facebook: string | null
  linkedin: string | null
  tiktok: string | null
  twitter: string | null
  youtube: string | null
  threads: string | null
  is_active: boolean
}

const emptyForm = () => ({
  name: '', position: '' as Position | '', email: '', phone: '', photo_url: '',
  instagram: '', facebook: '', linkedin: '', tiktok: '', twitter: '', youtube: '', threads: '',
})

export default function AgentesPage() {
  const [loading,  setLoading]  = useState(true)
  const [tenantId, setTenantId] = useState('')
  const [agents,   setAgents]   = useState<Agent[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState<Agent | null>(null)
  const [form,     setForm]     = useState(emptyForm())
  const [saving,   setSaving]   = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  async function load(tid: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('agents').select('*').eq('tenant_id', tid).order('name')
    setAgents((data ?? []) as Agent[])
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

  function openNew() {
    setEditing(null)
    setForm(emptyForm())
    setPhotoFile(null)
    setPhotoPreview(null)
    setShowForm(true)
  }

  function openEdit(a: Agent) {
    setEditing(a)
    setForm({
      name: a.name, position: a.position ?? '', email: a.email ?? '', phone: a.phone ?? '', photo_url: a.photo_url ?? '',
      instagram: a.instagram ?? '', facebook: a.facebook ?? '', linkedin: a.linkedin ?? '',
      tiktok: a.tiktok ?? '', twitter: a.twitter ?? '', youtube: a.youtube ?? '', threads: a.threads ?? '',
    })
    setPhotoFile(null)
    setPhotoPreview(a.photo_url ?? null)
    setShowForm(true)
  }

  function cancel() { setShowForm(false); setEditing(null) }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function saveAgent(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    const supabase = createClient()

    let photoUrl = form.photo_url || null

    // Upload photo if a new file was selected
    if (photoFile) {
      setUploadingPhoto(true)
      const ext = photoFile.name.split('.').pop()
      const path = `${tenantId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('agent-photos')
        .upload(path, photoFile, { upsert: true })
      if (uploadError) {
        console.error('[agent-photos] upload error:', uploadError)
        setSaveError(`Error al subir foto: ${uploadError.message}`)
        setSaving(false)
        setUploadingPhoto(false)
        return
      }
      const { data: urlData } = supabase.storage.from('agent-photos').getPublicUrl(path)
      photoUrl = urlData.publicUrl
      setUploadingPhoto(false)
    }

    const payload = {
      tenant_id: tenantId,
      name: form.name.trim(),
      position: form.position || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      photo_url: photoUrl,
      instagram: form.instagram.trim() || null,
      facebook:  form.facebook.trim()  || null,
      linkedin:  form.linkedin.trim()  || null,
      tiktok:    form.tiktok.trim()    || null,
      twitter:   form.twitter.trim()   || null,
      youtube:   form.youtube.trim()   || null,
      threads:   form.threads.trim()   || null,
    }

    let dbError
    if (editing) {
      const { error } = await supabase.from('agents').update(payload).eq('id', editing.id)
      dbError = error
    } else {
      const { error } = await supabase.from('agents').insert({ ...payload, is_active: true })
      dbError = error
    }

    if (dbError) {
      console.error('[agents] save error:', dbError)
      setSaveError(`Error: ${dbError.message}`)
      setSaving(false)
      return
    }

    await load(tenantId)
    setSaving(false)
    cancel()
  }

  async function toggleActive(a: Agent) {
    const supabase = createClient()
    await supabase.from('agents').update({ is_active: !a.is_active }).eq('id', a.id)
    setAgents(prev => prev.map(x => x.id === a.id ? { ...x, is_active: !x.is_active } : x))
  }

  async function deleteAgent(id: string) {
    const supabase = createClient()
    await supabase.from('agents').delete().eq('id', id)
    setAgents(prev => prev.filter(a => a.id !== id))
    setConfirmDelete(null)
  }

  if (loading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>Agentes</h1>
          <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>
            {agents.length === 0 ? 'Sin agentes aún.' : `${agents.length} agente${agents.length !== 1 ? 's' : ''} registrado${agents.length !== 1 ? 's' : ''}.`}
          </p>
        </div>
        {!showForm && (
          <button onClick={openNew}
            style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Nuevo agente
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: '28px 28px 24px', border: '1px solid #ebebeb', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 24 }}>
            {editing ? 'Editar agente' : 'Nuevo agente'}
          </div>
          <form onSubmit={saveAgent}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 28, alignItems: 'start' }}>

              {/* Photo upload */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div
                  onClick={() => photoInputRef.current?.click()}
                  style={{
                    width: 96, height: 96, borderRadius: '50%',
                    background: '#f5f5f7', border: '2px dashed #e0e0e0',
                    overflow: 'hidden', cursor: 'pointer', position: 'relative',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'border-color .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#111')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#e0e0e0')}
                >
                  {photoPreview
                    ? <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 28 }}>👤</span>
                  }
                </div>
                <button type="button" onClick={() => photoInputRef.current?.click()}
                  style={{ fontSize: 11, color: '#888', background: 'none', border: '1px solid #e0e0e0', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {photoPreview ? 'Cambiar' : 'Subir foto'}
                </button>
                <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
              </div>

              {/* Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Nombre *">
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    required placeholder="Nombre completo" style={inputSt} />
                </Field>

                <Field label="Puesto">
                  <select value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value as Position | '' }))} style={inputSt}>
                    <option value="">Seleccionar…</option>
                    {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                  </select>
                </Field>

                <Field label="Email">
                  <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="agente@email.com" style={inputSt} />
                </Field>

                <Field label="Teléfono">
                  <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+506 8888-8888" style={inputSt} />
                </Field>
              </div>

            </div>

            {/* Social media — full width below the photo+fields grid */}
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>
                Redes sociales <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(URL completa)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[
                  { key: 'instagram', label: '📸 Instagram' },
                  { key: 'facebook',  label: '👥 Facebook' },
                  { key: 'linkedin',  label: 'in LinkedIn' },
                  { key: 'tiktok',    label: '♪ TikTok' },
                  { key: 'twitter',   label: '𝕏 X / Twitter' },
                  { key: 'youtube',   label: '▶ YouTube' },
                  { key: 'threads',   label: '@ Threads' },
                ].map(({ key, label }) => (
                  <Field key={key} label={label}>
                    <input
                      value={form[key as keyof typeof form] as string}
                      onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder="https://..."
                      style={inputSt}
                    />
                  </Field>
                ))}
              </div>
            </div>

            {saveError && (
              <div style={{ marginTop: 16, padding: '10px 14px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#e53e3e' }}>
                {saveError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" disabled={saving || uploadingPhoto}
                style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: (saving || uploadingPhoto) ? 'not-allowed' : 'pointer', opacity: (saving || uploadingPhoto) ? 0.7 : 1, fontFamily: 'inherit' }}>
                {uploadingPhoto ? 'Subiendo foto…' : saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar agente'}
              </button>
              <button type="button" onClick={cancel}
                style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 10, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#555' }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Agent list */}
      {agents.length === 0 && !showForm ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '60px 24px', border: '1px solid #ebebeb', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
          <p style={{ fontSize: 14, color: '#aaa', margin: 0 }}>Agregá agentes para mostrarlos en el sitio.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Header row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '52px 1fr 160px 200px 160px 96px 88px',
            gap: 12, padding: '8px 16px',
            fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.07em',
          }}>
            <span></span>
            <span>Nombre</span>
            <span>Puesto</span>
            <span>Email</span>
            <span>Teléfono</span>
            <span style={{ textAlign: 'center' }}>Activo</span>
            <span></span>
          </div>

          {agents.map(a => {
            const isConfirming = confirmDelete === a.id
            return (
              <div key={a.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #ebebeb', overflow: 'hidden' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '52px 1fr 160px 200px 160px 96px 88px',
                  gap: 12, padding: '14px 16px', alignItems: 'center',
                }}>
                  {/* Avatar */}
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f0f0f0', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                    {a.photo_url
                      ? <img src={a.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : '👤'
                    }
                  </div>

                  {/* Name */}
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{a.name}</div>

                  {/* Position */}
                  <div style={{ fontSize: 12, color: '#888' }}>{a.position ?? '—'}</div>

                  {/* Email */}
                  <div style={{ fontSize: 12, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.email ?? '—'}</div>

                  {/* Phone */}
                  <div style={{ fontSize: 12, color: '#555' }}>{a.phone ?? '—'}</div>

                  {/* Active toggle */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div onClick={() => toggleActive(a)} style={{ width: 40, height: 22, borderRadius: 11, background: a.is_active ? '#111' : '#e0e0e0', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background .2s' }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: a.is_active ? 21 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button onClick={() => openEdit(a)}
                      style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#555' }}>
                      Editar
                    </button>
                    {!isConfirming ? (
                      <button onClick={() => setConfirmDelete(a.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 16, padding: '0 2px', lineHeight: 1 }}>
                        ✕
                      </button>
                    ) : (
                      <button onClick={() => deleteAgent(a.id)}
                        style={{ background: '#e53e3e', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Sí
                      </button>
                    )}
                    {isConfirming && (
                      <button onClick={() => setConfirmDelete(null)}
                        style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 7, padding: '5px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: '#888' }}>
                        No
                      </button>
                    )}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

const inputSt: React.CSSProperties = {
  width: '100%', border: '1px solid #e0e0e0', borderRadius: 8,
  padding: '9px 12px', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff',
}
