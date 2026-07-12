'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'

// Dashboard "Mi perfil": info del agente (editable inline), material de
// impresión guardado (rótulos/tarjetas) y propiedades asignadas en el CRM.
// La info vive en `users` (la misma que consumen firmas, tarjetas y rótulos).

const CLOUD = 'dlgrhr6lh', PRESET = 'firmas' // Cloudinary — mismo que PropTools

interface Profile {
  id: string; tenant_id: string; name: string | null; job_title: string | null
  email: string | null; phone: string | null; whatsapp: string | null
  instagram: string | null; facebook: string | null; linkedin: string | null
  tiktok: string | null; photo_url: string | null
}
interface Saved { id: string; save_name: string | null; updated_at: string | null; created_at: string | null; kind: 'rotulos' | 'tarjetas' }
interface Prop { id: string; title: string | null; price: number | null; currency: string | null; crm_status: string | null; status: string | null; images: string[] | null; address: string | null }

// ── Texto editable al click ─────────────────────────────────
function Editable({ value, onSave, placeholder = '—', style }: {
  value: string | null; onSave: (v: string) => void; placeholder?: string; style?: React.CSSProperties
}) {
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  function commit() {
    const v = ref.current?.value.trim() ?? ''
    setEditing(false)
    if (v !== (value ?? '')) onSave(v)
  }
  if (editing) return (
    <input ref={ref} autoFocus defaultValue={value ?? ''}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      style={{ font: 'inherit', color: 'inherit', border: '1px solid #ccc', borderRadius: 6, padding: '2px 6px', outline: 'none', width: '100%', boxSizing: 'border-box', background: '#fff', ...style }} />
  )
  return (
    <span className="pf-edit" onClick={() => setEditing(true)} title="Click para editar"
      style={{ cursor: 'text', color: value ? undefined : '#c5cad3', ...style }}>
      {value || placeholder}
    </span>
  )
}

