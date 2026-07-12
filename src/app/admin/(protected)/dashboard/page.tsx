'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'

// Dashboard "Mi perfil": info del agente (editable inline), material de
// impresión guardado (rótulos/tarjetas) y propiedades asignadas en el CRM.
// La info vive en `users` (la misma que consumen firmas, tarjetas y rótulos).

const CLOUD = 'dlgrhr6lh', PRESET = 'firmas' // Cloudinary — mismo que PropTools

// ── Íconos ──────────────────────────────────────────────────
const ic = (d: string, fill = false) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'}
    stroke={fill ? 'none' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }}><path d={d} /></svg>
)
const ICONS: Record<string, React.ReactNode> = {
  email:     ic('M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2 8 6 8-6'),
  whatsapp:  ic('M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm5.1 14.3c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.5-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.4.2.5.7 1.8.8 1.9.1.1.1.3 0 .5-.3.6-.7.9-.5 1.2.7 1.2 1.6 2 2.8 2.6.3.2.5.1.7-.1.2-.2.8-.9 1-1.2.2-.3.4-.2.6-.1.3.1 1.7.8 2 1 .3.2.5.2.5.4 0 .1 0 .7-.3 1.3Z', true),
  phone:     ic('M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3A19.5 19.5 0 0 1 5.2 13 19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2Z'),
  instagram: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ flexShrink: 0 }}><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>,
  facebook:  ic('M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3V2Z', true),
  linkedin:  ic('M20.4 3H3.6A.6.6 0 0 0 3 3.6v16.8a.6.6 0 0 0 .6.6h16.8a.6.6 0 0 0 .6-.6V3.6a.6.6 0 0 0-.6-.6ZM8.3 18.4H5.7V9.7h2.6v8.7ZM7 8.5a1.6 1.6 0 1 1 0-3.1 1.6 1.6 0 0 1 0 3.1Zm11.4 9.9h-2.6v-4.2c0-1 0-2.3-1.4-2.3s-1.6 1.1-1.6 2.2v4.3h-2.6V9.7h2.5v1.2h.1a2.7 2.7 0 0 1 2.4-1.3c2.6 0 3.2 1.7 3.2 4v4.8Z', true),
  tiktok:    ic('M19.6 6.7a4.8 4.8 0 0 1-3.8-4.3V2h-3.3v13.2a2.8 2.8 0 1 1-2-2.7V9.1a6.1 6.1 0 1 0 5.3 6V8.9a8 8 0 0 0 3.8 1V6.7Z', true),
}

interface Profile {
  id: string; tenant_id: string; name: string | null; job_title: string | null
  email: string | null; phone: string | null; whatsapp: string | null
  instagram: string | null; facebook: string | null; linkedin: string | null
  tiktok: string | null; photo_url: string | null
}
interface Saved { id: string; save_name: string | null; updated_at: string | null; created_at: string | null; kind: 'rotulos' | 'tarjetas' }
interface Prop { id: string; title: string | null; price: number | null; currency: string | null; crm_status: string | null; status: string | null; images: string[] | null; address: string | null }

// ── Saludo + fecha/reloj + clima ────────────────────────────
// Clima: Open-Meteo (gratis, sin key, CORS abierto). Zona horaria y
// ubicación se guardan en localStorage; también puede usar la ubicación
// actual del navegador.
function weatherEmoji(code: number) {
  if (code === 0) return '☀️'
  if (code <= 2) return '🌤️'
  if (code === 3) return '☁️'
  if (code <= 48) return '🌫️'
  if (code <= 67) return '🌦️'
  if (code <= 77) return '🌨️'
  if (code <= 82) return '🌧️'
  return '⛈️'
}

interface ClimaCfg { tz?: string; lat?: number; lon?: number; label?: string }

