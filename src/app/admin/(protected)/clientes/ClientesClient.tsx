'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { COUNTRIES } from '@/data/countries'
import ContactForm from '@/components/crm/ContactForm'

// ── Types ─────────────────────────────────────────────────────
interface DocUrl {
  path: string
  name: string
  size: number
  uploaded_at: string
}

interface ContactCompanyRow {
  crm_companies: { id: string; name: string; trade_name?: string | null; cedula_juridica?: string | null } | null
}

interface ContactTypeRow {
  contact_types: { id?: string; name: string; color: string } | null
}
/** Aplana las filas de la tabla puente a la lista de tipos (name+color). */
function contactTypeList(rows: ContactTypeRow[] | null | undefined) {
  return (rows ?? []).map(r => r.contact_types).filter(Boolean) as { id?: string; name: string; color: string }[]
}

interface Contact {
  id: string
  cedula: string | null
  cedula_tipo: string
  name: string
  last_name: string | null
  birth_date: string | null
  type_id: string | null
  source_id: string | null
  email: string | null
  phone: string | null
  phone_country: string | null
  phone_alt: string | null
  phone_alt_country: string | null
  photo_url: string | null
  doc_urls: DocUrl[] | null
  instagram: string | null
  linkedin: string | null
  facebook: string | null
  tiktok: string | null
  youtube: string | null
  x: string | null
  notes: string | null
  active: boolean
  crm_contact_types: ContactTypeRow[] | null
  contact_sources: { name: string } | null
  crm_contact_companies: ContactCompanyRow[] | null
}

interface VCardContact {
  id: string
  cedula: string | null
  cedula_tipo: string | null
  name: string
  last_name: string | null
  birth_date: string | null
  email: string | null
  phone: string | null
  phone_country: string | null
  phone_alt: string | null
  phone_alt_country: string | null
  photo_url: string | null
  notes: string | null
  instagram: string | null
  linkedin: string | null
  facebook: string | null
  tiktok: string | null
  youtube: string | null
  x: string | null
  doc_urls: DocUrl[] | null
  crm_contact_types: ContactTypeRow[] | null
  contact_sources: { name: string } | null
  crm_contact_companies: ContactCompanyRow[] | null
}

interface ContactType   { id: string; name: string; color: string }
interface ContactSource { id: string; name: string }

// ── Helpers ───────────────────────────────────────────────────
function getInitials(name: string, lastName: string | null) {
  return ((name?.[0] ?? '') + (lastName?.[0] ?? '')).toUpperCase() || '?'
}

// Paleta de 12 colores agradables para avatares
const AVATAR_PALETTE = [
  '#5B7FFF', '#E85D75', '#F59E0B', '#10B981',
  '#8B5CF6', '#EF4444', '#06B6D4', '#F97316',
  '#84CC16', '#EC4899', '#14B8A6', '#6366F1',
]
function nameToColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

function openWhatsapp(phone: string | null, country: string | null) {
  if (!phone) return
  const num = phone.replace(/[^0-9]/g, '')
  const c = COUNTRIES.find(x => x.iso === (country || 'CR'))
  const dialCode = c?.dialCode?.replace(/\D/g, '') ?? '506'
  const full = num.length <= 8 ? dialCode + num : num
  window.open(`https://wa.me/${full}`, '_blank')
}

function formatDateEsCR(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return dateStr
  }
}

// ── SVG social icons ──────────────────────────────────────────
const IgIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="ig" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor="#f09433"/>
        <stop offset="50%" stopColor="#dc2743"/>
        <stop offset="100%" stopColor="#bc1888"/>
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig)" strokeWidth="2"/>
    <circle cx="12" cy="12" r="4.5" stroke="url(#ig)" strokeWidth="2"/>
    <circle cx="17.5" cy="6.5" r="1.2" fill="url(#ig)"/>
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

