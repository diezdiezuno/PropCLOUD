'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

// ── Types ─────────────────────────────────────────────────────
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
  phone_alt: string | null
  company_id: string | null
  instagram: string | null
  linkedin: string | null
  facebook: string | null
  tiktok: string | null
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
  email: string; phone: string; phone_alt: string
  company_name: string; company_cedula: string; company_id: string
  instagram: string; linkedin: string; facebook: string; tiktok: string
  notes: string
}

const EMPTY_FORM: FormState = {
  cedula: '', cedula_tipo: 'fisica', name: '', last_name: '',
  birth_date: '', type_id: '', source_id: '',
  email: '', phone: '', phone_alt: '',
  company_name: '', company_cedula: '', company_id: '',
  instagram: '', linkedin: '', facebook: '', tiktok: '',
  notes: '',
}

// ── Helpers ───────────────────────────────────────────────────
function formatCedula(val: string) {
  const v = val.replace(/[^0-9]/g, '')
  if (v.length <= 1) return v
  if (v.length <= 5)  return v[0] + '-' + v.slice(1)
  return v[0] + '-' + v.slice(1, 5) + '-' + v.slice(5, 13)
}

function formatPhone(val: string) {
  const v = val.replace(/[^0-9]/g, '').slice(0, 8)
  return v.length > 4 ? v.slice(0, 4) + '-' + v.slice(4) : v
}

function getInitials(name: string, lastName: string | null) {
  return ((name?.[0] ?? '') + (lastName?.[0] ?? '')).toUpperCase() || '?'
}

function openWhatsapp(phone: string | null) {
  if (!phone) return
  const num = phone.replace(/[^0-9]/g, '')
  const cr  = num.length <= 8 ? '506' + num : num
  window.open(`https://wa.me/${cr}`, '_blank')
}

