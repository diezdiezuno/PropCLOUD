'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import PhoneInput from '@/components/PhoneInput'

/* ── Types ───────────────────────────────────────────────────── */
interface ContactType   { id: string; name: string; color: string }
interface ContactSource { id: string; name: string }
interface DupeContact   { id: string; name: string; last_name: string | null }
interface DupeCompany   { id: string; name: string }
interface Company       { id: string; name: string; trade_name: string | null; cedula_juridica: string | null }
type LookupState        = { type: 'ok' | 'err'; msg: string } | null
interface DocUrl        { path: string; name: string; size: number; uploaded_at: string }

export interface NewOwnerResult {
  type: 'contact' | 'company'
  id: string; name: string; subtitle: string
}

interface Props {
  type:      'contact' | 'company'
  tenantId:  string
  initial?:  string
  onCreated: (owner: NewOwnerResult) => void
  onClose:   () => void
}

/* ── Helpers ─────────────────────────────────────────────────── */
function isValidEmail(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) }

function toTitleCase(str: string) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function normalizeUrl(value: string, network: string): string {
  if (!value) return value
  const v = value.trim()
  if (v.startsWith('http://') || v.startsWith('https://')) return v
  const user = v.startsWith('@') ? v.slice(1) : v
  const bases: Record<string, string> = {
    instagram: `https://www.instagram.com/${user}`,
    linkedin:  `https://www.linkedin.com/in/${user}`,
    facebook:  `https://www.facebook.com/${user}`,
    tiktok:    `https://www.tiktok.com/@${user}`,
    youtube:   `https://www.youtube.com/@${user}`,
    x:         `https://x.com/${user}`,
  }
  return bases[network] || v
}

function formatCedula(val: string, tipo: string): string {
  if (tipo === 'pasaporte') return val
  const v = val.replace(/[^0-9]/g, '')
  if (tipo === 'dimex') {
    if (v.length <= 3) return v
    return v.slice(0, 3) + '-' + v.slice(3, 12)
  }
  if (v.length <= 1) return v
  if (v.length <= 5) return v[0] + '-' + v.slice(1)
  return v[0] + '-' + v.slice(1, 5) + '-' + v.slice(5, 9)
}

function formatCedulaJuridica(val: string): string {
  const v = val.replace(/[^0-9]/g, '')
  if (v.length <= 1) return v
  if (v.length <= 4) return v[0] + '-' + v.slice(1)
  return v[0] + '-' + v.slice(1, 4) + '-' + v.slice(4, 10)
}

function getCedulaPlaceholder(tipo: string): string {
  if (tipo === 'dimex')     return '123-456789012'
  if (tipo === 'pasaporte') return 'A12345678'
  return '1-2345-6789'
}
function getCedulaMaxLength(tipo: string): number {
  if (tipo === 'dimex')     return 13
  if (tipo === 'pasaporte') return 20
  return 11
}
function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/* ── Style helpers ───────────────────────────────────────────── */
const inputSt: React.CSSProperties = {
  height: 38, width: '100%', border: '1px solid #e2e5ea', borderRadius: 8,
  padding: '0 12px', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff',
  color: '#0d0f12',
}
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color: '#5a6070', marginBottom: 5 }}>
      {children}{required && <span style={{ color: '#e53e3e', marginLeft: 2 }}>*</span>}
    </div>
  )
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', margin: '20px 0 12px', paddingBottom: 8, borderBottom: '1px solid #e2e5ea' }}>
      {children}
    </div>
  )
}
const lookupBtnSt: React.CSSProperties = {
  height: 38, padding: '0 14px', border: '1px solid #e2e5ea', borderRadius: 8,
  fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
  background: '#f4f5f7', color: '#0d0f12', cursor: 'pointer',
  whiteSpace: 'nowrap', flexShrink: 0,
}

/* ── Social icons ────────────────────────────────────────────── */
const IgIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="ig2" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor="#f09433"/>
        <stop offset="50%" stopColor="#dc2743"/>
        <stop offset="100%" stopColor="#bc1888"/>
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig2)" strokeWidth="2"/>
    <circle cx="12" cy="12" r="4.5" stroke="url(#ig2)" strokeWidth="2"/>
    <circle cx="17.5" cy="6.5" r="1.2" fill="url(#ig2)"/>
  </svg>
)
const FbIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)
const TkIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="#0d0f12">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.85a8.29 8.29 0 004.83 1.53V6.95a4.84 4.84 0 01-1.06-.26z"/>
  </svg>
)
const LiIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="#0A66C2">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
)
const YtIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="#FF0000">
    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
)
const XIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24">
    <rect width="24" height="24" rx="4" fill="#000"/>
    <path d="M17.75 4h-2.3L12 8.5 8.8 4H4l5.25 7L4 20h2.3L10 15l3.5 5H18l-5.5-7.5L17.75 4z" fill="#fff"/>
  </svg>
)

