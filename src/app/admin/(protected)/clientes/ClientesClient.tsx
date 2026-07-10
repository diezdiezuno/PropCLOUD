'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import PhoneInput from '@/components/PhoneInput'
import { COUNTRIES } from '@/data/countries'

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
  contact_types: { name: string; color: string } | null
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
  contact_types: { name: string; color: string } | null
  contact_sources: { name: string } | null
  crm_contact_companies: ContactCompanyRow[] | null
}

interface ContactType   { id: string; name: string; color: string }
interface ContactSource { id: string; name: string }
interface Company       { id: string; name: string; trade_name: string | null; cedula_juridica: string | null }
type LookupState = { type: 'ok' | 'err'; msg: string } | null

interface FormState {
  cedula: string; cedula_tipo: string; name: string; last_name: string
  birth_date: string; type_id: string; source_id: string
  email: string; phone: string; phone_country: string
  phone_alt: string; phone_alt_country: string
  photo_url: string
  instagram: string; linkedin: string; facebook: string
  tiktok: string; youtube: string; x: string
  notes: string
  doc_urls: DocUrl[]
}

const EMPTY_FORM: FormState = {
  cedula: '', cedula_tipo: 'fisica', name: '', last_name: '',
  birth_date: '', type_id: '', source_id: '',
  email: '', phone: '', phone_country: 'CR',
  phone_alt: '', phone_alt_country: 'CR',
  photo_url: '',
  instagram: '', linkedin: '', facebook: '',
  tiktok: '', youtube: '', x: '',
  notes: '',
  doc_urls: [],
}

// ── Helpers ───────────────────────────────────────────────────
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

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function formatCedula(val: string, tipo: string): string {
  if (tipo === 'pasaporte') return val
  const v = val.replace(/[^0-9]/g, '')
  if (tipo === 'dimex') {
    if (v.length <= 3) return v
    return v.slice(0, 3) + '-' + v.slice(3, 12)
  }
  if (tipo === 'juridica') {
    if (v.length <= 1) return v
    if (v.length <= 4) return v[0] + '-' + v.slice(1)
    return v[0] + '-' + v.slice(1, 4) + '-' + v.slice(4, 10)
  }
  if (v.length <= 1) return v
  if (v.length <= 5) return v[0] + '-' + v.slice(1)
  return v[0] + '-' + v.slice(1, 5) + '-' + v.slice(5, 9)
}

function getCedulaPlaceholder(tipo: string): string {
  switch (tipo) {
    case 'dimex':     return '123-456789012'
    case 'juridica':  return '3-101-123456'
    case 'pasaporte': return 'A12345678'
    default:          return '1-2345-6789'
  }
}

function getCedulaMaxLength(tipo: string): number {
  switch (tipo) {
    case 'dimex':     return 13
    case 'juridica':  return 12
    case 'pasaporte': return 20
    default:          return 11
  }
}

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