// ── Component ─────────────────────────────────────────────────
export default function ClientesClient() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const isNew        = searchParams.get('new')

  const [tenantId, setTenantId]   = useState('')
  const [userId,   setUserId]     = useState('')
  const [contacts, setContacts]   = useState<Contact[]>([])
  const [types,    setTypes]      = useState<ContactType[]>([])
  const [sources,  setSources]    = useState<ContactSource[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [pageLoading, setPageLoading] = useState(true)

  // Filters
  const [search,       setSearch]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [form,       setForm]       = useState<FormState>({ ...EMPTY_FORM })
  const [saving,     setSaving]     = useState(false)

  // Company autocomplete
  const [companySuggestions, setCompanySuggestions] = useState<Company[]>([])
  const [showSuggestions,    setShowSuggestions]    = useState(false)

  // Hacienda lookup
  const [lookupResult,  setLookupResult]  = useState<LookupState>(null)
  const [empresaResult, setEmpresaResult] = useState<LookupState>(null)
  const [lookingUp,     setLookingUp]     = useState(false)

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting,      setDeleting]      = useState<string | null>(null)

  // ── Load contacts ──────────────────────────────────────────
  const loadContacts = useCallback(async (
    tid: string, q: string, type: string, source: string
  ) => {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('crm_contacts')
      .select('id,cedula,cedula_tipo,name,last_name,email,phone,phone_alt,company_id,type_id,source_id,instagram,linkedin,facebook,tiktok,notes,active,birth_date,contact_types(name,color),contact_sources(name),crm_companies(name)')
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
          supabase.from('contact_types')
            .select('id,name,color').eq('tenant_id', adminRec.tenant_id).order('position'),
          supabase.from('contact_sources')
            .select('id,name').eq('tenant_id', adminRec.tenant_id).order('position'),
          supabase.from('crm_companies')
            .select('id,name,cedula_juridica').eq('tenant_id', adminRec.tenant_id).order('name'),
        ])

      setTypes(typesData ?? [])
      setSources(sourcesData ?? [])
      setCompanies(companiesData ?? [])
      await loadContacts(adminRec.tenant_id, '', '', '')
      setPageLoading(false)
    })
  }, [loadContacts])

  // Auto-open drawer when ?new=1 (works even if already on page)
  useEffect(() => {
    if (isNew === '1' && tenantId) {
      openDrawer(null)
      router.replace('/admin/clientes')
    }
  // openDrawer is stable as defined below; tenantId guards readiness
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
    setCompanySuggestions([])
    setShowSuggestions(false)

    if (id) {
      const contact = contacts.find(c => c.id === id)
      if (contact) {
        const co = companies.find(c => c.id === contact.company_id)
        setForm({
          cedula:         contact.cedula        ?? '',
          cedula_tipo:    contact.cedula_tipo   ?? 'fisica',
          name:           contact.name          ?? '',
          last_name:      contact.last_name     ?? '',
          birth_date:     contact.birth_date    ?? '',
          type_id:        contact.type_id       ?? '',
          source_id:      contact.source_id     ?? '',
          email:          contact.email         ?? '',
          phone:          contact.phone         ?? '',
          phone_alt:      contact.phone_alt     ?? '',
          company_name:   co?.name              ?? '',
          company_cedula: co?.cedula_juridica   ?? '',
          company_id:     contact.company_id    ?? '',
          instagram:      contact.instagram     ?? '',
          linkedin:       contact.linkedin      ?? '',
          facebook:       contact.facebook      ?? '',
          tiktok:         contact.tiktok        ?? '',
          notes:          contact.notes         ?? '',
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

  // ── Save ──────────────────────────────────────────────────
  async function saveContact() {
    if (!form.name.trim()) { showToast('El nombre es obligatorio', 'error'); return }
    setSaving(true)
    const supabase = createClient()

    // Company management
    let companyId: string | null = form.company_id || null
    if (form.company_name.trim() && !companyId) {
      const existing = companies.find(
        c => c.name.toLowerCase() === form.company_name.trim().toLowerCase()
      )
      if (existing) {
        companyId = existing.id
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newCo } = await (supabase as any)
          .from('crm_companies')
          .insert({
            tenant_id:       tenantId,
            name:            form.company_name.trim(),
            cedula_juridica: form.company_cedula.trim() || null,
            created_by:      userId,
          })
          .select()
          .single()
        if (newCo) {
          companyId = (newCo as Company).id
          setCompanies(prev =>
            [...prev, newCo as Company].sort((a, b) => a.name.localeCompare(b.name))
          )
        }
      }
    }

    const payload = {
      cedula:     form.cedula.trim()     || null,
      cedula_tipo: form.cedula_tipo,
      name:       form.name.trim(),
      last_name:  form.last_name.trim()  || null,
      birth_date: form.birth_date        || null,
      type_id:    form.type_id           || null,
      source_id:  form.source_id         || null,
      email:      form.email.trim()      || null,
      phone:      form.phone.trim()      || null,
      phone_alt:  form.phone_alt.trim()  || null,
      company_id: companyId,
      instagram:  form.instagram.trim()  || null,
      linkedin:   form.linkedin.trim()   || null,
      facebook:   form.facebook.trim()   || null,
      tiktok:     form.tiktok.trim()     || null,
      notes:      form.notes.trim()      || null,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    let error
    if (editingId) {
      ;({ error } = await sb.from('crm_contacts').update(payload).eq('id', editingId))
    } else {
      ;({ error } = await sb.from('crm_contacts').insert({
        ...payload, tenant_id: tenantId, created_by: userId,
      }))
    }

    setSaving(false)
    if (error) { showToast('Error: ' + error.message, 'error'); return }
    showToast(editingId ? 'Cliente actualizado ✓' : 'Cliente creado ✓', 'success')
    closeDrawer()
    await loadContacts(tenantId, search, typeFilter, sourceFilter)
  }

  // ── Delete ────────────────────────────────────────────────
  async function deleteContact(id: string) {
    setDeleting(id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (createClient() as any)
      .from('crm_contacts').update({ active: false }).eq('id', id)
    setDeleting(null)
    setConfirmDelete(null)
    if (error) { showToast('Error al eliminar', 'error'); return }
    showToast('Cliente eliminado', 'success')
    await loadContacts(tenantId, search, typeFilter, sourceFilter)
  }

  // ── Hacienda lookup ───────────────────────────────────────
  async function lookupCedula() {
    const raw = form.cedula.replace(/[^0-9]/g, '')
    if (raw.length < 9) {
      setLookupResult({ type: 'err', msg: 'Ingresá una cédula válida (mínimo 9 dígitos)' })
      return
    }
    setLookingUp(true)
    try {
      const r = await fetch(`https://api.hacienda.go.cr/fe/ae?identificacion=${raw}`)
      if (!r.ok) throw new Error('no encontrado')
      const d = await r.json()
      if (d.nombre) {
        const parts = d.nombre.trim().split(' ')
        let name = d.nombre, last_name = ''
        if (form.cedula_tipo === 'fisica' && parts.length >= 3) {
          last_name = parts.slice(0, 2).join(' ')
          name      = parts.slice(2).join(' ')
        }
        setForm(prev => ({ ...prev, name, last_name }))
        const moroso = d.situacion?.moroso === 'SI' ? ' · ⚠ Moroso en Hacienda' : ''
        setLookupResult({ type: 'ok', msg: `✓ ${d.nombre}${moroso}` })
      } else {
        setLookupResult({ type: 'err', msg: 'No encontrado — completá los datos manualmente' })
      }
    } catch {
      setLookupResult({ type: 'err', msg: 'Sin resultado — completá los datos manualmente' })
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
        setForm(prev => ({ ...prev, company_name: d.nombre }))
        setEmpresaResult({ type: 'ok', msg: `✓ ${d.nombre}` })
      } else throw new Error()
    } catch {
      setEmpresaResult({ type: 'err', msg: 'No encontrada — ingresá el nombre manualmente' })
    }
  }

  // ── Company autocomplete ──────────────────────────────────
  function handleCompanyInput(val: string) {
    setForm(prev => ({ ...prev, company_name: val, company_id: '' }))
    if (val.length < 2) { setShowSuggestions(false); return }
    const matches = companies
      .filter(c => c.name.toLowerCase().includes(val.toLowerCase()))
      .slice(0, 6)
    setCompanySuggestions(matches)
    setShowSuggestions(matches.length > 0)
  }

  function selectCompany(c: Company) {
    setForm(prev => ({
      ...prev,
      company_name:   c.name,
      company_cedula: c.cedula_juridica ?? '',
      company_id:     c.id,
    }))
    setShowSuggestions(false)
  }

  // ── Social search ─────────────────────────────────────────
  function searchSocial(network: string) {
    const nombre = `${form.name} ${form.last_name}`.trim()
    const q = nombre ? `${nombre} site:${network}.com` : `site:${network}.com`
    window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank')
  }

  // ── Filter handlers ───────────────────────────────────────
  function handleSearch(val: string) {
    setSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => loadContacts(tenantId, val, typeFilter, sourceFilter), 300)
  }

  function handleTypeFilter(val: string) {
    setTypeFilter(val)
    loadContacts(tenantId, search, val, sourceFilter)
  }

  function handleSourceFilter(val: string) {
    setSourceFilter(val)
    loadContacts(tenantId, search, typeFilter, val)
  }

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
    width: '100%', boxSizing: 'border-box',
    outline: 'none',
  }
  const sLabel: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#5a6070',
    marginBottom: 4, display: 'block',
  }
  const sField: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 }
  const sSectionLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: '#9ca3af',
    letterSpacing: '.06em', textTransform: 'uppercase' as const,
    marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #e2e5ea',
  }
  const sLookupBtn: React.CSSProperties = {
    height: 38, padding: '0 14px',
    border: '1px solid #e2e5ea', borderRadius: 8,
    fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
    background: '#f4f5f7', color: '#0d0f12',
    cursor: 'pointer', whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  }

  // ── Loading ───────────────────────────────────────────────
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
            {contacts.length === 0 && !hasFilters
              ? 'Sin clientes aún.'
              : `${contacts.length} cliente${contacts.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => openDrawer(null)}
          style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Nuevo cliente
        </button>
      </div>

      {/* ── Toolbar ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
          <input
            id="clientes-search"
            type="text"
            placeholder="Buscar por nombre, cédula, email…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            style={{ ...sInput, paddingLeft: 36 }}
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => handleTypeFilter(e.target.value)}
          style={{ height: 38, padding: '0 12px', border: '1px solid #e2e5ea', borderRadius: 8, fontSize: 14, background: '#fff', color: '#0d0f12', fontFamily: 'inherit', cursor: 'pointer' }}>
          <option value="">Todos los tipos</option>
          {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select
          value={sourceFilter}
          onChange={e => handleSourceFilter(e.target.value)}
          style={{ height: 38, padding: '0 12px', border: '1px solid #e2e5ea', borderRadius: 8, fontSize: 14, background: '#fff', color: '#0d0f12', fontFamily: 'inherit', cursor: 'pointer' }}>
          <option value="">Todas las fuentes</option>
          {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* ── Contact list ─────────────────────────────────── */}
      {contacts.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '60px 24px', border: '1px solid #ebebeb', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#5a6070', margin: '0 0 8px' }}>
            {hasFilters ? 'Sin resultados' : 'Sin clientes aún'}
          </h3>
          <p style={{ fontSize: 14, color: '#9ca3af', margin: '0 0 20px' }}>
            {hasFilters
              ? 'Probá otra búsqueda o cambiá los filtros.'
              : 'Agregá el primer cliente del CRM.'}
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
              <div
                key={c.id}
                onClick={() => !isConfirming && openDrawer(c.id)}
                style={{
                  background: '#fff', border: '1px solid #e2e5ea', borderRadius: 10,
                  padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
                  cursor: isConfirming ? 'default' : 'pointer', transition: 'border-color .15s',
                }}
                onMouseEnter={e => { if (!isConfirming) (e.currentTarget as HTMLDivElement).style.borderColor = '#1B6EF3' }}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e5ea'}>

                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, background: bgLight, color: typeColor,
                }}>
                  {initials}
                </div>

                {/* Main info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0d0f12', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.name}{c.last_name ? ' ' + c.last_name : ''}
                  </div>
                  <div style={{ fontSize: 12, color: '#5a6070', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    {c.phone         && <span>📱 {c.phone}</span>}
                    {c.email         && <span>✉ {c.email}</span>}
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
                      <button
                        title="WhatsApp"
                        onClick={() => openWhatsapp(c.phone)}
                        style={{ width: 30, height: 30, border: '1px solid #e2e5ea', borderRadius: 6, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#5a6070' }}>
                        💬
                      </button>
                      <button
                        title="Eliminar"
                        onClick={() => setConfirmDelete(c.id)}
                        style={{ width: 30, height: 30, border: '1px solid #e2e5ea', borderRadius: 6, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#5a6070' }}>
                        🗑
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>¿Eliminar?</span>
                      <button
                        onClick={() => deleteContact(c.id)}
                        disabled={isDeleting}
                        style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#DC2626', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: isDeleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: isDeleting ? .6 : 1 }}>
                        {isDeleting ? '…' : 'Sí'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        style={{ fontSize: 12, color: '#666', background: 'none', border: '1px solid #e0e0e0', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                        No
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Slide-in drawer ──────────────────────────────── */}
      {drawerOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closeDrawer() }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(13,15,18,.45)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}>

          <div style={{ width: 560, maxWidth: '100vw', height: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,.12)', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #e2e5ea', flexShrink: 0 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: '#0d0f12' }}>
                {editingId ? 'Editar cliente' : 'Nuevo cliente'}
              </span>
              <button
                onClick={closeDrawer}
                style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#5a6070', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

              {/* IDENTIFICACIÓN */}
              <div style={{ marginBottom: 24 }}>
                <div style={sSectionLabel}>Identificación</div>
                <div style={{ display: 'grid', gap: 12 }}>

                  <div style={sField}>
                    <label style={sLabel}>Cédula / DIMEX / Pasaporte</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text" placeholder="1-2345-6789" maxLength={15}
                        value={form.cedula}
                        onChange={e => setForm(prev => ({ ...prev, cedula: formatCedula(e.target.value) }))}
                        style={{ ...sInput, flex: 1 }}
                      />
                      <button onClick={lookupCedula} disabled={lookingUp} style={{ ...sLookupBtn, opacity: lookingUp ? .6 : 1 }}>
                        {lookingUp ? 'Consultando…' : 'Consultar →'}
                      </button>
                    </div>
                    {lookupResult && (
                      <div style={{
                        fontSize: 12, padding: '6px 10px', borderRadius: 6, marginTop: 4,
                        ...(lookupResult.type === 'ok'
                          ? { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }
                          : { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }),
                      }}>
                        {lookupResult.msg}
                      </div>
                    )}
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>
                      Consulta Hacienda CR — autocompleta nombre si está registrado
                    </span>
                  </div>

                  <div style={sField}>
                    <label style={sLabel}>Tipo de identificación</label>
                    <select
                      value={form.cedula_tipo}
                      onChange={e => setForm(prev => ({ ...prev, cedula_tipo: e.target.value }))}
                      style={sInput}>
                      <option value="fisica">Cédula física</option>
                      <option value="juridica">Cédula jurídica</option>
                      <option value="dimex">DIMEX</option>
                      <option value="pasaporte">Pasaporte</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* DATOS PERSONALES */}
              <div style={{ marginBottom: 24 }}>
                <div style={sSectionLabel}>Datos personales</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={sField}>
                    <label style={sLabel}>Nombre *</label>
                    <input type="text" placeholder="María"
                      value={form.name}
                      onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                      style={sInput} autoFocus />
                  </div>
                  <div style={sField}>
                    <label style={sLabel}>Apellidos</label>
                    <input type="text" placeholder="Rodríguez Mora"
                      value={form.last_name}
                      onChange={e => setForm(prev => ({ ...prev, last_name: e.target.value }))}
                      style={sInput} />
                  </div>
                  <div style={sField}>
                    <label style={sLabel}>Fecha de nacimiento</label>
                    <input type="date"
                      value={form.birth_date}
                      onChange={e => setForm(prev => ({ ...prev, birth_date: e.target.value }))}
                      style={sInput} />
                  </div>
                  <div style={sField}>
                    <label style={sLabel}>Tipo de contacto</label>
                    <select
                      value={form.type_id}
                      onChange={e => setForm(prev => ({ ...prev, type_id: e.target.value }))}
                      style={sInput}>
                      <option value="">Sin tipo</option>
                      {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div style={sField}>
                    <label style={sLabel}>Fuente / Canal</label>
                    <select
                      value={form.source_id}
                      onChange={e => setForm(prev => ({ ...prev, source_id: e.target.value }))}
                      style={sInput}>
                      <option value="">Sin fuente</option>
                      {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* CONTACTO */}
              <div style={{ marginBottom: 24 }}>
                <div style={sSectionLabel}>Contacto</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={sField}>
                    <label style={sLabel}>Email</label>
                    <input type="email" placeholder="correo@ejemplo.com"
                      value={form.email}
                      onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                      style={sInput} />
                  </div>
                  <div style={sField}>
                    <label style={sLabel}>Teléfono / WhatsApp</label>
                    <input type="tel" placeholder="8888-1234"
                      value={form.phone}
                      onChange={e => setForm(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                      style={sInput} />
                  </div>
                  <div style={sField}>
                    <label style={sLabel}>Teléfono alternativo</label>
                    <input type="tel" placeholder="2222-0000"
                      value={form.phone_alt}
                      onChange={e => setForm(prev => ({ ...prev, phone_alt: formatPhone(e.target.value) }))}
                      style={sInput} />
                  </div>
                </div>
              </div>

              {/* EMPRESA */}
              <div style={{ marginBottom: 24 }}>
                <div style={sSectionLabel}>Empresa</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={sField}>
                    <label style={sLabel}>Nombre de empresa</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text" placeholder="Inversiones XYZ S.A."
                        value={form.company_name}
                        onChange={e => handleCompanyInput(e.target.value)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        style={sInput}
                      />
                      {showSuggestions && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e5ea', borderRadius: 8, zIndex: 50, maxHeight: 160, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,.1)', marginTop: 2 }}>
                          {companySuggestions.map(c => (
                            <div
                              key={c.id}
                              onMouseDown={() => selectCompany(c)}
                              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f4f5f7' }}
                              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#f4f5f7'}
                              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = ''}>
                              <strong>{c.name}</strong>
                              {c.cedula_juridica && (
                                <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>
                                  {c.cedula_juridica}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={sField}>
                    <label style={sLabel}>Cédula jurídica</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text" placeholder="3-101-123456"
                        value={form.company_cedula}
                        onChange={e => setForm(prev => ({ ...prev, company_cedula: e.target.value }))}
                        style={{ ...sInput, flex: 1 }}
                      />
                      <button onClick={lookupEmpresa} style={sLookupBtn}>Consultar →</button>
                    </div>
                    {empresaResult && (
                      <div style={{
                        fontSize: 12, padding: '6px 10px', borderRadius: 6, marginTop: 4,
                        ...(empresaResult.type === 'ok'
                          ? { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }
                          : { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }),
                      }}>
                        {empresaResult.msg}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* REDES SOCIALES */}
              <div style={{ marginBottom: 24 }}>
                <div style={sSectionLabel}>Redes sociales</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(
                    [
                      { key: 'instagram' as const, icon: '📸', placeholder: '@usuario o URL completa',   net: 'instagram' },
                      { key: 'linkedin'  as const, icon: '💼', placeholder: 'URL de LinkedIn',           net: 'linkedin'  },
                      { key: 'facebook'  as const, icon: '📘', placeholder: '@usuario o URL',            net: 'facebook'  },
                      { key: 'tiktok'    as const, icon: '🎵', placeholder: '@usuario',                  net: 'tiktok'    },
                    ]
                  ).map(({ key, icon, placeholder, net }) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
                      <input
                        type="text" placeholder={placeholder}
                        value={form[key]}
                        onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                        style={{ ...sInput, flex: 1 }}
                      />
                      <button
                        onClick={() => searchSocial(net)}
                        style={{ height: 38, padding: '0 12px', border: '1px solid #e2e5ea', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', background: '#f4f5f7', color: '#5a6070', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        Buscar ↗
                      </button>
                    </div>
                  ))}
                  <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                    &ldquo;Buscar ↗&rdquo; abre Google con el nombre del contacto + la red social para localizar el perfil correcto.
                  </p>
                </div>
              </div>

              {/* COMENTARIOS */}
              <div style={{ marginBottom: 24 }}>
                <div style={sSectionLabel}>Comentarios</div>
                <textarea
                  placeholder="Notas internas, preferencias, contexto del cliente…"
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={4}
                  style={{ ...sInput, height: 'auto', padding: '10px 12px', resize: 'none', lineHeight: 1.5 }}
                />
              </div>

            </div>{/* /body */}

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e5ea', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
              <button
                onClick={closeDrawer}
                style={{ height: 38, padding: '0 16px', background: '#fff', color: '#0d0f12', border: '1px solid #e2e5ea', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button
                onClick={saveContact}
                disabled={saving}
                style={{ height: 38, padding: '0 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1 }}>
                {saving ? 'Guardando…' : editingId ? 'Actualizar' : 'Guardar cliente'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700,
          zIndex: 999, fontFamily: 'system-ui, sans-serif', pointerEvents: 'none',
          ...(toast.type === 'success'
            ? { background: '#15803d', color: '#fff' }
            : { background: '#DC2626', color: '#fff' }),
        }}>
          {toast.msg}
        </div>
      )}
    </>
  )
}
