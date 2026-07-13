'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import PageHeader from '@/components/admin/PageHeader'

// Agentes = usuarios (PropTools). Esta página controla su ficha pública y el
// toggle "Mostrar en web" (users.show_on_web). Los agentes se agregan por
// invitación (Administración › Agentes), no acá.

const CLOUD = 'dlgrhr6lh', PRESET = 'firmas' // Cloudinary — mismo que el dashboard/tools
const POSITIONS = ['Broker', 'Team Leader', 'Asesor Inmobiliario', 'Administrativo', 'Asistente'] as const

interface AgentUser {
  id: string
  name: string | null
  job_title: string | null
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
  bio: string | null
  show_on_web: boolean
}

const emptyForm = () => ({
  name: '', job_title: '', phone: '', photo_url: '', bio: '',
  instagram: '', facebook: '', linkedin: '', tiktok: '', twitter: '', youtube: '', threads: '',
})

export default function AgentesPage() {
  const [loading,  setLoading]  = useState(true)
  const [agents,   setAgents]   = useState<AgentUser[]>([])
  const [editing,  setEditing]  = useState<AgentUser | null>(null)
  const [form,     setForm]     = useState(emptyForm())
  const [saving,   setSaving]   = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  async function load(tid: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('users')
      .select('id,name,job_title,email,phone,photo_url,instagram,facebook,linkedin,tiktok,twitter,youtube,threads,bio,show_on_web')
      .eq('tenant_id', tid).order('name')
    setAgents((data ?? []) as AgentUser[])
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: adminRec } = await supabase
        .from('tenant_admins').select('tenant_id').eq('user_id', user.id).single()
      if (!adminRec) return
      await load(adminRec.tenant_id)
      setLoading(false)
    })
  }, [])

  function openEdit(a: AgentUser) {
    setEditing(a)
    setForm({
      name: a.name ?? '', job_title: a.job_title ?? '', phone: a.phone ?? '', photo_url: a.photo_url ?? '', bio: a.bio ?? '',
      instagram: a.instagram ?? '', facebook: a.facebook ?? '', linkedin: a.linkedin ?? '',
      tiktok: a.tiktok ?? '', twitter: a.twitter ?? '', youtube: a.youtube ?? '', threads: a.threads ?? '',
    })
    setPhotoFile(null)
    setPhotoPreview(a.photo_url ?? null)
    setSaveError(null)
  }
  function cancel() { setEditing(null) }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function toggleWeb(a: AgentUser) {
    const supabase = createClient()
    const next = !a.show_on_web
    setAgents(prev => prev.map(x => x.id === a.id ? { ...x, show_on_web: next } : x))
    await supabase.from('users').update({ show_on_web: next }).eq('id', a.id)
  }

  async function saveAgent(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setSaving(true); setSaveError(null)
    const supabase = createClient()

    let photoUrl = form.photo_url || null
    if (photoFile) {
      setUploadingPhoto(true)
      try {
        const fd = new FormData()
        fd.append('file', photoFile); fd.append('upload_preset', PRESET)
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: 'POST', body: fd })
        const json = await res.json()
        if (json.secure_url) photoUrl = json.secure_url
      } finally { setUploadingPhoto(false) }
    }

    const payload = {
      name: form.name.trim(),
      job_title: form.job_title || null,
      phone: form.phone.trim() || null,
      photo_url: photoUrl,
      bio: form.bio.trim() || null,
      instagram: form.instagram.trim() || null,
      facebook:  form.facebook.trim()  || null,
      linkedin:  form.linkedin.trim()  || null,
      tiktok:    form.tiktok.trim()    || null,
      twitter:   form.twitter.trim()   || null,
      youtube:   form.youtube.trim()   || null,
      threads:   form.threads.trim()   || null,
    }
    const { error } = await supabase.from('users').update(payload).eq('id', editing.id)
    if (error) { setSaveError(`Error: ${error.message}`); setSaving(false); return }

    setAgents(prev => prev.map(x => x.id === editing.id ? { ...x, ...payload } : x))
    setSaving(false)
    cancel()
  }

  if (loading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>

  const visibles = agents.filter(a => a.show_on_web).length

  return (
    <div>
      <PageHeader title="Agentes"
        subtitle={`${agents.length} agente${agents.length !== 1 ? 's' : ''} · ${visibles} en el sitio web`}
        right={
          <a href="/admin/tools/admin?tab=agentes"
            style={{ background: 'var(--color-primary, #111)', color: '#fff', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, textDecoration: 'none', fontFamily: 'inherit' }}>
            + Invitar agente
          </a>
        } />

      {/* Edit form */}
      {editing && (
        <div style={{ background: '#fff', borderRadius: 12, padding: '28px 28px 24px', border: '1px solid #ebebeb', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 4 }}>Editar agente</div>
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 24 }}>{editing.email}</div>
          <form onSubmit={saveAgent}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 28, alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div onClick={() => photoInputRef.current?.click()}
                  style={{ width: 96, height: 96, borderRadius: '50%', background: '#f5f5f7', border: '2px dashed #e0e0e0', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {photoPreview ? <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 28 }}>👤</span>}
                </div>
                <button type="button" onClick={() => photoInputRef.current?.click()}
                  style={{ fontSize: 11, color: '#888', background: 'none', border: '1px solid #e0e0e0', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {photoPreview ? 'Cambiar' : 'Subir foto'}
                </button>
                <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Nombre *">
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="Nombre completo" style={inputSt} />
                </Field>
                <Field label="Puesto">
                  <select value={form.job_title} onChange={e => setForm(p => ({ ...p, job_title: e.target.value }))} style={inputSt}>
                    <option value="">Seleccionar…</option>
                    {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                  </select>
                </Field>
                <Field label="Teléfono">
                  <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+506 8888-8888" style={inputSt} />
                </Field>
                <Field label="Bio">
                  <input value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} placeholder="Breve descripción" style={inputSt} />
                </Field>
              </div>
            </div>

            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>
                Redes sociales <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(URL completa)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[
                  { key: 'instagram', label: '📸 Instagram' }, { key: 'facebook', label: '👥 Facebook' },
                  { key: 'linkedin', label: 'in LinkedIn' }, { key: 'tiktok', label: '♪ TikTok' },
                  { key: 'twitter', label: '𝕏 X / Twitter' }, { key: 'youtube', label: '▶ YouTube' }, { key: 'threads', label: '@ Threads' },
                ].map(({ key, label }) => (
                  <Field key={key} label={label}>
                    <input value={form[key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder="https://..." style={inputSt} />
                  </Field>
                ))}
              </div>
            </div>

            {saveError && <div style={{ marginTop: 16, padding: '10px 14px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#e53e3e' }}>{saveError}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" disabled={saving || uploadingPhoto}
                style={{ background: 'var(--color-primary, #111)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: (saving || uploadingPhoto) ? 'not-allowed' : 'pointer', opacity: (saving || uploadingPhoto) ? 0.7 : 1, fontFamily: 'inherit' }}>
                {uploadingPhoto ? 'Subiendo foto…' : saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button type="button" onClick={cancel}
                style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 10, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#555' }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {agents.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '60px 24px', border: '1px solid #ebebeb', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
          <p style={{ fontSize: 14, color: '#aaa', margin: 0 }}>Aún no hay agentes. Invitá agentes desde Administración.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 180px 200px 150px 130px 80px', gap: 12, padding: '8px 16px', fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.07em' }}>
            <span></span><span>Nombre</span><span>Puesto</span><span>Email</span><span>Teléfono</span><span style={{ textAlign: 'center' }}>Mostrar en web</span><span></span>
          </div>
          {agents.map(a => (
            <div key={a.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #ebebeb' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 180px 200px 150px 130px 80px', gap: 12, padding: '14px 16px', alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f0f0f0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {a.photo_url ? <img src={a.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{a.name || '—'}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{a.job_title ?? '—'}</div>
                <div style={{ fontSize: 12, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.email ?? '—'}</div>
                <div style={{ fontSize: 12, color: '#555' }}>{a.phone ?? '—'}</div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div onClick={() => toggleWeb(a)} title={a.show_on_web ? 'Visible en el sitio' : 'Oculto en el sitio'}
                    style={{ width: 40, height: 22, borderRadius: 11, background: a.show_on_web ? '#111' : '#e0e0e0', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background .2s' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: a.show_on_web ? 21 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                  </div>
                </div>
                <button onClick={() => openEdit(a)}
                  style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#555' }}>Editar</button>
              </div>
            </div>
          ))}
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