// ── Component ─────────────────────────────────────────────────
export default function ClientesClient() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const isNew        = searchParams.get('new')

  const [tenantId,  setTenantId]  = useState('')
  const [userId,    setUserId]    = useState('')
  const [isAdmin,   setIsAdmin]   = useState(false)
  const [contacts,  setContacts]  = useState<Contact[]>([])
  const [types,     setTypes]     = useState<ContactType[]>([])
  const [sources,   setSources]   = useState<ContactSource[]>([])
  const [pageLoading, setPageLoading] = useState(true)

  const [search,       setSearch]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId,  setEditingId]  = useState<string | null>(null)

  const [toast,         setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting,      setDeleting]      = useState<string | null>(null)

  // Vista: tabla (denso, por defecto) o tarjetas. Hover es por CSS (escala a miles de filas).
  const [view, setView] = useState<'table' | 'cards'>('table')
  useEffect(() => {
    const v = localStorage.getItem('clientes_view')
    if (v === 'cards' || v === 'table') setView(v)
  }, [])
  function changeView(v: 'table' | 'cards') { setView(v); localStorage.setItem('clientes_view', v) }

  // VCard state
  const [vcardOpen,      setVcardOpen]      = useState(false)
  const [vcardData,      setVcardData]      = useState<VCardContact | null>(null)
  const [vcardLoading,   setVcardLoading]   = useState(false)
  const [docSignedUrls,  setDocSignedUrls]  = useState<Record<string, string>>({})

  // ── Load contacts ──────────────────────────────────────────
  const loadContacts = useCallback(async (
    tid: string, q: string, type: string, source: string
  ) => {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any

    // Filtro por tipo (many-to-many): primero los contact_id que tienen ese tipo
    let idsWithType: string[] | null = null
    if (type) {
      const { data: tRows } = await sb.from('crm_contact_types')
        .select('contact_id').eq('tenant_id', tid).eq('type_id', type)
      idsWithType = ((tRows ?? []) as { contact_id: string }[]).map(r => r.contact_id)
      if (idsWithType.length === 0) { setContacts([]); return }
    }

    let query = sb
      .from('crm_contacts')
      .select('id,cedula,cedula_tipo,name,last_name,email,phone,phone_country,phone_alt,phone_alt_country,type_id,source_id,photo_url,doc_urls,instagram,linkedin,facebook,tiktok,youtube,x,notes,active,birth_date,crm_contact_types(contact_types(id,name,color)),contact_sources(name),crm_contact_companies(crm_companies(id,name))')
      .eq('tenant_id', tid)
      .eq('active', true)
      .order('name')

    if (idsWithType) query = query.in('id', idsWithType)
    if (source)      query = query.eq('source_id', source)
    if (q)           query = query.or(`name.ilike.%${q}%,last_name.ilike.%${q}%,cedula.ilike.%${q}%,email.ilike.%${q}%`)

    const { data, error } = await query
    if (!error) setContacts((data ?? []) as Contact[])
  }, [])

  // ── Init ──────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: adminRec } = await supabase
        .from('tenant_admins').select('tenant_id, role').eq('user_id', user.id).single()
      if (!adminRec) return

      setTenantId(adminRec.tenant_id)
      setUserId(user.id)
      setIsAdmin(adminRec.role === 'admin')

      const [{ data: typesData }, { data: sourcesData }] =
        await Promise.all([
          supabase.from('contact_types').select('id,name,color').eq('tenant_id', adminRec.tenant_id).order('position'),
          supabase.from('contact_sources').select('id,name').eq('tenant_id', adminRec.tenant_id).order('position'),
        ])

      setTypes(typesData ?? [])
      setSources(sourcesData ?? [])
      await loadContacts(adminRec.tenant_id, '', '', '')
      setPageLoading(false)
    })
  }, [loadContacts])

  // Auto-open drawer from ?new=1
  useEffect(() => {
    if (isNew === '1' && tenantId) {
      openDrawer(null)
      router.replace('/admin/clientes')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, tenantId])

  // Auto-open vcard from ?id=X
  const idParam = searchParams.get('id')
  useEffect(() => {
    if (idParam && tenantId) {
      openVCard(idParam)
      router.replace('/admin/clientes')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam, tenantId])

  // Keyboard shortcuts — priority: vcard → drawer
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (vcardOpen) { closeVCard(); return }
        if (drawerOpen) { setDrawerOpen(false); return }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        document.getElementById('clientes-search')?.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [vcardOpen, drawerOpen])

  // Load signed URLs for all docs whenever vcardData changes
  useEffect(() => {
    if (!vcardData?.doc_urls?.length) { setDocSignedUrls({}); return }
    const supabase = createClient()
    Promise.all(
      vcardData.doc_urls.map(async (doc) => {
        const { data } = await supabase.storage.from('contact-docs').createSignedUrl(doc.path, 3600)
        return [doc.path, data?.signedUrl ?? ''] as [string, string]
      })
    ).then(results => setDocSignedUrls(Object.fromEntries(results)))
  }, [vcardData])

  // ── VCard ────────────────────────────────────────────────
  async function openVCard(id: string) {
    setVcardLoading(true)
    setVcardOpen(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (createClient() as any)
      .from('crm_contacts')
      .select('*, crm_contact_types(contact_types(id,name,color)), contact_sources(name), crm_contact_companies(crm_companies(id,name,cedula_juridica))')
      .eq('id', id)
      .single()
    setVcardData(data as VCardContact ?? null)
    setVcardLoading(false)
  }

  function closeVCard() {
    setVcardOpen(false)
  }

  async function downloadVCardDoc(doc: DocUrl) {
    const supabase = createClient()
    const { data } = await supabase.storage.from('contact-docs').createSignedUrl(doc.path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  // ── Drawer ────────────────────────────────────────────────
  // El formulario (ContactForm) carga sus propios datos vía editId.
  function openDrawer(id: string | null) {
    setEditingId(id)
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setEditingId(null)
  }

  // ── Delete ────────────────────────────────────────────────
  async function deleteContact(id: string) {
    setDeleting(id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (createClient() as any).from('crm_contacts').update({ active: false }).eq('id', id)
    setDeleting(null); setConfirmDelete(null)
    if (error) { showToast('Error al eliminar', 'error'); return }
    showToast('Cliente eliminado', 'success')
    await loadContacts(tenantId, search, typeFilter, sourceFilter)
  }


  // ── Filters ───────────────────────────────────────────────
  function handleSearch(val: string) {
    setSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => loadContacts(tenantId, val, typeFilter, sourceFilter), 300)
  }
  function handleTypeFilter(val: string)   { setTypeFilter(val);   loadContacts(tenantId, search, val, sourceFilter) }
  function handleSourceFilter(val: string) { setSourceFilter(val); loadContacts(tenantId, search, typeFilter, val) }

  // ── Toast ─────────────────────────────────────────────────
  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }


  // ── Style tokens ─────────────────────────────────────────
  const sInput: React.CSSProperties = {
    height: 38, padding: '0 12px',
    border: '1px solid #e2e5ea', borderRadius: 8,
    fontSize: 14, fontFamily: 'system-ui, sans-serif',
    background: '#fff', color: '#0d0f12',
    width: '100%', boxSizing: 'border-box', outline: 'none',
  }

  if (pageLoading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>

  const hasFilters = search || typeFilter || sourceFilter

  // Avatar reutilizable (tabla + tarjetas)
  function ContactAvatar({ c, size }: { c: Contact; size: number }) {
    const color = nameToColor(c.name + (c.last_name ?? ''))
    return (
      <div onClick={() => openVCard(c.id)}
        style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, overflow: 'hidden', background: c.photo_url ? 'transparent' : color + '22', color, cursor: 'pointer', border: `2px solid ${color}33` }}>
        {c.photo_url ? <img src={c.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(c.name, c.last_name)}
      </div>
    )
  }

  // Acciones reutilizables — hover por CSS (clases cl-btn-*), sin estado por fila
  function ContactActions({ c }: { c: Contact }) {
    const isConfirming = confirmDelete === c.id
    const isDeleting   = deleting === c.id
    return (
      <div className="cl-actions" onClick={e => e.stopPropagation()}
        style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        {!isConfirming ? (
          <>
            {c.phone && <button className="cl-btn cl-btn-wa" title="WhatsApp" onClick={() => openWhatsapp(c.phone, c.phone_country)}>💬</button>}
            {c.email && <button className="cl-btn cl-btn-mail" title="Email" onClick={() => { window.location.href = `mailto:${c.email}` }}>✉</button>}
            <button className="cl-btn cl-btn-edit" title="Editar" onClick={() => openDrawer(c.id)}>✏️</button>
            <button className="cl-btn cl-btn-del" title="Eliminar" onClick={() => setConfirmDelete(c.id)}>🗑</button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>¿Eliminar?</span>
            <button onClick={() => deleteContact(c.id)} disabled={isDeleting}
              style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#DC2626', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: isDeleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: isDeleting ? .6 : 1 }}>
              {isDeleting ? '…' : 'Sí'}
            </button>
            <button onClick={() => setConfirmDelete(null)}
              style={{ fontSize: 12, color: '#666', background: 'none', border: '1px solid #e0e0e0', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>No</button>
          </>
        )}
      </div>
    )
  }

  function companyLabel(c: Contact): string | null {
    const cos = (c.crm_contact_companies ?? []).map(r => r.crm_companies).filter(Boolean)
    if (cos.length === 0) return null
    return (cos[0]!.trade_name || cos[0]!.name) + (cos.length > 1 ? ` +${cos.length - 1}` : '')
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      {/* ── Header ───────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>Clientes</h1>
          <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>
            {contacts.length === 0 && !hasFilters ? 'Sin clientes aún.' : `${contacts.length} cliente${contacts.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={() => openDrawer(null)}
          style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Nuevo cliente
        </button>
      </div>

      {/* ── Toolbar ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
          <input id="clientes-search" type="text" placeholder="Buscar por nombre, cédula, email…"
            value={search} onChange={e => handleSearch(e.target.value)}
            style={{ ...sInput, paddingLeft: 36 }} />
        </div>
        <select value={typeFilter} onChange={e => handleTypeFilter(e.target.value)}
          style={{ height: 38, padding: '0 12px', border: '1px solid #e2e5ea', borderRadius: 8, fontSize: 14, background: '#fff', color: '#0d0f12', fontFamily: 'inherit', cursor: 'pointer' }}>
          <option value="">Todos los tipos</option>
          {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={sourceFilter} onChange={e => handleSourceFilter(e.target.value)}
          style={{ height: 38, padding: '0 12px', border: '1px solid #e2e5ea', borderRadius: 8, fontSize: 14, background: '#fff', color: '#0d0f12', fontFamily: 'inherit', cursor: 'pointer' }}>
          <option value="">Todas las fuentes</option>
          {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span style={{ fontSize: 12, color: '#9ca3af', fontVariantNumeric: 'tabular-nums', marginLeft: 'auto' }}>
          {contacts.length} cliente{contacts.length !== 1 ? 's' : ''}
        </span>
        {/* Toggle vista tabla / tarjetas */}
        <div style={{ display: 'flex', border: '1px solid #e2e5ea', borderRadius: 8, overflow: 'hidden' }}>
          {([['table', '☰', 'Tabla'], ['cards', '▦', 'Tarjetas']] as const).map(([v, icon, label]) => (
            <button key={v} onClick={() => changeView(v)} title={label}
              style={{ height: 38, padding: '0 12px', border: 'none', background: view === v ? '#111' : '#fff', color: view === v ? '#fff' : '#5a6070', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* ── List ─────────────────────────────────────────── */}
      {contacts.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '60px 24px', border: '1px solid #ebebeb', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#5a6070', margin: '0 0 8px' }}>
            {hasFilters ? 'Sin resultados' : 'Sin clientes aún'}
          </h3>
          <p style={{ fontSize: 14, color: '#9ca3af', margin: '0 0 20px' }}>
            {hasFilters ? 'Probá otra búsqueda o cambiá los filtros.' : 'Agregá el primer cliente del CRM.'}
          </p>
          {!hasFilters && (
            <button onClick={() => openDrawer(null)}
              style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              + Nuevo cliente
            </button>
          )}
        </div>
      ) : (
        <>
          <style>{`
            .cl-trow:hover { background:#f9fafb; }
            .cl-trow .cl-actions, .cl-card .cl-actions { opacity:0; transition:opacity .15s; }
            .cl-trow:hover .cl-actions, .cl-card:hover .cl-actions { opacity:1; }
            .cl-card:hover { border-color:#1B6EF3 !important; }
            .cl-btn { width:30px; height:30px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:14px; transition:all .15s; background:#F4F5F7; border:1px solid #e2e5ea; color:#5a6070; }
            .cl-btn-wa { background:#E7F7EE; border-color:#A8DFC0; color:#128C48; }
            .cl-btn-wa:hover { background:#128C48; color:#fff; border-color:transparent; }
            .cl-btn-mail { background:#EEF4FF; border-color:#BFCFFB; color:#1B6EF3; }
            .cl-btn-mail:hover { background:#1B6EF3; color:#fff; border-color:transparent; }
            .cl-btn-edit:hover { background:#FEF9EC; border-color:#F5D98A; color:#92610A; }
            .cl-btn-del { background:#FEF2F2; border-color:#FECACA; color:#DC2626; }
            .cl-btn-del:hover { background:#DC2626; color:#fff; border-color:transparent; }
          `}</style>

          {view === 'table' ? (
            <div style={{ background: '#fff', border: '1px solid #e2e5ea', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', color: '#5a6070', textAlign: 'left' }}>
                    <th style={{ padding: '9px 12px', fontWeight: 500 }}>Nombre</th>
                    <th style={{ padding: '9px 12px', fontWeight: 500, width: 190 }}>Contacto</th>
                    <th style={{ padding: '9px 12px', fontWeight: 500, width: 150 }}>Empresa</th>
                    <th style={{ padding: '9px 12px', fontWeight: 500, width: 180 }}>Tipos</th>
                    <th style={{ padding: '9px 12px', fontWeight: 500, width: 150 }} />
                  </tr>
                </thead>
                <tbody>
                  {contacts.map(c => {
                    const cTypes = contactTypeList(c.crm_contact_types)
                    const comp = companyLabel(c)
                    return (
                      <tr key={c.id} className="cl-trow" style={{ borderTop: '1px solid #eef0f2' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <div onClick={() => openVCard(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minWidth: 0 }}>
                            <ContactAvatar c={c} size={30} />
                            <span style={{ fontWeight: 600, color: '#0d0f12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}{c.last_name ? ' ' + c.last_name : ''}</span>
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px', color: '#5a6070', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.phone || c.email || '—'}</td>
                        <td style={{ padding: '8px 12px', color: comp ? '#5a6070' : '#c5cad3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comp || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {cTypes.map((t, i) => <span key={t.id ?? i} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: (t.color || '#1B6EF3') + '18', color: t.color || '#1B6EF3', whiteSpace: 'nowrap' }}>{t.name}</span>)}
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><ContactActions c={c} /></div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {contacts.map(c => {
                const cTypes = contactTypeList(c.crm_contact_types)
                const comp = companyLabel(c)
                return (
                  <div key={c.id} className="cl-card" style={{ background: '#fff', border: '1px solid #e2e5ea', borderRadius: 12, padding: 14, transition: 'border-color .15s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <ContactAvatar c={c} size={40} />
                      <div onClick={() => openVCard(c.id)} style={{ minWidth: 0, cursor: 'pointer', flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0d0f12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}{c.last_name ? ' ' + c.last_name : ''}</div>
                        <div style={{ fontSize: 12, color: comp ? '#9ca3af' : '#c5cad3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comp || 'Sin empresa'}</div>
                      </div>
                    </div>
                    {cTypes.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                        {cTypes.map((t, i) => <span key={t.id ?? i} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: (t.color || '#1B6EF3') + '18', color: t.color || '#1B6EF3', whiteSpace: 'nowrap' }}>{t.name}</span>)}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#5a6070', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{c.phone || c.email || ''}</span>
                      <ContactActions c={c} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── VCard Modal ──────────────────────────────────── */}
      <div
        onClick={e => { if (e.target === e.currentTarget) closeVCard() }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(13,15,18,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: vcardOpen ? 1 : 0, pointerEvents: vcardOpen ? 'all' : 'none', transition: 'opacity .2s' }}>
        <div style={{
          width: 780, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 48px)',
          background: '#fff', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,.18)',
          transform: vcardOpen ? 'scale(1) translateY(0)' : 'scale(.96) translateY(8px)',
          transition: 'transform .2s',
        }}>
          {/* VCard Header */}
          <div style={{ height: 52, background: '#E2E5EA', borderBottom: '1px solid #CDD1D8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0d0f12' }}>
              {vcardData ? `${vcardData.name}${vcardData.last_name ? ' ' + vcardData.last_name : ''}` : ''}
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => {
                  if (!vcardData) return
                  const id = vcardData.id
                  closeVCard()
                  setTimeout(() => openDrawer(id), 200)
                }}
                style={{ height: 32, padding: '0 14px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Editar
              </button>
              <button
                onClick={closeVCard}
                style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #CDD1D8', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#5a6070' }}>
                ✕
              </button>
            </div>
          </div>

          {/* VCard Body */}
          {vcardLoading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 14 }}>Cargando…</div>
          ) : vcardData ? (
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr', overflow: 'hidden' }}>

              {/* LEFT column */}
              <div style={{ width: 220, background: '#F4F5F7', borderRight: '1px solid #E2E5EA', padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto' }}>
                {/* Avatar */}
                {(() => {
                  const ac = nameToColor(vcardData.name + (vcardData.last_name ?? ''))
                  return (
                    <div style={{ width: 120, height: 120, borderRadius: '50%', overflow: 'hidden', background: vcardData.photo_url ? 'transparent' : ac + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 14, border: `3px solid ${ac}44` }}>
                      {vcardData.photo_url
                        ? <img src={vcardData.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: 40, fontWeight: 800, color: ac, letterSpacing: '-1px' }}>{getInitials(vcardData.name, vcardData.last_name)}</span>}
                    </div>
                  )
                })()}
                {/* Name */}
                <div style={{ fontSize: 20, fontWeight: 700, color: '#0d0f12', textAlign: 'center', marginBottom: 8 }}>
                  {vcardData.name}{vcardData.last_name ? ' ' + vcardData.last_name : ''}
                </div>
                {/* Type badges (múltiples) */}
                {contactTypeList(vcardData.crm_contact_types).length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10 }}>
                    {contactTypeList(vcardData.crm_contact_types).map((t, i) => (
                      <span key={t.id ?? i} style={{ fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: (t.color || '#1B6EF3') + '22', color: t.color || '#1B6EF3' }}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
                {/* Companies */}
                {(() => {
                  const cos = (vcardData.crm_contact_companies ?? []).map(r => r.crm_companies).filter(Boolean)
                  if (cos.length === 0) return null
                  return (
                    <div style={{ textAlign: 'center', marginBottom: 10, width: '100%' }}>
                      {cos.map(co => (
                        <div key={co!.id} style={{ marginBottom: 4 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#5a6070' }}>{co!.trade_name || co!.name}</div>
                          {co!.trade_name && <div style={{ fontSize: 11, color: '#9ca3af' }}>{co!.name}</div>}
                          {co!.cedula_juridica && <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{co!.cedula_juridica}</div>}
                        </div>
                      ))}
                    </div>
                  )
                })()}
                {/* Action buttons */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 7, marginTop: 14 }}>
                  {vcardData.phone && (
                    <button
                      onClick={() => openWhatsapp(vcardData.phone, vcardData.phone_country)}
                      style={{ width: '100%', height: 36, background: '#128C48', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      WhatsApp
                    </button>
                  )}
                  {vcardData.email && (
                    <button
                      onClick={() => { window.location.href = `mailto:${vcardData.email}` }}
                      style={{ width: '100%', height: 36, background: '#1B6EF3', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Email
                    </button>
                  )}
                </div>
                {/* Social icons */}
                {(() => {
                  const socials = [
                    { field: vcardData.instagram, Icon: IgIcon,  label: 'Instagram' },
                    { field: vcardData.linkedin,  Icon: LiIcon,  label: 'LinkedIn'  },
                    { field: vcardData.facebook,  Icon: FbIcon,  label: 'Facebook'  },
                    { field: vcardData.tiktok,    Icon: TkIcon,  label: 'TikTok'    },
                    { field: vcardData.youtube,   Icon: YtIcon,  label: 'YouTube'   },
                    { field: vcardData.x,         Icon: XIcon,   label: 'X'         },
                  ].filter(s => !!s.field)
                  if (socials.length === 0) return null
                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 14 }}>
                      {socials.map(({ field, Icon, label }) => (
                        <a key={label} href={field!} target="_blank" rel="noreferrer"
                          title={label}
                          style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid #e2e5ea', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                          <Icon />
                        </a>
                      ))}
                    </div>
                  )
                })()}
              </div>

              {/* RIGHT column */}
              <div style={{ padding: '16px 24px', overflowY: 'auto' }}>
                {/* Información section */}
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>Información</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Cédula */}
                  {vcardData.cedula && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F4F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🪪</div>
                      <div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>Cédula</div>
                        <div style={{ fontSize: 14, color: '#0d0f12' }}>{vcardData.cedula}
                          {vcardData.cedula_tipo && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>{vcardData.cedula_tipo}</span>}
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Nacimiento */}
                  {vcardData.birth_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🎂</div>
                      <div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>Nacimiento</div>
                        <div style={{ fontSize: 14, color: '#0d0f12' }}>{formatDateEsCR(vcardData.birth_date)}</div>
                      </div>
                    </div>
                  )}
                  {/* Teléfono */}
                  {vcardData.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E7F7EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📱</div>
                      <div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>Teléfono</div>
                        <div style={{ fontSize: 14, color: '#0d0f12' }}>{vcardData.phone}</div>
                      </div>
                    </div>
                  )}
                  {/* Teléfono alt */}
                  {vcardData.phone_alt && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📞</div>
                      <div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>Teléfono alternativo</div>
                        <div style={{ fontSize: 14, color: '#0d0f12' }}>{vcardData.phone_alt}</div>
                      </div>
                    </div>
                  )}
                  {/* Email */}
                  {vcardData.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#EEF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>✉</div>
                      <div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>Email</div>
                        <a href={`mailto:${vcardData.email}`} style={{ fontSize: 14, color: '#1B6EF3', textDecoration: 'none' }}>{vcardData.email}</a>
                      </div>
                    </div>
                  )}
                  {/* Empresas */}
                  {(() => {
                    const cos = (vcardData.crm_contact_companies ?? []).map(r => r.crm_companies).filter(Boolean)
                    if (cos.length === 0) return null
                    return cos.map(co => (
                      <div key={co!.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F5F5F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🏢</div>
                        <div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>Empresa</div>
                          <div style={{ fontSize: 14, color: '#0d0f12' }}>{co!.trade_name || co!.name}</div>
                          {co!.trade_name && <div style={{ fontSize: 12, color: '#5a6070' }}>{co!.name}</div>}
                          {co!.cedula_juridica && <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{co!.cedula_juridica}</div>}
                        </div>
                      </div>
                    ))
                  })()}
                  {/* Fuente */}
                  {vcardData.contact_sources?.name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📡</div>
                      <div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>Fuente</div>
                        <div style={{ fontSize: 14, color: '#0d0f12' }}>{vcardData.contact_sources.name}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {vcardData.notes && (
                  <>
                    <div style={{ height: 1, background: '#E2E5EA', margin: '16px 0' }} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Comentarios</div>
                    <div style={{ fontSize: 14, color: '#0d0f12', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{vcardData.notes}</div>
                  </>
                )}

                {/* Documents */}
                {vcardData.doc_urls && vcardData.doc_urls.length > 0 && (
                  <>
                    <div style={{ height: 1, background: '#E2E5EA', margin: '16px 0' }} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                      Documentos ({vcardData.doc_urls.length})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {vcardData.doc_urls.map(doc => {
                        const isPdf    = doc.name.toLowerCase().endsWith('.pdf')
                        const isImage  = /\.(jpe?g|png|webp|gif|bmp|svg|heic|heif)$/i.test(doc.name)
                        const signedUrl = docSignedUrls[doc.path]
                        return (
                          <div key={doc.path}
                            onClick={() => downloadVCardDoc(doc)}
                            style={{ border: '1px solid #E2E5EA', borderRadius: 10, cursor: 'pointer', overflow: 'hidden', transition: 'box-shadow .15s' }}
                            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 10px rgba(0,0,0,.1)'}
                            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'}>
                            {/* Thumbnail */}
                            <div style={{ height: 100, background: isPdf ? '#FEE2E2' : '#F4F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden', position: 'relative' }}>
                              {isImage && signedUrl ? (
                                <img src={signedUrl} alt={doc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <>
                                  <span style={{ fontSize: 28 }}>{isPdf ? '📄' : '🖼'}</span>
                                  {isPdf && <span style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>PDF</span>}
                                </>
                              )}
                            </div>
                            <div style={{ padding: '6px 10px', fontSize: 12, color: '#5a6070', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Drawer ───────────────────────────────────────── */}
      <div
        onClick={e => { if (e.target === e.currentTarget) closeDrawer() }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(13,15,18,.45)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', opacity: drawerOpen ? 1 : 0, pointerEvents: drawerOpen ? 'all' : 'none', transition: 'opacity .2s' }}>

        <div style={{ width: 560, maxWidth: '100vw', height: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,.12)', overflow: 'hidden', transform: drawerOpen ? 'translateX(0)' : 'translateX(40px)', transition: 'transform .2s' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #e2e5ea', flexShrink: 0 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: '#0d0f12' }}>{editingId ? 'Editar cliente' : 'Nuevo cliente'}</span>
            <button onClick={closeDrawer} style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#5a6070', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>

          {/* Body — formulario compartido */}
          {drawerOpen && (
            <ContactForm
              key={editingId ?? 'new'}
              tenantId={tenantId}
              userId={userId}
              isAdmin={isAdmin}
              editId={editingId}
              onSaved={async () => {
                showToast(editingId ? 'Cliente actualizado ✓' : 'Cliente creado ✓', 'success')
                closeDrawer()
                await loadContacts(tenantId, search, typeFilter, sourceFilter)
              }}
              onCancel={closeDrawer}
            />
          )}

        </div>
      </div>

      {/* ── Toast ─────────────────────────────────────────── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, zIndex: 999, fontFamily: 'system-ui, sans-serif', pointerEvents: 'none', ...(toast.type === 'success' ? { background: '#15803d', color: '#fff' } : { background: '#DC2626', color: '#fff' }) }}>
          {toast.msg}
        </div>
      )}
    </>
  )
}
