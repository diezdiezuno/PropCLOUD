'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import PhoneInput from '@/components/PhoneInput'

// ── Types ─────────────────────────────────────────────────────
interface DocUrl {
  path: string
  name: string
  size: number
  uploaded_at: string
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
  company_id: string | null
  photo_url: string | null
  doc_urls: DocUrl[] | null
  instagram: string | null
  linkedin: string | null
  facebook: string | null
  tiktok: string | null
  youtube: string | null
  notes: string | null
  active: boolean
  contact_types: { name: string; color: string } | null
  contact_sources: { name: string } | null
  crm_companies: { name: string } | null
}

interface ContactType   { id: string; name: string; color: string }
interface ContactSource { id: string; name: string }
interface Company       { id: string; name: string; cedula_juridica: string | null }
type LookupState = { type: 'ok' | 'err'; msg: string } | null

interface FormState {
  cedula: string; cedula_tipo: string; name: string; last_name: string
  birth_date: string; type_id: string; source_id: string
  email: string; phone: string; phone_country: string
  phone_alt: string; phone_alt_country: string
  photo_url: string
  company_name: string; company_cedula: string; company_id: string
  instagram: string; linkedin: string; facebook: string
  tiktok: string; youtube: string
  notes: string
  doc_urls: DocUrl[]
}

const EMPTY_FORM: FormState = {
  cedula: '', cedula_tipo: 'fisica', name: '', last_name: '',
  birth_date: '', type_id: '', source_id: '',
  email: '', phone: '', phone_country: 'CR',
  phone_alt: '', phone_alt_country: 'CR',
  photo_url: '',
  company_name: '', company_cedula: '', company_id: '',
  instagram: '', linkedin: '', facebook: '',
  tiktok: '', youtube: '',
  notes: '',
  doc_urls: [],
}

// ── Helpers ───────────────────────────────────────────────────
function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function formatCedula(val: string) {
  const v = val.replace(/[^0-9]/g, '')
  if (v.length <= 1) return v
  if (v.length <= 5)  return v[0] + '-' + v.slice(1)
  return v[0] + '-' + v.slice(1, 5) + '-' + v.slice(5, 13)
}

function getInitials(name: string, lastName: string | null) {
  return ((name?.[0] ?? '') + (lastName?.[0] ?? '')).toUpperCase() || '?'
}