/** Inline "+" to add a new option (contact type / source). Admin-only, rendered by caller. */
function QuickAddOption({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [open, setOpen]     = useState(false)
  const [name, setName]     = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim() || saving) return
    setSaving(true)
    await onAdd(name.trim())
    setSaving(false); setName(''); setOpen(false)
  }

  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} title="Agregar nuevo"
      style={{ height: 20, minWidth: 20, padding: '0 5px', border: '1px solid #d5d9e0', borderRadius: 6, background: '#fff', color: '#5a6070', fontSize: 14, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit' }}>
      +
    </button>
  )
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input autoFocus value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save() } if (e.key === 'Escape') { setOpen(false); setName('') } }}
        placeholder="Nuevo…" disabled={saving}
        style={{ height: 22, width: 120, padding: '0 8px', border: '1px solid #c5cad3', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
      <button type="button" onClick={save} disabled={saving} title="Guardar"
        style={{ height: 22, minWidth: 22, border: 'none', borderRadius: 6, background: '#111', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✓</button>
      <button type="button" onClick={() => { setOpen(false); setName('') }} title="Cancelar"
        style={{ height: 22, minWidth: 22, border: '1px solid #e2e5ea', borderRadius: 6, background: '#fff', color: '#9ca3af', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
    </span>
  )
}

function openWhatsapp(phone: string | null, country: string | null) {
  if (!phone) return
  const num = phone.replace(/[^0-9]/g, '')
  const c = COUNTRIES.find(x => x.iso === (country || 'CR'))
  const dialCode = c?.dialCode?.replace(/\D/g, '') ?? '506'
  const full = num.length <= 8 ? dialCode + num : num
  window.open(`https://wa.me/${full}`, '_blank')
}

function formatPhone(val: string, iso: string): string {
  const digits = val.replace(/[^0-9]/g, '')
  if (iso === 'CR') {
    if (digits.length <= 4) return digits
    return digits.slice(0, 4) + '-' + digits.slice(4, 8)
  }
  return digits
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
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
  const [companies, setCompanies] = useState<Company[]>([])
  const [pageLoading, setPageLoading] = useState(true)

  const [search,       setSearch]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [form,       setForm]       = useState<FormState>({ ...EMPTY_FORM })
  const [saving,     setSaving]     = useState(false)

  // File state (outside FormState — not persisted as strings)
  const [photoFile,    setPhotoFile]    = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [docFiles,     setDocFiles]     = useState<File[]>([])
  const photoInputRef = useRef<HTMLInputElement>(null)
  const docInputRef   = useRef<HTMLInputElement>(null)

  // Multi-company drawer
  const [drawerCompanies,  setDrawerCompanies]  = useState<Company[]>([])
  const [coSearch,         setCoSearch]         = useState('')
  const [coResults,        setCoResults]        = useState<Company[]>([])
  const [showCoResults,    setShowCoResults]    = useState(false)
  const [coSearching,      setCoSearching]      = useState(false)
  const coSearchRef   = useRef<HTMLDivElement>(null)
  const coSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [lookupResult, setLookupResult] = useState<LookupState>(null)
  const [lookingUp,    setLookingUp]    = useState(false)
  const [emailError,   setEmailError]   = useState(false)

  const [toast,         setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting,      setDeleting]      = useState<string | null>(null)
  const [docDragging,   setDocDragging]   = useState(false)

  // Duplicate detection
  const [cedulaDupe, setCedulaDupe] = useState<{ id: string; name: string; last_name: string | null } | null>(null)
  const [emailDupe,  setEmailDupe]  = useState<{ id: string; name: string; last_name: string | null } | null>(null)

  // Hover state for list cards
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  // Hover state for action buttons (key = `${contactId}-${btnType}`)
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null)

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
    let query = (supabase as any)
      .from('crm_contacts')
      .select('id,cedula,cedula_tipo,name,last_name,email,phone,phone_country,phone_alt,phone_alt_country,type_id,source_id,photo_url,doc_urls,instagram,linkedin,facebook,tiktok,youtube,x,notes,active,birth_date,contact_types(name,color),contact_sources(name),crm_contact_companies(crm_companies(id,name))')
      .eq('tenant_id', tid)
      .eq('active', true)
      .order('name')

    if (type)   query = query.eq('type_id', type)
    if (source) query = query.eq('source_id', source)
    if (q)      query = query.or(`name.ilike.%${q}%,last_name.ilike.%${q}%,cedula.ilike.%${q}%,email.ilike.%${q}%`)

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

      const [{ data: typesData }, { data: sourcesData }, { data: companiesData }] =
        await Promise.all([
          supabase.from('contact_types').select('id,name,color').eq('tenant_id', adminRec.tenant_id).order('position'),
          supabase.from('contact_sources').select('id,name').eq('tenant_id', adminRec.tenant_id).order('position'),
          supabase.from('crm_companies').select('id,name,trade_name,cedula_juridica').eq('tenant_id', adminRec.tenant_id).order('name'),
        ])

      setTypes(typesData ?? [])
      setSources(sourcesData ?? [])
      setCompanies(companiesData ?? [])
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
      .select('*, contact_types(name,color), contact_sources(name), crm_contact_companies(crm_companies(id,name,cedula_juridica))')
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
  async function openDrawer(id: string | null) {
    setEditingId(id)
    setLookupResult(null)
    setEmailError(false)
    setCedulaDupe(null)
    setEmailDupe(null)
    setDrawerCompanies([])
    setCoSearch('')
    setCoResults([])
    setShowCoResults(false)
    setPhotoFile(null)
    setPhotoPreview('')
    setDocFiles([])

    if (id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = createClient() as any
      const [{ data: c }, { data: ccos }] = await Promise.all([
        sb.from('crm_contacts').select('*').eq('id', id).single(),
        sb.from('crm_contact_companies')
          .select('crm_companies(id,name,cedula_juridica)')
          .eq('contact_id', id),
      ])
      if (c) {
        setForm({
          cedula:            c.cedula            ?? '',
          cedula_tipo:       c.cedula_tipo       ?? 'fisica',
          name:              c.name              ?? '',
          last_name:         c.last_name         ?? '',
          birth_date:        c.birth_date        ?? '',
          type_id:           c.type_id           ?? '',
          source_id:         c.source_id         ?? '',
          email:             c.email             ?? '',
          phone:             c.phone             ?? '',
          phone_country:     c.phone_country     ?? 'CR',
          phone_alt:         c.phone_alt         ?? '',
          phone_alt_country: c.phone_alt_country ?? 'CR',
          photo_url:         c.photo_url         ?? '',
          instagram:         c.instagram         ?? '',
          linkedin:          c.linkedin          ?? '',
          facebook:          c.facebook          ?? '',
          tiktok:            c.tiktok            ?? '',
          youtube:           c.youtube           ?? '',
          x:                 c.x                 ?? '',
          notes:             c.notes             ?? '',
          doc_urls:          c.doc_urls          ?? [],
        })
      }
      const cos = (ccos ?? [])
        .map((r: ContactCompanyRow) => r.crm_companies)
        .filter(Boolean) as Company[]
      setDrawerCompanies(cos)
    } else {
      setForm({ ...EMPTY_FORM })
    }
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setEditingId(null)
  }

  // ── Photo ─────────────────────────────────────────────────
  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { showToast('La foto no puede superar 5 MB', 'error'); return }
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ── Docs ──────────────────────────────────────────────────
  function addDocFiles(files: File[]) {
    const valid = files.filter(f => {
      if (f.size > 20 * 1024 * 1024) { showToast(`${f.name} supera 20 MB`, 'error'); return false }
      return true
    })
    setDocFiles(prev => [...prev, ...valid])
  }

  function handleDocDrop(e: React.DragEvent) {
    e.preventDefault()
    setDocDragging(false)
    addDocFiles(Array.from(e.dataTransfer.files))
  }

  async function downloadExistingDoc(doc: DocUrl) {
    const supabase = createClient()
    const { data } = await supabase.storage.from('contact-docs').createSignedUrl(doc.path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  function removeExistingDoc(doc: DocUrl) {
    setForm(prev => ({ ...prev, doc_urls: prev.doc_urls.filter(d => d.path !== doc.path) }))
  }

  // ── Company search (drawer) ───────────────────────────────
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
      const addedIds = new Set(drawerCompanies.map(c => c.id))
      setCoResults(((data ?? []) as Company[]).filter(c => !addedIds.has(c.id)))
      setCoSearching(false)
    }, 250)
  }

  function addDrawerCompany(co: Company) {
    setDrawerCompanies(prev => [...prev, co].sort((a, b) => a.name.localeCompare(b.name)))
    setCoSearch('')
    setCoResults([])
    setShowCoResults(false)
  }

  function removeDrawerCompany(id: string) {
    setDrawerCompanies(prev => prev.filter(c => c.id !== id))
  }

  // ── Duplicate checks ─────────────────────────────────────
  async function checkCedulaDupe() {
    const raw = form.cedula.trim()
    if (!raw) { setCedulaDupe(null); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (createClient() as any)
      .from('crm_contacts').select('id,name,last_name')
      .eq('tenant_id', tenantId).eq('cedula', raw).eq('active', true)
    if (editingId) q = q.neq('id', editingId)
    const { data } = await q.limit(1)
    setCedulaDupe(data?.[0] ?? null)
  }

  async function checkEmailDupe() {
    const email = form.email.trim()
    if (!email || !isValidEmail(email)) { setEmailDupe(null); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (createClient() as any)
      .from('crm_contacts').select('id,name,last_name')
      .eq('tenant_id', tenantId).eq('email', email).eq('active', true)
    if (editingId) q = q.neq('id', editingId)
    const { data } = await q.limit(1)
    setEmailDupe(data?.[0] ?? null)
  }

  // ── Save ──────────────────────────────────────────────────
  async function saveContact() {
    if (!form.name.trim())      { showToast('El nombre es obligatorio', 'error'); return }
    if (!form.last_name.trim()) { showToast('Los apellidos son obligatorios', 'error'); return }
    if (!form.email.trim() && !form.phone.trim()) { showToast('Ingresá al menos un email o teléfono', 'error'); return }
    if (form.email && !isValidEmail(form.email)) { setEmailError(true); showToast('Email no válido', 'error'); return }

    // Fresh duplicate check on save (catches fast submits that bypass blur)
    setSaving(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb0 = createClient() as any
    if (form.cedula.trim()) {
      let q = sb0.from('crm_contacts').select('id,name,last_name')
        .eq('tenant_id', tenantId).eq('cedula', form.cedula.trim()).eq('active', true)
      if (editingId) q = q.neq('id', editingId)
      const { data } = await q.limit(1)
      if (data?.[0]) {
        const d = data[0]
        setCedulaDupe(d)
        showToast(`Cédula ya registrada: ${d.name}${d.last_name ? ' ' + d.last_name : ''}`, 'error')
        setSaving(false); return
      }
    }
    if (form.email.trim() && isValidEmail(form.email)) {
      let q = sb0.from('crm_contacts').select('id,name,last_name')
        .eq('tenant_id', tenantId).eq('email', form.email.trim()).eq('active', true)
      if (editingId) q = q.neq('id', editingId)
      const { data } = await q.limit(1)
      if (data?.[0]) {
        const d = data[0]
        setEmailDupe(d)
        showToast(`Email ya registrado: ${d.name}${d.last_name ? ' ' + d.last_name : ''}`, 'error')
        setSaving(false); return
      }
    }
    setSaving(false)
    setSaving(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient()
    const sb = supabase as any

    const payload = {
      cedula:            form.cedula.trim()     || null,
      cedula_tipo:       form.cedula_tipo,
      name:              form.name.trim(),
      last_name:         form.last_name.trim()  || null,
      birth_date:        form.birth_date        || null,
      type_id:           form.type_id           || null,
      source_id:         form.source_id         || null,
      email:             form.email.trim()      || null,
      phone:             form.phone.trim()      || null,
      phone_country:     form.phone_country,
      phone_alt:         form.phone_alt.trim()  || null,
      phone_alt_country: form.phone_alt_country,
      instagram:         normalizeUrl(form.instagram.trim(), 'instagram') || null,
      linkedin:          normalizeUrl(form.linkedin.trim(),  'linkedin')  || null,
      facebook:          normalizeUrl(form.facebook.trim(),  'facebook')  || null,
      tiktok:            normalizeUrl(form.tiktok.trim(),    'tiktok')    || null,
      youtube:           normalizeUrl(form.youtube.trim(),   'youtube')   || null,
      x:                 normalizeUrl(form.x.trim(),         'x')         || null,
      notes:             form.notes.trim()      || null,
    }

    // Insert or update
    let contactId = editingId
    let saveError
    if (editingId) {
      ;({ error: saveError } = await sb.from('crm_contacts').update(payload).eq('id', editingId))
    } else {
      const { data: newC, error: insertErr } = await sb
        .from('crm_contacts')
        .insert({ ...payload, tenant_id: tenantId, created_by: userId })
        .select('id').single()
      saveError = insertErr
      if (newC) contactId = newC.id
    }

    if (saveError) { setSaving(false); showToast('Error: ' + saveError.message, 'error'); return }

    // Upload photo
    let finalPhotoUrl = form.photo_url || null
    if (photoFile && contactId) {
      const ext = photoFile.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${contactId}/avatar.${ext}`
      const contentType = photoFile.type || 'image/jpeg'
      const { error: upErr } = await supabase.storage
        .from('contact-photos')
        .upload(path, photoFile, { upsert: true, contentType })
      if (upErr) {
        showToast(`Error al subir foto: ${upErr.message}`, 'error')
        setSaving(false)
        return
      }
      finalPhotoUrl = supabase.storage.from('contact-photos').getPublicUrl(path).data.publicUrl
    }

    // Upload docs
    const allDocUrls: DocUrl[] = [...form.doc_urls]
    if (docFiles.length > 0 && contactId) {
      for (const file of docFiles) {
        const ts = Date.now()
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${contactId}/${ts}_${safeName}`
        const { error: docErr } = await supabase.storage.from('contact-docs').upload(path, file, { contentType: file.type })
        if (!docErr) {
          allDocUrls.push({ path, name: file.name, size: file.size, uploaded_at: new Date().toISOString() })
        }
      }
    }

    // Update with file URLs
    if ((photoFile || docFiles.length > 0 || !form.photo_url) && contactId) {
      await sb.from('crm_contacts').update({
        photo_url: finalPhotoUrl,
        doc_urls: allDocUrls,
      }).eq('id', contactId)
    }

    // Save company links (junction table — replace all)
    if (contactId) {
      await sb.from('crm_contact_companies').delete().eq('contact_id', contactId)
      if (drawerCompanies.length > 0) {
        await sb.from('crm_contact_companies').insert(
          drawerCompanies.map(co => ({
            tenant_id:  tenantId,
            contact_id: contactId,
            company_id: co.id,
          }))
        )
      }
    }

    setSaving(false)
    showToast(editingId ? 'Cliente actualizado ✓' : 'Cliente creado ✓', 'success')
    closeDrawer()
    await loadContacts(tenantId, search, typeFilter, sourceFilter)
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

  // ── Hacienda lookup ───────────────────────────────────────
  async function lookupCedula() {
    const raw = form.cedula.replace(/[^0-9]/g, '')
    if (raw.length < 9) { setLookupResult({ type: 'err', msg: 'Mínimo 9 dígitos' }); return }
    setLookingUp(true)
    try {
      const r = await fetch(`https://api.hacienda.go.cr/fe/ae?identificacion=${raw}`)
      if (!r.ok) throw new Error()
      const d = await r.json()
      if (d.nombre) {
        const parts = d.nombre.trim().split(/\s+/)
        let name = toTitleCase(d.nombre), last_name = ''
        if ((form.cedula_tipo === 'fisica' || form.cedula_tipo === 'dimex') && parts.length >= 3) {
          name      = toTitleCase(parts.slice(0, -2).join(' '))
          last_name = toTitleCase(parts.slice(-2).join(' '))
        }
        setForm(prev => ({ ...prev, name, last_name }))
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

  // ── Social search ─────────────────────────────────────────
  function searchSocial(network: string) {
    const nombre = `${form.name} ${form.last_name}`.trim()
    const q = nombre ? `${nombre} site:${network}.com` : `site:${network}.com`
    window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank')
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

  // ── Quick-add contact type / source (admin only) ─────────
  async function addType(name: string) {
    const color = AVATAR_PALETTE[types.length % AVATAR_PALETTE.length]
    const { data, error } = await createClient().from('contact_types')
      .insert({ tenant_id: tenantId, name, color, position: types.length })
      .select('id,name,color').single()
    if (error || !data) { showToast('No se pudo crear el tipo', 'error'); return }
    setTypes(prev => [...prev, data])
    setForm(prev => ({ ...prev, type_id: data.id }))
  }
  async function addSource(name: string) {
    const { data, error } = await createClient().from('contact_sources')
      .insert({ tenant_id: tenantId, name, position: sources.length })
      .select('id,name').single()
    if (error || !data) { showToast('No se pudo crear la fuente', 'error'); return }
    setSources(prev => [...prev, data])
    setForm(prev => ({ ...prev, source_id: data.id }))
  }

  // ── Style tokens ─────────────────────────────────────────
  const sInput: React.CSSProperties = {
    height: 38, padding: '0 12px',
    border: '1px solid #e2e5ea', borderRadius: 8,
    fontSize: 14, fontFamily: 'system-ui, sans-serif',
    background: '#fff', color: '#0d0f12',
    width: '100%', boxSizing: 'border-box', outline: 'none',
  }
  const sLabel: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#5a6070', marginBottom: 4, display: 'block' }
  const sField: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 }
  const sSec: React.CSSProperties   = { marginBottom: 24 }
  const sSecLbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: '#9ca3af',
    letterSpacing: '.06em', textTransform: 'uppercase' as const,
    marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #e2e5ea',
  }
  const sLookupBtn: React.CSSProperties = {
    height: 38, padding: '0 14px', border: '1px solid #e2e5ea', borderRadius: 8,
    fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
    background: '#f4f5f7', color: '#0d0f12', cursor: 'pointer',
    whiteSpace: 'nowrap' as const, flexShrink: 0,
  }

  if (pageLoading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>

  const hasFilters = search || typeFilter || sourceFilter

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {contacts.map(c => {
            const typeColor    = c.contact_types?.color || '#1B6EF3'
            const bgLight      = typeColor + '18'
            const initials     = getInitials(c.name, c.last_name)
            const avatarColor  = nameToColor(c.name + (c.last_name ?? ''))
            const isConfirming = confirmDelete === c.id
            const isDeleting   = deleting === c.id

            return (
              <div key={c.id}
                onMouseEnter={() => setHoveredCard(c.id)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{ background: '#fff', border: '1px solid #e2e5ea', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'default', transition: 'border-color .15s' }}
                onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#1B6EF3' }}
                onMouseOut={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e5ea'}>

                {/* Avatar — click opens VCard */}
                <div
                  onClick={() => openVCard(c.id)}
                  style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, overflow: 'hidden', background: c.photo_url ? 'transparent' : avatarColor + '22', color: avatarColor, cursor: 'pointer', border: `2px solid ${avatarColor}33` }}>
                  {c.photo_url
                    ? <img src={c.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initials}
                </div>

                {/* Info — click opens VCard */}
                <div
                  onClick={() => openVCard(c.id)}
                  style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0d0f12', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.name}{c.last_name ? ' ' + c.last_name : ''}
                  </div>
                  <div style={{ fontSize: 12, color: '#5a6070', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {c.phone && <span>📱 {c.phone}</span>}
                    {c.email && <span>✉ {c.email}</span>}
                    {(() => {
                      const cos = (c.crm_contact_companies ?? []).map(r => r.crm_companies).filter(Boolean)
                      if (cos.length === 0) return null
                      const label = cos[0]!.trade_name || cos[0]!.name
                      return <span>🏢 {label}{cos.length > 1 ? ` +${cos.length - 1}` : ''}</span>
                    })()}
                  </div>
                </div>

                {/* Type badge */}
                {c.contact_types?.name && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: bgLight, color: typeColor, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {c.contact_types.name}
                  </span>
                )}

                {/* Actions */}
                <div
                  onClick={e => e.stopPropagation()}
                  style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, opacity: hoveredCard === c.id || isConfirming ? 1 : 0, transition: 'opacity .15s' }}>
                  {!isConfirming ? (
                    <>
                      {c.phone && (
                        <button
                          title="WhatsApp"
                          onClick={() => openWhatsapp(c.phone, c.phone_country)}
                          onMouseEnter={() => setHoveredBtn(`${c.id}-wa`)}
                          onMouseLeave={() => setHoveredBtn(null)}
                          style={{ width: 30, height: 30, border: `1px solid ${hoveredBtn === `${c.id}-wa` ? 'transparent' : '#A8DFC0'}`, borderRadius: 6, background: hoveredBtn === `${c.id}-wa` ? '#128C48' : '#E7F7EE', color: hoveredBtn === `${c.id}-wa` ? '#fff' : '#128C48', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, transition: 'all .15s' }}>
                          💬
                        </button>
                      )}
                      {c.email && (
                        <button
                          title="Email"
                          onClick={() => { window.location.href = `mailto:${c.email}` }}
                          onMouseEnter={() => setHoveredBtn(`${c.id}-email`)}
                          onMouseLeave={() => setHoveredBtn(null)}
                          style={{ width: 30, height: 30, border: `1px solid ${hoveredBtn === `${c.id}-email` ? 'transparent' : '#BFCFFB'}`, borderRadius: 6, background: hoveredBtn === `${c.id}-email` ? '#1B6EF3' : '#EEF4FF', color: hoveredBtn === `${c.id}-email` ? '#fff' : '#1B6EF3', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, transition: 'all .15s' }}>
                          ✉
                        </button>
                      )}
                      <button
                        title="Editar"
                        onClick={() => openDrawer(c.id)}
                        onMouseEnter={() => setHoveredBtn(`${c.id}-edit`)}
                        onMouseLeave={() => setHoveredBtn(null)}
                        style={{ width: 30, height: 30, border: `1px solid ${hoveredBtn === `${c.id}-edit` ? '#F5D98A' : '#e2e5ea'}`, borderRadius: 6, background: hoveredBtn === `${c.id}-edit` ? '#FEF9EC' : '#F4F5F7', color: hoveredBtn === `${c.id}-edit` ? '#92610A' : '#5a6070', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, transition: 'all .15s' }}>
                        ✏️
                      </button>
                      <button
                        title="Eliminar"
                        onClick={() => setConfirmDelete(c.id)}
                        onMouseEnter={() => setHoveredBtn(`${c.id}-del`)}
                        onMouseLeave={() => setHoveredBtn(null)}
                        style={{ width: 30, height: 30, border: `1px solid ${hoveredBtn === `${c.id}-del` ? 'transparent' : '#FECACA'}`, borderRadius: 6, background: hoveredBtn === `${c.id}-del` ? '#DC2626' : '#FEF2F2', color: hoveredBtn === `${c.id}-del` ? '#fff' : '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, transition: 'all .15s' }}>
                        🗑
                      </button>
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
              </div>
            )
          })}
        </div>
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
                {/* Type badge */}
                {vcardData.contact_types?.name && (
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: (vcardData.contact_types.color || '#1B6EF3') + '22', color: vcardData.contact_types.color || '#1B6EF3', marginBottom: 10 }}>
                    {vcardData.contact_types.name}
                  </span>
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

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

            {/* ── IDENTIFICACIÓN ─────────────────────────── */}
            <div style={sSec}>
              <div style={sSecLbl}>Identificación</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                {/* Tipo */}
                <div style={{ width: 148, ...sField }}>
                  <label style={sLabel}>Tipo</label>
                  <select value={form.cedula_tipo}
                    onChange={e => setForm(prev => ({ ...prev, cedula_tipo: e.target.value, cedula: '' }))}
                    style={sInput}>
                    <option value="fisica">Física</option>
                    <option value="dimex">DIMEX</option>
                    <option value="pasaporte">Pasaporte</option>
                  </select>
                </div>
                {/* Número */}
                <div style={{ flex: 1, ...sField }}>
                  <label style={sLabel}>
                    {form.cedula_tipo === 'dimex'     ? 'Número de DIMEX'
                     : form.cedula_tipo === 'pasaporte' ? 'Número de pasaporte'
                     : form.cedula_tipo === 'juridica'  ? 'Cédula jurídica'
                     : 'Número de cédula'}
                  </label>
                  <input
                    type="text"
                    placeholder={getCedulaPlaceholder(form.cedula_tipo)}
                    maxLength={getCedulaMaxLength(form.cedula_tipo)}
                    value={form.cedula}
                    onChange={e => {
                      setCedulaDupe(null)
                      setForm(prev => ({ ...prev, cedula: formatCedula(e.target.value, prev.cedula_tipo) }))
                    }}
                    onBlur={checkCedulaDupe}
                    style={{ ...sInput, borderColor: cedulaDupe ? '#FDE68A' : '#e2e5ea', background: cedulaDupe ? '#FFFBEB' : '#fff' }}
                  />
                </div>
                {/* Consultar */}
                {form.cedula_tipo !== 'pasaporte' && (
                  <div style={{ ...sField, paddingTop: 22 }}>
                    <button onClick={lookupCedula} disabled={lookingUp} style={{ ...sLookupBtn, opacity: lookingUp ? .6 : 1 }}>
                      {lookingUp ? '…' : 'Consultar →'}
                    </button>
                  </div>
                )}
              </div>
              {lookupResult && (
                <div style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, marginTop: 8, ...(lookupResult.type === 'ok' ? { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' } : { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }) }}>
                  {lookupResult.msg}
                </div>
              )}
              {cedulaDupe && (
                <div style={{ fontSize: 12, padding: '7px 10px', borderRadius: 6, marginTop: 6, background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92610A', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⚠</span>
                  <span>Ya existe un cliente con esta cédula: <strong>{cedulaDupe.name}{cedulaDupe.last_name ? ' ' + cedulaDupe.last_name : ''}</strong></span>
                </div>
              )}
              <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, display: 'block' }}>
                Consulta Hacienda CR — autocompleta nombre y apellidos
              </span>
            </div>

            {/* ── DATOS PERSONALES ───────────────────────── */}
            <div style={sSec}>
              <div style={sSecLbl}>Datos personales</div>

              {/* Foto de perfil */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, padding: '12px 14px', background: '#f9fafb', borderRadius: 10, border: '1px solid #e2e5ea' }}>
                <div
                  onClick={() => photoInputRef.current?.click()}
                  style={{ width: 64, height: 64, borderRadius: '50%', border: `2px ${photoPreview || form.photo_url ? 'solid #e2e5ea' : 'dashed #d1d5db'}`, cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f5f7', flexShrink: 0 }}>
                  {(photoPreview || form.photo_url) ? (
                    <img src={photoPreview || form.photo_url} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 22 }}>📷</span>
                  )}
                </div>
                <div>
                  <button type="button" onClick={() => photoInputRef.current?.click()}
                    style={{ fontSize: 13, fontWeight: 600, color: '#1B6EF3', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', display: 'block', marginBottom: 2 }}>
                    {(photoPreview || form.photo_url) ? 'Cambiar foto' : 'Subir foto de perfil'}
                  </button>
                  {(photoPreview || form.photo_url) && (
                    <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(''); setForm(prev => ({ ...prev, photo_url: '' })) }}
                      style={{ fontSize: 12, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', display: 'block', marginBottom: 2 }}>
                      Quitar foto
                    </button>
                  )}
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>JPG, PNG, WEBP — máx 5 MB</div>
                </div>
                <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={handlePhotoSelect} style={{ display: 'none' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={sField}>
                  <label style={sLabel}>Nombre *</label>
                  <input type="text" placeholder="María" value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                    style={sInput} autoFocus />
                </div>
                <div style={sField}>
                  <label style={sLabel}>Apellidos</label>
                  <input type="text" placeholder="Rodríguez Mora" value={form.last_name}
                    onChange={e => setForm(prev => ({ ...prev, last_name: e.target.value }))}
                    style={sInput} />
                </div>
                <div style={sField}>
                  <label style={sLabel}>Fecha de nacimiento</label>
                  <input type="date" value={form.birth_date}
                    onChange={e => setForm(prev => ({ ...prev, birth_date: e.target.value }))}
                    style={sInput} />
                </div>
                <div style={sField}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <label style={{ ...sLabel, marginBottom: 0 }}>Tipo de contacto</label>
                    {isAdmin && <QuickAddOption onAdd={addType} />}
                  </div>
                  <select value={form.type_id} onChange={e => setForm(prev => ({ ...prev, type_id: e.target.value }))} style={sInput}>
                    <option value="">Sin tipo</option>
                    {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div style={sField}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <label style={{ ...sLabel, marginBottom: 0 }}>Fuente / Canal</label>
                    {isAdmin && <QuickAddOption onAdd={addSource} />}
                  </div>
                  <select value={form.source_id} onChange={e => setForm(prev => ({ ...prev, source_id: e.target.value }))} style={sInput}>
                    <option value="">Sin fuente</option>
                    {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* ── CONTACTO ───────────────────────────────── */}
            <div style={sSec}>
              <div style={sSecLbl}>Contacto</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={sField}>
                  <label style={sLabel}>Email</label>
                  <input type="email" placeholder="correo@ejemplo.com" value={form.email}
                    onChange={e => {
                      const val = e.target.value
                      setEmailError(val.length > 0 && !isValidEmail(val))
                      setEmailDupe(null)
                      setForm(prev => ({ ...prev, email: val }))
                    }}
                    onBlur={e => {
                      if (e.target.value && !isValidEmail(e.target.value)) setEmailError(true)
                      checkEmailDupe()
                    }}
                    style={{ ...sInput, borderColor: emailError ? '#fca5a5' : emailDupe ? '#FDE68A' : '#e2e5ea', background: emailError ? '#fef2f2' : emailDupe ? '#FFFBEB' : '#fff' }} />
                  {emailError && <span style={{ fontSize: 11, color: '#DC2626' }}>Ingresá un email válido</span>}
                  {!emailError && emailDupe && (
                    <div style={{ fontSize: 12, padding: '7px 10px', borderRadius: 6, marginTop: 2, background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92610A', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>⚠</span>
                      <span>Ya existe un cliente con este email: <strong>{emailDupe.name}{emailDupe.last_name ? ' ' + emailDupe.last_name : ''}</strong></span>
                    </div>
                  )}
                </div>
                <div style={sField}>
                  <label style={sLabel}>Teléfono / WhatsApp</label>
                  <PhoneInput
                    phoneValue={form.phone}
                    countryIso={form.phone_country}
                    onPhoneChange={v => setForm(prev => ({ ...prev, phone: formatPhone(v, prev.phone_country) }))}
                    onCountryChange={iso => setForm(prev => ({ ...prev, phone_country: iso, phone: formatPhone(prev.phone, iso) }))}
                    placeholder="8888-1234"
                  />
                </div>
                <div style={sField}>
                  <label style={sLabel}>Teléfono alternativo</label>
                  <PhoneInput
                    phoneValue={form.phone_alt}
                    countryIso={form.phone_alt_country}
                    onPhoneChange={v => setForm(prev => ({ ...prev, phone_alt: formatPhone(v, prev.phone_alt_country) }))}
                    onCountryChange={iso => setForm(prev => ({ ...prev, phone_alt_country: iso, phone_alt: formatPhone(prev.phone_alt, iso) }))}
                    placeholder="2222-0000"
                  />
                </div>
              </div>
            </div>

            {/* ── EMPRESA/S ──────────────────────────────── */}
            <div style={sSec}>
              <div style={sSecLbl}>
                Empresa{drawerCompanies.length !== 1 ? 's' : ''}
                {drawerCompanies.length > 0 &&
                  <span style={{ marginLeft: 6, fontWeight: 400, color: '#9ca3af' }}>({drawerCompanies.length})</span>
                }
              </div>

              {/* Search */}
              <div ref={coSearchRef} style={{ position: 'relative', marginBottom: 10 }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 14, pointerEvents: 'none' }}>
                    {coSearching ? '⏳' : '🔍'}
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar empresa por nombre…"
                    value={coSearch}
                    onChange={e => handleCoSearch(e.target.value)}
                    onFocus={() => { if (coResults.length > 0) setShowCoResults(true) }}
                    style={{ ...sInput, paddingLeft: 36, paddingRight: coSearch ? 36 : 12 }}
                  />
                  {coSearch && (
                    <button onClick={() => { setCoSearch(''); setCoResults([]); setShowCoResults(false) }}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, padding: 0 }}>
                      ✕
                    </button>
                  )}
                </div>
                {/* Dropdown */}
                {showCoResults && coResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e5ea', borderRadius: 10, boxShadow: '0 8px 20px rgba(0,0,0,.1)', zIndex: 50, overflow: 'hidden', marginTop: 4 }}>
                    {coResults.map(co => (
                      <div key={co.id}
                        onMouseDown={() => addDrawerCompany(co)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f4f5f7' }}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#f9fafb'}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = ''}>
                        <span style={{ fontSize: 16 }}>🏢</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0d0f12' }}>{co.trade_name || co.name}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af', display: 'flex', gap: 6 }}>
                            {co.trade_name && <span>{co.name}</span>}
                            {co.cedula_juridica && <span style={{ fontFamily: 'monospace' }}>{co.cedula_juridica}</span>}
                          </div>
                        </div>
                        <span style={{ fontSize: 13, color: '#1B6EF3' }}>＋</span>
                      </div>
                    ))}
                  </div>
                )}
                {showCoResults && coSearch.trim() && !coSearching && coResults.length === 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e5ea', borderRadius: 10, padding: '12px 16px', marginTop: 4, fontSize: 13, color: '#9ca3af', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,.08)', zIndex: 50 }}>
                    Sin resultados — creá la empresa en <a href="/admin/empresas" target="_blank" style={{ color: '#1B6EF3', textDecoration: 'none' }}>Empresas ↗</a>
                  </div>
                )}
              </div>

              {/* Linked companies */}
              {drawerCompanies.length === 0 ? (
                <div style={{ padding: '14px 16px', background: '#F9FAFB', borderRadius: 10, border: '1px dashed #e2e5ea', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
                  Sin empresa asignada
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {drawerCompanies.map(co => (
                    <div key={co.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#F9FAFB', borderRadius: 10, border: '1px solid #e2e5ea' }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>🏢</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0d0f12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.trade_name || co.name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', display: 'flex', gap: 6 }}>
                          {co.trade_name && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.name}</span>}
                          {co.cedula_juridica && <span style={{ fontFamily: 'monospace', flexShrink: 0 }}>{co.cedula_juridica}</span>}
                        </div>
                      </div>
                      <button onClick={() => removeDrawerCompany(co.id)}
                        style={{ width: 24, height: 24, border: '1px solid #FECACA', borderRadius: 6, background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#DC2626'; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FEF2F2'; (e.currentTarget as HTMLButtonElement).style.color = '#DC2626' }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, display: 'block' }}>
                Un cliente puede estar en múltiples empresas.
              </span>
            </div>

            {/* ── REDES SOCIALES ─────────────────────────── */}
            <div style={sSec}>
              <div style={sSecLbl}>Redes sociales</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {([
                  { key: 'instagram' as const, Icon: IgIcon,  placeholder: '@usuario o URL',  net: 'instagram' },
                  { key: 'facebook'  as const, Icon: FbIcon,  placeholder: '@usuario o URL',  net: 'facebook'  },
                  { key: 'tiktok'    as const, Icon: TkIcon,  placeholder: '@usuario',         net: 'tiktok'    },
                  { key: 'linkedin'  as const, Icon: LiIcon,  placeholder: 'URL de LinkedIn',  net: 'linkedin'  },
                  { key: 'youtube'   as const, Icon: YtIcon,  placeholder: 'URL del canal',    net: 'youtube'   },
                  { key: 'x'         as const, Icon: XIcon,   placeholder: '@usuario o URL',   net: 'x'         },
                ]).map(({ key, Icon, placeholder, net }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon />
                    </span>
                    <input type="text" placeholder={placeholder} value={form[key]}
                      onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                      style={{ ...sInput, flex: 1 }} />
                    <button onClick={() => searchSocial(net)}
                      style={{ height: 38, padding: '0 12px', border: '1px solid #e2e5ea', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', background: '#f4f5f7', color: '#5a6070', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      Buscar ↗
                    </button>
                  </div>
                ))}
                <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                  &ldquo;Buscar ↗&rdquo; abre Google con el nombre del contacto para encontrar el perfil correcto.
                </p>
              </div>
            </div>

            {/* ── COMENTARIOS ────────────────────────────── */}
            <div style={sSec}>
              <div style={sSecLbl}>Comentarios</div>
              <textarea placeholder="Notas internas, preferencias, contexto del cliente…"
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={4}
                style={{ ...sInput, height: 'auto', padding: '10px 12px', resize: 'none', lineHeight: 1.5 }} />
            </div>

            {/* ── DOCUMENTOS DE IDENTIFICACIÓN ───────────── */}
            <div style={sSec}>
              <div style={sSecLbl}>Documentos de identificación</div>

              {/* Dropzone */}
              <div
                onDragOver={e => { e.preventDefault(); setDocDragging(true) }}
                onDragLeave={() => setDocDragging(false)}
                onDrop={handleDocDrop}
                onClick={() => docInputRef.current?.click()}
                style={{ border: `2px dashed ${docDragging ? '#1B6EF3' : '#d1d5db'}`, borderRadius: 10, padding: '20px 16px', textAlign: 'center', cursor: 'pointer', background: docDragging ? '#eff6ff' : '#f9fafb', transition: 'all .15s', marginBottom: 10 }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>📎</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#5a6070' }}>
                  Arrastrá archivos aquí o hacé click para seleccionar
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                  PDF, JPG, PNG, WEBP — máx 20 MB c/u
                </div>
              </div>
              <input ref={docInputRef} type="file" multiple
                accept=".pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
                onChange={e => { if (e.target.files) addDocFiles(Array.from(e.target.files)); e.target.value = '' }}
                style={{ display: 'none' }} />

              {/* Existing docs */}
              {form.doc_urls.map(doc => (
                <div key={doc.path} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#f4f5f7', borderRadius: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{doc.name.endsWith('.pdf') ? '📄' : '🖼'}</span>
                  <span style={{ flex: 1, fontSize: 13, color: '#0d0f12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{formatFileSize(doc.size)}</span>
                  <button onClick={() => downloadExistingDoc(doc)}
                    style={{ fontSize: 12, color: '#1B6EF3', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Ver →</button>
                  <button onClick={() => removeExistingDoc(doc)}
                    style={{ fontSize: 12, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>✕</button>
                </div>
              ))}

              {/* New files pending upload */}
              {docFiles.map((file, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{file.type.includes('pdf') ? '📄' : '🖼'}</span>
                  <span style={{ flex: 1, fontSize: 13, color: '#0d0f12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{formatFileSize(file.size)}</span>
                  <span style={{ fontSize: 11, color: '#1d4ed8', flexShrink: 0 }}>Pendiente</span>
                  <button onClick={() => setDocFiles(prev => prev.filter((_, idx) => idx !== i))}
                    style={{ fontSize: 12, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>✕</button>
                </div>
              ))}
            </div>

          </div>{/* /body */}

          {/* Footer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e5ea', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
            <button onClick={closeDrawer}
              style={{ height: 38, padding: '0 16px', background: '#fff', color: '#0d0f12', border: '1px solid #e2e5ea', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={saveContact} disabled={saving}
              style={{ height: 38, padding: '0 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1 }}>
              {saving ? 'Guardando…' : editingId ? 'Actualizar' : 'Guardar cliente'}
            </button>
          </div>

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