export default function PerfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [material, setMaterial] = useState<Saved[]>([])
  const [props, setProps] = useState<Prop[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    let { data: p } = await sb.from('users').select('*').eq('auth_id', user.id).single()
    if (!p) {
      // admin de PropCLOUD sin fila en users → auto-provisionar (igual que PropTools)
      const { data: adm } = await sb.from('tenant_admins').select('tenant_id, role').eq('user_id', user.id).single()
      if (adm) {
        await sb.from('users').upsert({
          auth_id: user.id, tenant_id: adm.tenant_id, email: user.email,
          name: user.email?.split('@')[0] || 'Admin',
          role: adm.role === 'admin' ? 'admin' : 'agent',
        }, { onConflict: 'auth_id' })
        ;({ data: p } = await sb.from('users').select('*').eq('auth_id', user.id).single())
      }
    }
    if (!p) { setLoading(false); return }
    setProfile(p)

    const [rot, tar] = await Promise.all([
      sb.from('rotulos').select('id,save_name,updated_at,created_at').eq('user_id', p.id).order('updated_at', { ascending: false }),
      sb.from('tarjetas').select('id,save_name,updated_at,created_at').eq('user_id', p.id).order('updated_at', { ascending: false }),
    ])
    setMaterial([
      ...(rot.data ?? []).map(r => ({ ...r, kind: 'rotulos' as const })),
      ...(tar.data ?? []).map(t => ({ ...t, kind: 'tarjetas' as const })),
    ].sort((a, b) => (b.updated_at ?? b.created_at ?? '').localeCompare(a.updated_at ?? a.created_at ?? '')))

    // ponytail: agente web ↔ usuario PropTools se cruzan por email; si más
    // adelante hay FK directa users↔agents, cambiar este match.
    if (p.email) {
      const { data: ags } = await sb.from('agents').select('id').eq('tenant_id', p.tenant_id).ilike('email', p.email)
      if (ags && ags.length > 0) {
        const { data: pr } = await sb.from('properties')
          .select('id,title,price,currency,crm_status,status,images,address')
          .in('agent_id', ags.map(a => a.id))
          .order('created_at', { ascending: false })
        setProps(pr ?? [])
      }
    }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function saveField(key: keyof Profile, v: string) {
    if (!profile) return
    setProfile({ ...profile, [key]: v || null })
    await createClient().from('users').update({ [key]: v || null }).eq('id', profile.id)
  }

  async function uploadPhoto(file: File) {
    if (!profile) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file); fd.append('upload_preset', PRESET)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: 'POST', body: fd })
      const json = await res.json()
      if (json.secure_url) await saveField('photo_url', json.secure_url)
    } finally { setUploading(false) }
  }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#aaa', fontSize: 13 }}>Cargando…</div>
  if (!profile) return <div style={{ padding: 60, textAlign: 'center', color: '#e53e3e', fontSize: 13 }}>No se encontró tu perfil.</div>

  const contactFields: { key: keyof Profile; label: string }[] = [
    { key: 'email', label: '✉ Email' }, { key: 'phone', label: '☎ Teléfono' },
    { key: 'whatsapp', label: '💬 WhatsApp' }, { key: 'instagram', label: 'Instagram' },
    { key: 'facebook', label: 'Facebook' }, { key: 'linkedin', label: 'LinkedIn' }, { key: 'tiktok', label: 'TikTok' },
  ]
  const card: React.CSSProperties = { background: '#fff', border: '1px solid #ececf0', borderRadius: 14, padding: 24 }
  const sectionTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: '#111', margin: '0 0 14px' }

  return (
    <>
      <style>{`.pf-edit:hover::after { content: ' ✎'; font-size: .85em; color: #c5cad3 }`}</style>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>Mi perfil</h1>
        <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>Tu información de agente — se usa en firmas, tarjetas, rótulos, CRM y web. Hacé click en un dato para editarlo.</p>
      </div>

      {/* ── Agente ─────────────────────────────────────────── */}
      <div style={{ ...card, display: 'flex', gap: 28, marginBottom: 20, flexWrap: 'wrap' }}>
        <div onClick={() => fileRef.current?.click()} title="Click para cambiar la foto"
          style={{ width: 150, height: 150, borderRadius: 14, background: '#f5f5f7', cursor: 'pointer', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {profile.photo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={profile.photo_url} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 40, color: '#c5cad3' }}>👤</span>}
          {uploading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#666' }}>Subiendo…</div>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = '' }} />

        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#111', marginBottom: 2 }}>
            <Editable value={profile.name} placeholder="Tu nombre" onSave={v => saveField('name', v)} />
          </div>
          <div style={{ fontSize: 14, color: '#888', marginBottom: 16 }}>
            <Editable value={profile.job_title} placeholder="Puesto" onSave={v => saveField('job_title', v)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {contactFields.map(({ key, label }) => (
              <div key={key} style={{ background: '#f7f8fa', borderRadius: 10, padding: '9px 13px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#9aa1ad', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, color: '#111' }}>
                  <Editable value={profile[key] as string | null} onSave={v => saveField(key, v)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Material de impresión ──────────────────────────── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <h2 style={sectionTitle}>Material de impresión</h2>
        {material.length === 0
          ? <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>Sin material guardado aún — creá rótulos y tarjetas desde el menú PropTools.</p>
          : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {material.map(m => (
                <a key={`${m.kind}-${m.id}`} href={`/admin/tools/${m.kind}?id=${m.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f7f8fa', borderRadius: 10, padding: '10px 16px', textDecoration: 'none', color: '#111', border: '1px solid transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#d5d9e0')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}>
                  <span style={{ fontSize: 18 }}>{m.kind === 'rotulos' ? '🪧' : '💳'}</span>
                  <span>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{m.save_name || (m.kind === 'rotulos' ? 'Rótulo' : 'Tarjeta')}</span>
                    <span style={{ display: 'block', fontSize: 11, color: '#9aa1ad' }}>
                      {m.kind === 'rotulos' ? 'Rótulo' : 'Tarjeta'} · {new Date(m.updated_at ?? m.created_at ?? '').toLocaleDateString('es-CR')}
                    </span>
                  </span>
                </a>
              ))}
            </div>
          )}
      </div>

      {/* ── Propiedades asignadas ──────────────────────────── */}
      <div style={card}>
        <h2 style={sectionTitle}>Propiedades asignadas</h2>
        {props.length === 0
          ? <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>Sin propiedades asignadas.</p>
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {props.map(p => (
                <a key={p.id} href={`/admin/propiedades/${p.id}`}
                  style={{ background: '#f7f8fa', borderRadius: 12, overflow: 'hidden', textDecoration: 'none', color: '#111', border: '1px solid transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#d5d9e0')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}>
                  <div style={{ height: 130, background: '#e8eaee' }}>
                    {p.images?.[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    )}
                  </div>
                  <div style={{ padding: '10px 13px' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>{p.crm_status || p.status || ''}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || 'Propiedad'}</div>
                    <div style={{ fontSize: 13, color: '#374151' }}>
                      {p.price != null ? `${p.currency === 'CRC' ? '₡' : '$'}${Number(p.price).toLocaleString()}` : ''}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
      </div>
    </>
  )
}