function Greeting({ name }: { name: string | null }) {
  const [now, setNow] = useState<Date | null>(null)
  const [cfg, setCfg] = useState<ClimaCfg>({})
  const [weather, setWeather] = useState<{ t: number; code: number } | null>(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [zones, setZones] = useState<string[]>([])

  useEffect(() => {
    setNow(new Date())
    const i = setInterval(() => setNow(new Date()), 1000)
    try { setCfg(JSON.parse(localStorage.getItem('dash_clima') || 'null') ?? {}) } catch { /* ignorar */ }
    try { setZones((Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone')) } catch { /* select queda vacío */ }
    return () => clearInterval(i)
  }, [])

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`)
      const j = await r.json()
      if (j.current) setWeather({ t: Math.round(j.current.temperature_2m), code: j.current.weather_code })
    } catch { /* sin clima */ }
  }, [])

  function save(c: ClimaCfg) { setCfg(c); localStorage.setItem('dash_clima', JSON.stringify(c)) }

  useEffect(() => {
    if (cfg.lat != null && cfg.lon != null) { fetchWeather(cfg.lat, cfg.lon); return }
    // sin ubicación guardada → intentar la actual del navegador
    navigator.geolocation?.getCurrentPosition(pos => {
      const c = { ...cfg, lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'Mi ubicación' }
      setCfg(c); localStorage.setItem('dash_clima', JSON.stringify(c))
    }, () => { /* denegado — se puede elegir zona con ⚙ */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.lat, cfg.lon, fetchWeather])

  async function searchCity() {
    if (!q.trim()) return
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=1&language=es`)
      const j = await r.json()
      const g = j.results?.[0]
      if (g) { save({ ...cfg, lat: g.latitude, lon: g.longitude, label: g.name, tz: cfg.tz || g.timezone }); setQ('') }
    } catch { /* sin resultados */ }
  }

  const tz = cfg.tz || undefined
  const hour = now ? Number(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: tz })) : 12
  const saludo = hour < 12 ? 'buenos días' : hour < 18 ? 'buenas tardes' : 'buenas noches'
  const firstName = (name || '').trim().split(/\s+/)[0]

  return (
    <div style={{ marginBottom: 20, position: 'relative' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>
        Hola{firstName ? ` ${firstName}` : ''}, {saludo}
      </h1>
      <p style={{ fontSize: 13, color: '#888', margin: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {now && <>Hoy es {now.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz })}, {now.toLocaleTimeString('es-CR', { timeZone: tz })}</>}
        {weather && <> · {weatherEmoji(weather.code)} {weather.t}°C{cfg.label ? ` ${cfg.label}` : ''}</>}
        <button onClick={() => setOpen(o => !o)} title="Zona horaria y clima"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#b6bcc6', padding: 0 }}>⚙</button>
      </p>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 8, background: '#fff', border: '1px solid #e2e5ea', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.12)', padding: 16, zIndex: 50, width: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9aa1ad', marginBottom: 4 }}>Zona horaria</div>
            <select value={cfg.tz ?? ''} onChange={e => save({ ...cfg, tz: e.target.value || undefined })}
              style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 8, border: '1px solid #e2e5ea', fontFamily: 'inherit' }}>
              <option value="">Automática (del sistema)</option>
              {zones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9aa1ad', marginBottom: 4 }}>Ciudad para el clima</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchCity()}
                placeholder="Ej: San José" style={{ flex: 1, fontSize: 12, padding: '6px 8px', borderRadius: 8, border: '1px solid #e2e5ea', fontFamily: 'inherit', outline: 'none' }} />
              <button onClick={searchCity} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: 'none', background: '#111', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Buscar</button>
            </div>
          </div>
          <button onClick={() => { localStorage.removeItem('dash_clima'); setCfg({}); setWeather(null) }}
            style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e5ea', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>
            📍 Usar mi ubicación actual
          </button>
        </div>
      )}
    </div>
  )
}

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

  // Email | WhatsApp | Teléfono / Instagram | Facebook / LinkedIn | TikTok
  const contactFields: { key: keyof Profile; label: string; span: number }[] = [
    { key: 'email',     label: 'Email',     span: 2 },
    { key: 'whatsapp',  label: 'WhatsApp',  span: 2 },
    { key: 'phone',     label: 'Teléfono',  span: 2 },
    { key: 'instagram', label: 'Instagram', span: 3 },
    { key: 'facebook',  label: 'Facebook',  span: 3 },
    { key: 'linkedin',  label: 'LinkedIn',  span: 3 },
    { key: 'tiktok',    label: 'TikTok',    span: 3 },
  ]
  const card: React.CSSProperties = { background: '#fff', border: '1px solid #ececf0', borderRadius: 14, padding: 24 }
  const sectionTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: '#111', margin: '0 0 14px' }

  return (
    // degradado gris→blanco en todo el espacio de contenido (bleed sobre el
    // padding 36/44 del shell)
    // blanco hasta donde termina la foto (~490px), gris hacia abajo
    <div style={{ margin: '-36px -44px', padding: '36px 44px', minHeight: 'calc(100vh - 54px)', background: 'linear-gradient(180deg, #ffffff 0px, #ffffff 490px, #e4e7ec 100%)' }}>
      <style>{`.pf-edit:hover::after { content: ' ✎'; font-size: .85em; color: #c5cad3 }`}</style>
      <Greeting name={profile.name} />

      {/* ── Agente — foto flotante directo sobre el degradado de la página ── */}
      <div style={{ padding: '10px 4px 0', display: 'flex', gap: 28, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div onClick={() => fileRef.current?.click()} title="Click para cambiar la foto"
          style={{ width: 340, height: 410, marginBottom: -110, background: profile.photo_url ? 'transparent' : 'rgba(255,255,255,.55)', borderRadius: profile.photo_url ? 0 : 16, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', position: 'relative' }}>
          {profile.photo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={profile.photo_url} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
            : <span style={{ fontSize: 54, color: '#c5cad3', alignSelf: 'center' }}>👤</span>}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10 }}>
            {contactFields.map(({ key, label, span }) => (
              <div key={key} style={{ gridColumn: `span ${span}`, background: 'rgba(255,255,255,.65)', borderRadius: 10, padding: '9px 13px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, color: '#9aa1ad', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>
                  {ICONS[key]}{label}
                </div>
                <div style={{ fontSize: 13, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <Editable value={profile[key] as string | null} onSave={v => saveField(key, v)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Material de impresión — top translúcido: la foto se ve detrás ── */}
      <div style={{ ...card, marginBottom: 20, position: 'relative', zIndex: 1, background: 'rgba(255,255,255,.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
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
    </div>
  )
}