/* ══════════════════════════════════════════════════════════════
   CONTACT FORM — idéntico al formulario de Clientes
══════════════════════════════════════════════════════════════ */
function ContactForm({ tenantId, initial, onCreated, onClose }: Omit<Props, 'type'>) {
  const [types,   setTypes]   = useState<ContactType[]>([])
  const [sources, setSources] = useState<ContactSource[]>([])

  /* Identification */
  const [cedulaTipo,    setCedulaTipo]    = useState('fisica')
  const [cedula,        setCedula]        = useState('')
  const [lookupResult,  setLookupResult]  = useState<LookupState>(null)
  const [lookingUp,     setLookingUp]     = useState(false)
  const [cedulaDupe,    setCedulaDupe]    = useState<DupeContact | null>(null)

  /* Personal */
  const [name,       setName]       = useState(initial ?? '')
  const [lastName,   setLastName]   = useState('')
  const [birthDate,  setBirthDate]  = useState('')
  const [typeId,     setTypeId]     = useState('')
  const [sourceId,   setSourceId]   = useState('')

  /* Photo */
  const [photoFile,    setPhotoFile]    = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const photoInputRef  = useRef<HTMLInputElement>(null)

  /* Contact */
  const [email,           setEmail]           = useState('')
  const [emailError,      setEmailError]      = useState(false)
  const [emailDupe,       setEmailDupe]       = useState<DupeContact | null>(null)
  const [phone,           setPhone]           = useState('')
  const [phoneCountry,    setPhoneCountry]    = useState('CR')
  const [phoneAlt,        setPhoneAlt]        = useState('')
  const [phoneAltCountry, setPhoneAltCountry] = useState('CR')

  /* Company linking */
  const [linkedCompanies, setLinkedCompanies] = useState<Company[]>([])
  const [coSearch,        setCoSearch]        = useState('')
  const [coResults,       setCoResults]       = useState<Company[]>([])
  const [showCoResults,   setShowCoResults]   = useState(false)
  const [coSearching,     setCoSearching]     = useState(false)
  const coSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Social */
  const [instagram, setInstagram] = useState('')
  const [facebook,  setFacebook]  = useState('')
  const [tiktok,    setTiktok]    = useState('')
  const [linkedin,  setLinkedin]  = useState('')
  const [youtube,   setYoutube]   = useState('')
  const [x,         setX]         = useState('')

  /* Notes & docs */
  const [notes,       setNotes]       = useState('')
  const [docFiles,    setDocFiles]    = useState<File[]>([])
  const [docDragging, setDocDragging] = useState(false)
  const docInputRef = useRef<HTMLInputElement>(null)

  /* Save */
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('contact_types').select('id,name,color').eq('tenant_id', tenantId).order('position'),
      sb.from('contact_sources').select('id,name').eq('tenant_id', tenantId).order('position'),
    ]).then(([{ data: t }, { data: s }]) => {
      setTypes((t ?? []) as ContactType[])
      setSources((s ?? []) as ContactSource[])
    })
  }, [tenantId])

  /* ── Hacienda lookup ─────────────────────────────────────── */
  async function lookupCedula() {
    const raw = cedula.replace(/[^0-9]/g, '')
    if (raw.length < 9) { setLookupResult({ type: 'err', msg: 'Mínimo 9 dígitos' }); return }
    setLookingUp(true)
    setLookupResult(null)
    try {
      const r = await fetch(`https://api.hacienda.go.cr/fe/ae?identificacion=${raw}`)
      if (!r.ok) throw new Error()
      const d = await r.json()
      if (d.nombre) {
        const parts = d.nombre.trim().split(/\s+/)
        let n = toTitleCase(d.nombre), ln = ''
        if ((cedulaTipo === 'fisica' || cedulaTipo === 'dimex') && parts.length >= 3) {
          n  = toTitleCase(parts.slice(0, -2).join(' '))
          ln = toTitleCase(parts.slice(-2).join(' '))
        }
        setName(n); setLastName(ln)
        const moroso = d.situacion?.moroso === 'SI' ? ' · ⚠ Moroso en Hacienda' : ''
        setLookupResult({ type: 'ok', msg: `✓ ${toTitleCase(d.nombre)}${moroso}` })
      } else {
        setLookupResult({ type: 'err', msg: 'No encontrado — completá manualmente' })
      }
    } catch {
      setLookupResult({ type: 'err', msg: 'Sin resultado — completá manualmente' })
    }
    setLookingUp(false)
  }

  /* ── Dupe checks ─────────────────────────────────────────── */
  async function checkCedulaDupe() {
    const raw = cedula.trim()
    if (!raw) { setCedulaDupe(null); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (createClient() as any)
      .from('crm_contacts').select('id,name,last_name')
      .eq('tenant_id', tenantId).eq('cedula', raw).eq('active', true).limit(1)
    setCedulaDupe(data?.[0] ?? null)
  }

  async function checkEmailDupe() {
    const val = email.trim()
    if (!val || !isValidEmail(val)) { setEmailDupe(null); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (createClient() as any)
      .from('crm_contacts').select('id,name,last_name')
      .eq('tenant_id', tenantId).eq('email', val).eq('active', true).limit(1)
    setEmailDupe(data?.[0] ?? null)
  }

  /* ── Photo ───────────────────────────────────────────────── */
  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('La foto no puede superar 5 MB'); return }
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  /* ── Documents ───────────────────────────────────────────── */
  function addDocFiles(files: File[]) {
    const valid = files.filter(f => {
      if (f.size > 20 * 1024 * 1024) { setError(`${f.name} supera 20 MB`); return false }
      return true
    })
    setDocFiles(prev => [...prev, ...valid])
  }

  /* ── Company search ──────────────────────────────────────── */
  function handleCoSearch(val: string) {
    setCoSearch(val)
    setShowCoResults(true)
    if (coSearchTimer.current) clearTimeout(coSearchTimer.current)
    if (!val.trim()) { setCoResults([]); setShowCoResults(false); return }
    coSearchTimer.current = setTimeout(async () => {
      setCoSearching(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (createClient() as any)
        .from('crm_companies')
        .select('id,name,trade_name,cedula_juridica')
        .eq('tenant_id', tenantId)
        .ilike('name', `%${val}%`)
        .order('name').limit(8)
      const addedIds = new Set(linkedCompanies.map(c => c.id))
      setCoResults(((data ?? []) as Company[]).filter(c => !addedIds.has(c.id)))
      setCoSearching(false)
    }, 250)
  }

  /* ── Social search helper ────────────────────────────────── */
  function searchSocial(network: string) {
    const q = `${name} ${lastName}`.trim()
    window.open(`https://www.google.com/search?q=${encodeURIComponent(q + ' site:' + network + '.com')}`, '_blank')
  }

  /* ── Save ────────────────────────────────────────────────── */
  async function save() {
    setError('')
    if (!name.trim())                      { setError('El nombre es obligatorio.'); return }
    if (!lastName.trim())                  { setError('Los apellidos son obligatorios.'); return }
    if (!email.trim() && !phone.trim())    { setError('Ingresá al menos un email o teléfono.'); return }
    if (email && !isValidEmail(email))     { setEmailError(true); setError('Email inválido.'); return }

    setSaving(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb0 = createClient() as any

    // Final dupe checks
    if (cedula.trim()) {
      const { data } = await sb0.from('crm_contacts').select('id,name,last_name')
        .eq('tenant_id', tenantId).eq('cedula', cedula.trim()).eq('active', true).limit(1)
      if (data?.[0]) {
        setCedulaDupe(data[0]); setSaving(false)
        setError('Ya existe un cliente con esta cédula.'); return
      }
    }
    if (email.trim()) {
      const { data } = await sb0.from('crm_contacts').select('id,name,last_name')
        .eq('tenant_id', tenantId).eq('email', email.trim()).eq('active', true).limit(1)
      if (data?.[0]) {
        setEmailDupe(data[0]); setSaving(false)
        setError('Ya existe un cliente con este email.'); return
      }
    }

    const supabase = createClient()
    const { data: newC, error: dbErr } = await supabase.from('crm_contacts').insert({
      tenant_id:         tenantId,
      name:              name.trim(),
      last_name:         lastName.trim()     || null,
      cedula:            cedula.trim()       || null,
      cedula_tipo:       cedulaTipo,
      birth_date:        birthDate           || null,
      email:             email.trim()        || null,
      phone:             phone.trim()        || null,
      phone_country:     phoneCountry,
      phone_alt:         phoneAlt.trim()     || null,
      phone_alt_country: phoneAltCountry,
      type_id:           typeId             || null,
      source_id:         sourceId           || null,
      instagram:         normalizeUrl(instagram.trim(), 'instagram') || null,
      linkedin:          normalizeUrl(linkedin.trim(),  'linkedin')  || null,
      facebook:          normalizeUrl(facebook.trim(),  'facebook')  || null,
      tiktok:            normalizeUrl(tiktok.trim(),    'tiktok')    || null,
      youtube:           normalizeUrl(youtube.trim(),   'youtube')   || null,
      x:                 normalizeUrl(x.trim(),         'x')         || null,
      notes:             notes.trim()       || null,
      active:            true,
    }).select('id,name,last_name,email,cedula').single()

    if (dbErr) { setError(`Error: ${dbErr.message}`); setSaving(false); return }

    const contactId = newC.id as string

    // Upload photo
    let finalPhotoUrl: string | null = null
    if (photoFile) {
      const ext  = photoFile.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${contactId}/avatar.${ext}`
      const { error: upErr } = await supabase.storage
        .from('contact-photos')
        .upload(path, photoFile, { upsert: true, contentType: photoFile.type || 'image/jpeg' })
      if (!upErr) {
        finalPhotoUrl = supabase.storage.from('contact-photos').getPublicUrl(path).data.publicUrl
      }
    }

    // Upload docs
    const docUrls: DocUrl[] = []
    for (const file of docFiles) {
      const ts      = Date.now()
      const safe    = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path    = `${contactId}/${ts}_${safe}`
      const { error: docErr } = await supabase.storage
        .from('contact-docs').upload(path, file, { contentType: file.type })
      if (!docErr) docUrls.push({ path, name: file.name, size: file.size, uploaded_at: new Date().toISOString() })
    }

    // Update with file URLs
    if (finalPhotoUrl || docUrls.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (createClient() as any).from('crm_contacts').update({
        photo_url: finalPhotoUrl,
        doc_urls:  docUrls,
      }).eq('id', contactId)
    }

    // Link companies
    if (linkedCompanies.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (createClient() as any).from('crm_contact_companies').insert(
        linkedCompanies.map(co => ({ tenant_id: tenantId, contact_id: contactId, company_id: co.id }))
      )
    }

    setSaving(false)
    onCreated({
      type:     'contact',
      id:       contactId,
      name:     [newC.name, newC.last_name].filter(Boolean).join(' '),
      subtitle: newC.email ?? newC.cedula ?? 'Persona física',
    })
  }

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '0 24px 24px' }}>

      {/* ── IDENTIFICACIÓN ───────────────────────────────── */}
      <SectionTitle>Identificación</SectionTitle>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
        {/* Tipo */}
        <div style={{ width: 140 }}>
          <FieldLabel>Tipo</FieldLabel>
          <select value={cedulaTipo}
            onChange={e => { setCedulaTipo(e.target.value); setCedula(''); setCedulaDupe(null); setLookupResult(null) }}
            style={inputSt}>
            <option value="fisica">Física</option>
            <option value="dimex">DIMEX</option>
            <option value="pasaporte">Pasaporte</option>
          </select>
        </div>
        {/* Número */}
        <div style={{ flex: 1 }}>
          <FieldLabel>
            {cedulaTipo === 'dimex' ? 'Número DIMEX' : cedulaTipo === 'pasaporte' ? 'Número de pasaporte' : 'Número de cédula'}
          </FieldLabel>
          <input
            placeholder={getCedulaPlaceholder(cedulaTipo)}
            maxLength={getCedulaMaxLength(cedulaTipo)}
            value={cedula}
            onChange={e => { setCedulaDupe(null); setCedula(formatCedula(e.target.value, cedulaTipo)) }}
            onBlur={checkCedulaDupe}
            onKeyDown={e => { if (e.key === 'Enter' && cedulaTipo !== 'pasaporte') lookupCedula() }}
            style={{ ...inputSt, borderColor: cedulaDupe ? '#FDE68A' : '#e2e5ea', background: cedulaDupe ? '#FFFBEB' : '#fff' }} />
        </div>
        {/* Consultar */}
        {cedulaTipo !== 'pasaporte' && (
          <div style={{ paddingTop: 22 }}>
            <button onClick={lookupCedula} disabled={lookingUp} style={{ ...lookupBtnSt, opacity: lookingUp ? .6 : 1 }}>
              {lookingUp ? '…' : 'Consultar →'}
            </button>
          </div>
        )}
      </div>
      {lookupResult && (
        <div style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, marginBottom: 8, ...(lookupResult.type === 'ok' ? { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' } : { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }) }}>
          {lookupResult.msg}
        </div>
      )}
      {cedulaDupe && (
        <div style={{ fontSize: 12, padding: '7px 10px', borderRadius: 6, marginBottom: 8, background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92610A', display: 'flex', gap: 6 }}>
          ⚠ Ya existe: <strong>{cedulaDupe.name}{cedulaDupe.last_name ? ' ' + cedulaDupe.last_name : ''}</strong>
        </div>
      )}
      <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 4px' }}>Consulta Hacienda CR — autocompleta nombre y apellidos</p>

      {/* ── DATOS PERSONALES ─────────────────────────────── */}
      <SectionTitle>Datos personales</SectionTitle>

      {/* Foto */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, padding: '10px 12px', background: '#f9fafb', borderRadius: 10, border: '1px solid #e2e5ea' }}>
        <div
          onClick={() => photoInputRef.current?.click()}
          style={{ width: 56, height: 56, borderRadius: '50%', border: `2px ${photoPreview ? 'solid #e2e5ea' : 'dashed #d1d5db'}`, cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f5f7', flexShrink: 0 }}>
          {photoPreview
            ? <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 20 }}>📷</span>}
        </div>
        <div>
          <button type="button" onClick={() => photoInputRef.current?.click()}
            style={{ fontSize: 13, fontWeight: 600, color: '#1B6EF3', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', display: 'block', marginBottom: 2 }}>
            {photoPreview ? 'Cambiar foto' : 'Subir foto de perfil'}
          </button>
          {photoPreview && (
            <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview('') }}
              style={{ fontSize: 12, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', display: 'block', marginBottom: 2 }}>
              Quitar foto
            </button>
          )}
          <div style={{ fontSize: 11, color: '#9ca3af' }}>JPG, PNG, WEBP — máx 5 MB</div>
        </div>
        <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={handlePhotoSelect} style={{ display: 'none' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <FieldLabel required>Nombre</FieldLabel>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="María" style={inputSt} autoFocus />
        </div>
        <div>
          <FieldLabel>Apellidos</FieldLabel>
          <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Rodríguez Mora" style={inputSt} />
        </div>
        <div>
          <FieldLabel>Fecha de nacimiento</FieldLabel>
          <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} style={inputSt} />
        </div>
        <div>
          <FieldLabel>Tipo de contacto</FieldLabel>
          <select value={typeId} onChange={e => setTypeId(e.target.value)} style={inputSt}>
            <option value="">Sin tipo</option>
            {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>Fuente / Canal</FieldLabel>
          <select value={sourceId} onChange={e => setSourceId(e.target.value)} style={inputSt}>
            <option value="">Sin fuente</option>
            {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── CONTACTO ─────────────────────────────────────── */}
      <SectionTitle>Contacto</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 }}>
        <div>
          <FieldLabel>Email</FieldLabel>
          <input type="email" placeholder="correo@ejemplo.com" value={email}
            onChange={e => { const v = e.target.value; setEmail(v); setEmailError(v.length > 0 && !isValidEmail(v)); setEmailDupe(null) }}
            onBlur={e => { if (e.target.value && !isValidEmail(e.target.value)) setEmailError(true); checkEmailDupe() }}
            style={{ ...inputSt, borderColor: emailError ? '#fca5a5' : emailDupe ? '#FDE68A' : '#e2e5ea', background: emailError ? '#fef2f2' : emailDupe ? '#FFFBEB' : '#fff' }} />
          {emailError && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>Ingresá un email válido</div>}
          {!emailError && emailDupe && (
            <div style={{ fontSize: 12, padding: '5px 8px', borderRadius: 6, marginTop: 3, background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92610A' }}>
              ⚠ Ya existe: <strong>{emailDupe.name}{emailDupe.last_name ? ' ' + emailDupe.last_name : ''}</strong>
            </div>
          )}
        </div>
        <div>
          <FieldLabel>Teléfono / WhatsApp</FieldLabel>
          <PhoneInput phoneValue={phone} countryIso={phoneCountry}
            onPhoneChange={setPhone} onCountryChange={setPhoneCountry} placeholder="8888-1234" />
        </div>
        <div>
          <FieldLabel>Teléfono alternativo</FieldLabel>
          <PhoneInput phoneValue={phoneAlt} countryIso={phoneAltCountry}
            onPhoneChange={setPhoneAlt} onCountryChange={setPhoneAltCountry} placeholder="2222-0000" />
        </div>
      </div>

      {/* ── EMPRESA/S ─────────────────────────────────────── */}
      <SectionTitle>Empresa{linkedCompanies.length !== 1 ? 's' : ''}</SectionTitle>
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 14, pointerEvents: 'none' }}>{coSearching ? '⏳' : '🔍'}</span>
          <input type="text" placeholder="Buscar empresa por nombre…" value={coSearch}
            onChange={e => handleCoSearch(e.target.value)}
            onFocus={() => { if (coResults.length > 0) setShowCoResults(true) }}
            style={{ ...inputSt, paddingLeft: 36, paddingRight: coSearch ? 36 : 12 }} />
          {coSearch && (
            <button onClick={() => { setCoSearch(''); setCoResults([]); setShowCoResults(false) }}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, padding: 0 }}>✕</button>
          )}
        </div>
        {showCoResults && coResults.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e5ea', borderRadius: 10, boxShadow: '0 8px 20px rgba(0,0,0,.1)', zIndex: 60, overflow: 'hidden', marginTop: 4 }}>
            {coResults.map(co => (
              <div key={co.id} onMouseDown={() => { setLinkedCompanies(prev => [...prev, co]); setCoSearch(''); setCoResults([]); setShowCoResults(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f4f5f7' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#f9fafb'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = ''}>
                <span style={{ fontSize: 16 }}>🏢</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0d0f12' }}>{co.trade_name || co.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>
                    {co.trade_name && <span style={{ marginRight: 6 }}>{co.name}</span>}
                    {co.cedula_juridica && <span style={{ fontFamily: 'monospace' }}>{co.cedula_juridica}</span>}
                  </div>
                </div>
                <span style={{ fontSize: 13, color: '#1B6EF3' }}>＋</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {linkedCompanies.length === 0
        ? <div style={{ padding: '12px 14px', background: '#F9FAFB', borderRadius: 10, border: '1px dashed #e2e5ea', textAlign: 'center', fontSize: 13, color: '#9ca3af', marginBottom: 4 }}>Sin empresa asignada</div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
            {linkedCompanies.map(co => (
              <div key={co.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: '#F9FAFB', borderRadius: 10, border: '1px solid #e2e5ea' }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>🏢</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0d0f12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.trade_name || co.name}</div>
                </div>
                <button onClick={() => setLinkedCompanies(prev => prev.filter(c => c.id !== co.id))}
                  style={{ width: 22, height: 22, border: '1px solid #FECACA', borderRadius: 5, background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>✕</button>
              </div>
            ))}
          </div>
        )}

      {/* ── REDES SOCIALES ───────────────────────────────── */}
      <SectionTitle>Redes sociales</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
        {([
          { k: 'instagram', Icon: IgIcon,  setter: setInstagram, val: instagram, net: 'instagram', ph: '@usuario o URL'  },
          { k: 'facebook',  Icon: FbIcon,  setter: setFacebook,  val: facebook,  net: 'facebook',  ph: '@usuario o URL'  },
          { k: 'tiktok',    Icon: TkIcon,  setter: setTiktok,    val: tiktok,    net: 'tiktok',    ph: '@usuario'         },
          { k: 'linkedin',  Icon: LiIcon,  setter: setLinkedin,  val: linkedin,  net: 'linkedin',  ph: 'URL de LinkedIn'  },
          { k: 'youtube',   Icon: YtIcon,  setter: setYoutube,   val: youtube,   net: 'youtube',   ph: 'URL del canal'    },
          { k: 'x',         Icon: XIcon,   setter: setX,         val: x,         net: 'x',         ph: '@usuario o URL'  },
        ] as { k: string; Icon: () => React.ReactElement; setter: (v: string) => void; val: string; net: string; ph: string }[]).map(({ k, Icon, setter, val, net, ph }) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon /></span>
            <input type="text" placeholder={ph} value={val}
              onChange={e => setter(e.target.value)}
              style={{ ...inputSt, flex: 1 }} />
            <button onClick={() => searchSocial(net)}
              style={{ height: 38, padding: '0 10px', border: '1px solid #e2e5ea', borderRadius: 8, fontSize: 11, fontWeight: 700, fontFamily: 'inherit', background: '#f4f5f7', color: '#5a6070', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Buscar ↗
            </button>
          </div>
        ))}
        <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>
          "Buscar ↗" abre Google con el nombre del contacto.
        </p>
      </div>

      {/* ── COMENTARIOS ──────────────────────────────────── */}
      <SectionTitle>Comentarios</SectionTitle>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
        placeholder="Notas internas, preferencias, contexto del cliente…"
        style={{ ...inputSt, height: 'auto', padding: '8px 12px', resize: 'vertical', lineHeight: 1.5, marginBottom: 4 }} />

      {/* ── DOCUMENTOS ───────────────────────────────────── */}
      <SectionTitle>Documentos de identificación</SectionTitle>
      <div
        onDragOver={e => { e.preventDefault(); setDocDragging(true) }}
        onDragLeave={() => setDocDragging(false)}
        onDrop={e => { e.preventDefault(); setDocDragging(false); addDocFiles(Array.from(e.dataTransfer.files)) }}
        onClick={() => docInputRef.current?.click()}
        style={{ border: `2px dashed ${docDragging ? '#1B6EF3' : '#d1d5db'}`, borderRadius: 10, padding: '16px', textAlign: 'center', cursor: 'pointer', background: docDragging ? '#eff6ff' : '#f9fafb', transition: 'all .15s', marginBottom: 8 }}>
        <div style={{ fontSize: 20, marginBottom: 4 }}>📎</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#5a6070' }}>Arrastrá archivos o hacé click</div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>PDF, JPG, PNG — máx 20 MB c/u</div>
      </div>
      <input ref={docInputRef} type="file" multiple accept=".pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={e => { if (e.target.files) addDocFiles(Array.from(e.target.files)); e.target.value = '' }}
        style={{ display: 'none' }} />
      {docFiles.map((file, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 5 }}>
          <span style={{ fontSize: 16 }}>{file.type.includes('pdf') ? '📄' : '🖼'}</span>
          <span style={{ flex: 1, fontSize: 12, color: '#0d0f12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
          <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{formatFileSize(file.size)}</span>
          <button onClick={() => setDocFiles(prev => prev.filter((_, idx) => idx !== i))}
            style={{ fontSize: 12, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>✕</button>
        </div>
      ))}

      {/* Error */}
      {error && (
        <div style={{ fontSize: 13, color: '#e53e3e', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 12px', marginTop: 10 }}>
          {error}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <button onClick={save} disabled={saving}
          style={{ flex: 1, height: 40, background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>
          {saving ? 'Guardando…' : 'Registrar cliente'}
        </button>
        <button onClick={onClose}
          style={{ height: 40, padding: '0 18px', background: 'none', border: '1px solid #e2e5ea', borderRadius: 10, fontSize: 13, cursor: 'pointer', color: '#555', fontFamily: 'inherit' }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   COMPANY FORM — idéntico al formulario de Empresas
══════════════════════════════════════════════════════════════ */
function CompanyForm({ tenantId, initial, onCreated, onClose }: Omit<Props, 'type'>) {
  const [cedJur,     setCedJur]     = useState('')
  const [name,       setName]       = useState(initial ?? '')
  const [tradeName,  setTradeName]  = useState('')
  const [looking,    setLooking]    = useState(false)
  const [lookResult, setLookResult] = useState<LookupState>(null)
  const [cedJurDupe, setCedJurDupe] = useState<DupeCompany | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  /* ── Hacienda lookup ─────────────────────────────────────── */
  async function lookupCedJur(val: string) {
    setCedJur(val); setLookResult(null); setCedJurDupe(null)
    const digits = val.replace(/\D/g, '')
    if (digits.length < 9) return
    setLooking(true)

    // Hacienda
    try {
      const res = await fetch(`https://api.hacienda.go.cr/fe/ae?identificacion=${digits}`)
      if (res.ok) {
        const j = await res.json()
        if (j.nombre) {
          const moroso = j.situacion?.moroso === 'SI' ? ' · ⚠ Morosidad en Hacienda' : ''
          setLookResult({ type: 'ok', msg: `✓ ${j.nombre.trim()}${moroso}` })
          setName(j.nombre.trim())
        } else {
          setLookResult({ type: 'err', msg: 'No encontrada — ingresá el nombre manualmente' })
        }
      } else {
        setLookResult({ type: 'err', msg: 'Sin resultado — ingresá el nombre manualmente' })
      }
    } catch {
      setLookResult({ type: 'err', msg: 'Sin resultado — ingresá el nombre manualmente' })
    }

    // Dupe check — usar val formateado (con guiones) igual que EmpresasClient
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (createClient() as any)
      .from('crm_companies').select('id,name,trade_name')
      .eq('tenant_id', tenantId).eq('cedula_juridica', val.trim()).limit(1)
    setCedJurDupe(data?.[0] ?? null)
    setLooking(false)
  }

  async function save() {
    setError('')
    if (!cedJur.trim()) { setError('La cédula jurídica es obligatoria.'); return }
    if (!name.trim())   { setError('La razón social es obligatoria.'); return }
    if (cedJurDupe)     { setError('Ya existe una empresa con esta cédula jurídica.'); return }

    setSaving(true)
    const formatted = cedJur.trim()   // ya viene formateado con guiones (3-101-XXXXXX)

    // Final dupe check
    if (formatted) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (createClient() as any)
        .from('crm_companies').select('id,name')
        .eq('tenant_id', tenantId).eq('cedula_juridica', formatted).limit(1)
      if (data?.[0]) {
        setCedJurDupe(data[0])
        setError('Ya existe una empresa con esta cédula jurídica.')
        setSaving(false); return
      }
    }

    const { data, error: dbErr } = await createClient().from('crm_companies').insert({
      tenant_id:       tenantId,
      name:            name.trim(),
      trade_name:      tradeName.trim() || null,
      cedula_juridica: formatted || null,   // guardado con guiones: 3-101-XXXXXX
    }).select('id,name,trade_name,cedula_juridica').single()

    if (dbErr) { setError(`Error: ${dbErr.message}`); setSaving(false); return }

    onCreated({
      type:     'company',
      id:       data.id,
      name:     data.trade_name || data.name,
      subtitle: data.trade_name ? data.name : (data.cedula_juridica ?? 'Empresa'),
    })
  }

  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '0 24px 24px' }}>

      {/* ── IDENTIFICACIÓN FISCAL ────────────────────────── */}
      <SectionTitle>Identificación fiscal</SectionTitle>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <FieldLabel>Cédula jurídica</FieldLabel>
          <input
            placeholder="3-101-123456" maxLength={12}
            value={cedJur}
            onChange={e => lookupCedJur(formatCedulaJuridica(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') lookupCedJur(cedJur) }}
            style={{ ...inputSt, borderColor: cedJurDupe ? '#FDE68A' : '#e2e5ea', background: cedJurDupe ? '#FFFBEB' : '#fff' }} />
        </div>
        <div style={{ paddingTop: 22 }}>
          <button onClick={() => lookupCedJur(cedJur)} disabled={looking}
            style={{ ...lookupBtnSt, opacity: looking ? .6 : 1 }}>
            {looking ? '…' : 'Consultar →'}
          </button>
        </div>
      </div>
      {lookResult && (
        <div style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, marginBottom: 8, ...(lookResult.type === 'ok' ? { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' } : { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }) }}>
          {lookResult.msg}
        </div>
      )}
      {cedJurDupe && (
        <div style={{ fontSize: 12, padding: '7px 10px', borderRadius: 6, marginBottom: 8, background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92610A', display: 'flex', gap: 6 }}>
          ⚠ Ya existe: <strong>{cedJurDupe.name}</strong>
        </div>
      )}
      <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 4px' }}>
        Consulta Hacienda CR — autocompleta razón social. Enter o "Consultar →" para buscar.
      </p>

      {/* ── DATOS DE LA EMPRESA ──────────────────────────── */}
      <SectionTitle>Datos de la empresa</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 4 }}>
        <div>
          <FieldLabel required>Razón social</FieldLabel>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Inversiones XYZ Sociedad Anónima" style={inputSt} />
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>
            Se autocompleta con Hacienda, o ingresalo manualmente.
          </p>
        </div>
        <div>
          <FieldLabel>Nombre fantasía</FieldLabel>
          <input value={tradeName} onChange={e => setTradeName(e.target.value)}
            placeholder="XYZ Inversiones" style={inputSt} />
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>
            Nombre comercial con el que opera el negocio (si es diferente a la razón social).
          </p>
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 13, color: '#e53e3e', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 12px', marginTop: 10 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <button onClick={save} disabled={saving || !!cedJurDupe}
          style={{ flex: 1, height: 40, background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: (saving || !!cedJurDupe) ? 'not-allowed' : 'pointer', opacity: (saving || !!cedJurDupe) ? 0.7 : 1, fontFamily: 'inherit' }}>
          {saving ? 'Guardando…' : 'Registrar empresa'}
        </button>
        <button onClick={onClose}
          style={{ height: 40, padding: '0 18px', background: 'none', border: '1px solid #e2e5ea', borderRadius: 10, fontSize: 13, cursor: 'pointer', color: '#555', fontFamily: 'inherit' }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MODAL WRAPPER
══════════════════════════════════════════════════════════════ */
export default function NewOwnerModal({ type, tenantId, initial, onCreated, onClose }: Props) {
  useEffect(() => {
    function handle(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [onClose])

  const title = type === 'contact' ? '👤 Nuevo cliente' : '🏢 Nueva empresa'

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(13,15,18,.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div style={{
        width: 600, maxWidth: 'calc(100vw - 32px)',
        height: 'calc(100vh - 48px)', maxHeight: 820,
        background: '#fff', borderRadius: 14, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,.22)', fontFamily: 'system-ui, sans-serif',
      }}>
        {/* Header */}
        <div style={{ height: 52, background: '#f4f5f7', borderBottom: '1px solid #e2e5ea', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0d0f12' }}>{title}</span>
          <button onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #e2e5ea', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#5a6070' }}>✕</button>
        </div>

        {type === 'contact'
          ? <ContactForm tenantId={tenantId} initial={initial} onCreated={onCreated} onClose={onClose} />
          : <CompanyForm tenantId={tenantId} initial={initial} onCreated={onCreated} onClose={onClose} />
        }
      </div>
    </div>
  )
}