function openWhatsapp(phone: string | null, country: string | null) {
  if (!phone) return
  const num = phone.replace(/[^0-9]/g, '')
  const { COUNTRIES } = require('@/data/countries')
  const c = COUNTRIES.find((x: {iso:string}) => x.iso === (country || 'CR'))
  const dialCode = c?.dialCode?.replace(/\D/g, '') ?? '506'
  const full = num.length <= 8 ? dialCode + num : num
  window.open(`https://wa.me/${full}`, '_blank')
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
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

// ── Component ─────────────────────────────────────────────────
export default function ClientesClient() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const isNew        = searchParams.get('new')

  const [tenantId,  setTenantId]  = useState('')
  const [userId,    setUserId]    = useState('')
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

  const [companySuggestions, setCompanySuggestions] = useState<Company[]>([])
  const [showSuggestions,    setShowSuggestions]    = useState(false)

  const [lookupResult,  setLookupResult]  = useState<LookupState>(null)
  const [empresaResult, setEmpresaResult] = useState<LookupState>(null)
  const [lookingUp,     setLookingUp]     = useState(false)
  const [emailError,    setEmailError]    = useState(false)

  const [toast,         setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting,      setDeleting]      = useState<string | null>(null)
  const [docDragging,   setDocDragging]   = useState(false)

  // ── Load contacts ──────────────────────────────────────────
  const loadContacts = useCallback(async (
    tid: string, q: string, type: string, source: string
  ) => {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('crm_contacts')
      .select('id,cedula,cedula_tipo,name,last_name,email,phone,phone_country,phone_alt,phone_alt_country,company_id,type_id,source_id,photo_url,doc_urls,instagram,linkedin,facebook,tiktok,youtube,notes,active,birth_date,contact_types(name,color),contact_sources(name),crm_companies(name)')
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
        .from('tenant_admins').select('tenant_id').eq('user_id', user.id).single()
      if (!adminRec) return

      setTenantId(adminRec.tenant_id)
      setUserId(user.id)

      const [{ data: typesData }, { data: sourcesData }, { data: companiesData }] =
        await Promise.all([
          supabase.from('contact_types').select('id,name,color').eq('tenant_id', adminRec.tenant_id).order('position'),
          supabase.from('contact_sources').select('id,name').eq('tenant_id', adminRec.tenant_id).order('position'),
          supabase.from('crm_companies').select('id,name,cedula_juridica').eq('tenant_id', adminRec.tenant_id).order('name'),
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

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDrawerOpen(false)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        document.getElementById('clientes-search')?.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // ── Drawer ────────────────────────────────────────────────
  function openDrawer(id: string | null) {
    setEditingId(id)
    setLookupResult(null)
    setEmpresaResult(null)
    setEmailError(false)
    setCompanySuggestions([])
    setShowSuggestions(false)
    setPhotoFile(null)
    setPhotoPreview('')
    setDocFiles([])

    if (id) {
      const c = contacts.find(x => x.id === id)
      if (c) {
        const co = companies.find(x => x.id === c.company_id)
        setForm({
          cedula:            c.cedula           ?? '',
          cedula_tipo:       c.cedula_tipo      ?? 'fisica',
          name:              c.name             ?? '',
          last_name:         c.last_name        ?? '',
          birth_date:        c.birth_date       ?? '',
          type_id:           c.type_id          ?? '',
          source_id:         c.source_id        ?? '',
          email:             c.email            ?? '',
          phone:             c.phone            ?? '',
          phone_country:     c.phone_country    ?? 'CR',
          phone_alt:         c.phone_alt        ?? '',
          phone_alt_country: c.phone_alt_country?? 'CR',
          photo_url:         c.photo_url        ?? '',
          company_name:      co?.name           ?? '',
          company_cedula:    co?.cedula_juridica ?? '',
          company_id:        c.company_id       ?? '',
          instagram:         c.instagram        ?? '',
          linkedin:          c.linkedin         ?? '',
          facebook:          c.facebook         ?? '',
          tiktok:            c.tiktok           ?? '',
          youtube:           c.youtube          ?? '',
          notes:             c.notes            ?? '',
          doc_urls:          c.doc_urls         ?? [],
        })
      }
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

  // ── Save ──────────────────────────────────────────────────
  async function saveContact() {
    if (!form.name.trim()) { showToast('El nombre es obligatorio', 'error'); return }
    if (form.email && !isValidEmail(form.email)) { setEmailError(true); showToast('Email no válido', 'error'); return }
    setSaving(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient()
    const sb = supabase as any

    // Company
    let companyId: string | null = form.company_id || null
    if (form.company_name.trim() && !companyId) {
      const existing = companies.find(c => c.name.toLowerCase() === form.company_name.trim().toLowerCase())
      if (existing) {
        companyId = existing.id
      } else {
        const { data: newCo } = await sb.from('crm_companies').insert({
          tenant_id: tenantId, name: form.company_name.trim(),
          cedula_juridica: form.company_cedula.trim() || null, created_by: userId,
        }).select().single()
        if (newCo) {
          companyId = (newCo as Company).id
          setCompanies(prev => [...prev, newCo as Company].sort((a, b) => a.name.localeCompare(b.name)))
        }
      }
    }

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
      company_id:        companyId,
      instagram:         form.instagram.trim()  || null,
      linkedin:          form.linkedin.trim()   || null,
      facebook:          form.facebook.trim()   || null,
      tiktok:            form.tiktok.trim()     || null,
      youtube:           form.youtube.trim()    || null,
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
      const ext = photoFile.name.split('.').pop() ?? 'jpg'
      const path = `${contactId}/avatar.${ext}`
      const { error: upErr } = await supabase.storage.from('contact-photos').upload(path, photoFile, { upsert: true, contentType: photoFile.type })
      if (!upErr) {
        finalPhotoUrl = supabase.storage.from('contact-photos').getPublicUrl(path).data.publicUrl
      }
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
        // Hacienda devuelve: NOMBRE(S) APELLIDO1 APELLIDO2
        // Las últimas 2 palabras son siempre los apellidos (estándar CR)
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

  async function lookupEmpresa() {
    const raw = form.company_cedula.replace(/[^0-9]/g, '')
    if (!raw) return
    try {
      const r = await fetch(`https://api.hacienda.go.cr/fe/ae?identificacion=${raw}`)
      if (!r.ok) throw new Error()
      const d = await r.json()
      if (d.nombre) {
        const nombre = toTitleCase(d.nombre)
        setForm(prev => ({ ...prev, company_name: nombre }))
        setEmpresaResult({ type: 'ok', msg: `✓ ${nombre}` })
      } else throw new Error()
    } catch {
      setEmpresaResult({ type: 'err', msg: 'No encontrada — ingresá el nombre manualmente' })
    }
  }

  // ── Company autocomplete ──────────────────────────────────
  function handleCompanyInput(val: string) {
    setForm(prev => ({ ...prev, company_name: val, company_id: '' }))
    if (val.length < 2) { setShowSuggestions(false); return }
    const matches = companies.filter(c => c.name.toLowerCase().includes(val.toLowerCase())).slice(0, 6)
    setCompanySuggestions(matches); setShowSuggestions(matches.length > 0)
  }

  function selectCompany(c: Company) {
    setForm(prev => ({ ...prev, company_name: c.name, company_cedula: c.cedula_juridica ?? '', company_id: c.id }))
    setShowSuggestions(false)
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
            const isConfirming = confirmDelete === c.id
            const isDeleting   = deleting === c.id

            return (
              <div key={c.id}
                onClick={() => !isConfirming && openDrawer(c.id)}
                style={{ background: '#fff', border: '1px solid #e2e5ea', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: isConfirming ? 'default' : 'pointer', transition: 'border-color .15s' }}
                onMouseEnter={e => { if (!isConfirming) (e.currentTarget as HTMLDivElement).style.borderColor = '#1B6EF3' }}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e5ea'}>

                {/* Avatar */}
                <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, overflow: 'hidden', background: bgLight, color: typeColor }}>
                  {c.photo_url
                    ? <img src={c.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initials}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0d0f12', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.name}{c.last_name ? ' ' + c.last_name : ''}
                  </div>
                  <div style={{ fontSize: 12, color: '#5a6070', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {c.phone              && <span>📱 {c.phone}</span>}
                    {c.email              && <span>✉ {c.email}</span>}
                    {c.crm_companies?.name && <span>🏢 {c.crm_companies.name}</span>}
                  </div>
                </div>

                {/* Type badge */}
                {c.contact_types?.name && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: bgLight, color: typeColor, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {c.contact_types.name}
                  </span>
                )}

                {/* Actions */}
                <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  {!isConfirming ? (
                    <>
                      <button title="WhatsApp" onClick={() => openWhatsapp(c.phone, c.phone_country)}
                        style={{ width: 30, height: 30, border: '1px solid #e2e5ea', borderRadius: 6, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>💬</button>
                      <button title="Eliminar" onClick={() => setConfirmDelete(c.id)}
                        style={{ width: 30, height: 30, border: '1px solid #e2e5ea', borderRadius: 6, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🗑</button>
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
                {/* Cédula */}
                <div style={{ flex: 1, ...sField }}>
                  <label style={sLabel}>Cédula / DIMEX / Pasaporte</label>
                  <input type="text" placeholder="1-2345-6789" maxLength={15}
                    value={form.cedula}
                    onChange={e => setForm(prev => ({ ...prev, cedula: formatCedula(e.target.value) }))}
                    style={sInput} />
                </div>
                {/* Tipo */}
                <div style={{ width: 148, ...sField }}>
                  <label style={sLabel}>Tipo</label>
                  <select value={form.cedula_tipo}
                    onChange={e => setForm(prev => ({ ...prev, cedula_tipo: e.target.value }))}
                    style={sInput}>
                    <option value="fisica">Física</option>
                    <option value="juridica">Jurídica</option>
                    <option value="dimex">DIMEX</option>
                    <option value="pasaporte">Pasaporte</option>
                  </select>
                </div>
                {/* Consultar */}
                <div style={{ ...sField, paddingTop: 22 }}>
                  <button onClick={lookupCedula} disabled={lookingUp} style={{ ...sLookupBtn, opacity: lookingUp ? .6 : 1 }}>
                    {lookingUp ? '…' : 'Consultar →'}
                  </button>
                </div>
              </div>
              {lookupResult && (
                <div style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, marginTop: 8, ...(lookupResult.type === 'ok' ? { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' } : { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }) }}>
                  {lookupResult.msg}
                </div>
              )}
              <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, display: 'block' }}>
                Consulta Hacienda CR — autocompleta nombre y apellidos (DIMEX no disponible)
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
                  <label style={sLabel}>Tipo de contacto</label>
                  <select value={form.type_id} onChange={e => setForm(prev => ({ ...prev, type_id: e.target.value }))} style={sInput}>
                    <option value="">Sin tipo</option>
                    {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div style={sField}>
                  <label style={sLabel}>Fuente / Canal</label>
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
                    onChange={e => { setEmailError(false); setForm(prev => ({ ...prev, email: e.target.value })) }}
                    style={{ ...sInput, borderColor: emailError ? '#fca5a5' : '#e2e5ea', background: emailError ? '#fef2f2' : '#fff' }} />
                  {emailError && <span style={{ fontSize: 11, color: '#DC2626' }}>Ingresá un email válido</span>}
                </div>
                <div style={sField}>
                  <label style={sLabel}>Teléfono / WhatsApp</label>
                  <PhoneInput
                    phoneValue={form.phone}
                    countryIso={form.phone_country}
                    onPhoneChange={v => setForm(prev => ({ ...prev, phone: v }))}
                    onCountryChange={iso => setForm(prev => ({ ...prev, phone_country: iso }))}
                    placeholder="8888-1234"
                  />
                </div>
                <div style={sField}>
                  <label style={sLabel}>Teléfono alternativo</label>
                  <PhoneInput
                    phoneValue={form.phone_alt}
                    countryIso={form.phone_alt_country}
                    onPhoneChange={v => setForm(prev => ({ ...prev, phone_alt: v }))}
                    onCountryChange={iso => setForm(prev => ({ ...prev, phone_alt_country: iso }))}
                    placeholder="2222-0000"
                  />
                </div>
              </div>
            </div>

            {/* ── EMPRESA ────────────────────────────────── */}
            <div style={sSec}>
              <div style={sSecLbl}>Empresa</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'start' }}>
                <div style={sField}>
                  <label style={sLabel}>Cédula jurídica</label>
                  <input type="text" placeholder="3-101-123456" value={form.company_cedula}
                    onChange={e => setForm(prev => ({ ...prev, company_cedula: e.target.value }))}
                    style={sInput} />
                  {empresaResult && (
                    <div style={{ fontSize: 12, padding: '5px 9px', borderRadius: 6, ...(empresaResult.type === 'ok' ? { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' } : { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }) }}>
                      {empresaResult.msg}
                    </div>
                  )}
                </div>
                <div style={{ paddingTop: 22 }}>
                  <button onClick={lookupEmpresa} style={sLookupBtn}>Consultar →</button>
                </div>
                <div style={{ ...sField, position: 'relative' }}>
                  <label style={sLabel}>Nombre de empresa</label>
                  <input type="text" placeholder="Inversiones XYZ S.A." value={form.company_name}
                    onChange={e => handleCompanyInput(e.target.value)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    style={sInput} />
                  {showSuggestions && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e5ea', borderRadius: 8, zIndex: 50, maxHeight: 160, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,.1)', marginTop: 2 }}>
                      {companySuggestions.map(c => (
                        <div key={c.id} onMouseDown={() => selectCompany(c)}
                          style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f4f5f7' }}
                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#f4f5f7'}
                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = ''}>
                          <strong>{c.name}</strong>
                          {c.cedula_juridica && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>{c.cedula_juridica}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
