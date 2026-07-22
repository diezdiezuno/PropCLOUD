'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { getMembership } from '@/lib/membership'
import { countryHas } from '@/lib/country'
import PageHeader from '@/components/admin/PageHeader'
import { Icon } from '@/lib/icons'

// ── Types ─────────────────────────────────────────────────────
// Espeja la policy de crm_companies: admin, o el dueño sobre lo suyo. Las
// empresas viejas sin dueño quedan solo para el admin.
interface Company {
  id: string
  created_by: string | null
  name: string
  trade_name: string | null
  cedula_juridica: string | null
}

interface LinkedContact {
  id: string
  name: string
  last_name: string | null
  photo_url: string | null
  cedula: string | null
  crm_contact_types: { contact_types: { id?: string; name: string; color: string } | null }[] | null
}

interface FormState {
  name: string
  trade_name: string
  cedula_juridica: string
}

type LookupState = { type: 'ok' | 'err'; msg: string } | null

const EMPTY_FORM: FormState = { name: '', trade_name: '', cedula_juridica: '' }

// ── Helpers ───────────────────────────────────────────────────
function formatCedulaJuridica(val: string): string {
  const v = val.replace(/[^0-9]/g, '')
  if (v.length <= 1) return v
  if (v.length <= 4) return v[0] + '-' + v.slice(1)
  return v[0] + '-' + v.slice(1, 4) + '-' + v.slice(4, 10)
}

function getInitials(name: string, lastName: string | null) {
  return ((name?.[0] ?? '') + (lastName?.[0] ?? '')).toUpperCase() || '?'
}

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
function companyInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
const EditIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
)
const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M6 6v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6" /><path d="M10 11v6M14 11v6" />
  </svg>
)

// ── Component ─────────────────────────────────────────────────
export default function EmpresasClient() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const idParam      = searchParams.get('id')
  const newParam     = searchParams.get('new')

  const [tenantId,    setTenantId]    = useState('')
  const [tenantCountry, setTenantCountry] = useState('CR')
  const [userId,      setUserId]      = useState('')
  const [isAdmin,     setIsAdmin]     = useState(false)
  const [companies,   setCompanies]   = useState<Company[]>([])
  const [contactMap,  setContactMap]  = useState<Record<string, number>>({})
  const [pageLoading, setPageLoading] = useState(true)

  const [search,     setSearch]     = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [form,       setForm]       = useState<FormState>({ ...EMPTY_FORM })
  const [saving,     setSaving]     = useState(false)

  const [lookupResult, setLookupResult] = useState<LookupState>(null)
  const [lookingUp,    setLookingUp]    = useState(false)
  const [cedJurDupe,   setCedJurDupe]   = useState<{ id: string; name: string } | null>(null)

  // ── Linked contacts state ─────────────────────────────────
  const [linkedContacts,    setLinkedContacts]    = useState<LinkedContact[]>([])
  const [contactQuery,      setContactQuery]      = useState('')
  const [contactResults,    setContactResults]    = useState<LinkedContact[]>([])
  const [contactSearching,  setContactSearching]  = useState(false)
  const [showResults,       setShowResults]       = useState(false)
  const [linking,           setLinking]           = useState<string | null>(null)
  const [unlinking,         setUnlinking]         = useState<string | null>(null)
  const contactQueryTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contactSearchRef   = useRef<HTMLDivElement>(null)

  const [toast,         setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting,      setDeleting]      = useState<string | null>(null)
  const [showArchived,  setShowArchived]  = useState(false)

  // Paginación y orden
  type SortKey = 'name' | 'razon' | 'cedula' | 'count'
  const [page,     setPage]     = useState(0)
  const [pageSize, setPageSize] = useState<number>(25)   // 0 = todos
  const [sortKey,  setSortKey]  = useState<SortKey>('name')
  const [sortDir,  setSortDir]  = useState<'asc' | 'desc'>('asc')
  function changePageSize(n: number) { setPageSize(n); setPage(0); localStorage.setItem('empresas_page_size', String(n)) }
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setPage(0)
  }

  // Anchos de columna: Nombre, Razón social, Cédula jurídica, Clientes (redimensionables) + Acciones (fija)
  const ACTIONS_W = 88
  const DEFAULT_COLS = [320, 260, 180, 120, ACTIONS_W]
  const [colWidths, setColWidths] = useState<number[]>(DEFAULT_COLS)
  const colWidthsRef = useRef(colWidths)
  const dragRef = useRef<{ idx: number; startX: number; startW: number } | null>(null)
  const onColMove = useCallback((e: MouseEvent) => {
    const d = dragRef.current; if (!d) return
    const w = Math.max(60, d.startW + e.clientX - d.startX)
    setColWidths(prev => { const n = [...prev]; n[d.idx] = w; colWidthsRef.current = n; return n })
  }, [])
  const onColUp = useCallback(() => {
    dragRef.current = null
    window.removeEventListener('mousemove', onColMove)
    window.removeEventListener('mouseup', onColUp)
    localStorage.setItem('empresas_col_widths', JSON.stringify(colWidthsRef.current))
    document.body.style.cursor = ''
  }, [onColMove])
  function startColResize(e: React.MouseEvent, idx: number) {
    e.preventDefault(); e.stopPropagation()
    dragRef.current = { idx, startX: e.clientX, startW: colWidths[idx] }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', onColMove)
    window.addEventListener('mouseup', onColUp)
  }
  useEffect(() => {
    const ps = localStorage.getItem('empresas_page_size')
    if (ps !== null && !isNaN(Number(ps))) setPageSize(Number(ps))
    try {
      const cw = JSON.parse(localStorage.getItem('empresas_col_widths') || 'null')
      if (Array.isArray(cw) && cw.length === DEFAULT_COLS.length && cw.every(n => typeof n === 'number')) {
        cw[cw.length - 1] = ACTIONS_W
        setColWidths(cw); colWidthsRef.current = cw
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load companies ────────────────────────────────────────
  const loadCompanies = useCallback(async (tid: string, q: string, archived = false) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createClient() as any
    let query = sb
      .from('crm_companies')
      .select('id,created_by,name,trade_name,cedula_juridica')
      .eq('tenant_id', tid)
      .eq('active', !archived)
      .order('name')
    if (q) query = query.ilike('name', `%${q}%`)
    const { data } = await query
    setCompanies((data ?? []) as Company[])
  }, [])

  const loadContactCounts = useCallback(async (tid: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (createClient() as any)
      .from('crm_contact_companies')
      .select('company_id')
      .eq('tenant_id', tid)
    const map: Record<string, number> = {}
    for (const row of data ?? []) {
      if (row.company_id) map[row.company_id] = (map[row.company_id] ?? 0) + 1
    }
    setContactMap(map)
  }, [])

  // ── Load linked contacts for a company ────────────────────
  const loadLinkedContacts = useCallback(async (companyId: string, tid: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (createClient() as any)
      .from('crm_contact_companies')
      .select('crm_contacts(id,name,last_name,photo_url,cedula,crm_contact_types(contact_types(id,name,color)))')
      .eq('company_id', companyId)
      .eq('tenant_id', tid)
    const contacts = (data ?? [])
      .map((r: { crm_contacts: LinkedContact | null }) => r.crm_contacts)
      .filter(Boolean) as LinkedContact[]
    contacts.sort((a, b) => a.name.localeCompare(b.name))
    setLinkedContacts(contacts)
  }, [])

  // ── Init ──────────────────────────────────────────────────
  useEffect(() => {
    getMembership().then(async m => {
      if (!m) return
      setTenantId(m.tenantId)
      setTenantCountry(m.country)
      setUserId(m.userId)
      setIsAdmin(m.isAdmin)
      await Promise.all([
        loadCompanies(m.tenantId, ''),
        loadContactCounts(m.tenantId),
      ])
      setPageLoading(false)
    })
  }, [loadCompanies, loadContactCounts])

  // Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && drawerOpen) setDrawerOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [drawerOpen])

  // Auto-open drawer from ?id=X (from property owner link)
  useEffect(() => {
    if (!idParam || !tenantId || pageLoading) return
    const co = companies.find(c => c.id === idParam)
    if (co) {
      openDrawer(co)
      router.replace('/admin/empresas')
    } else {
      // Company not in current list — fetch it directly
      createClient().from('crm_companies').select('id,created_by,name,trade_name,cedula_juridica')
        .eq('id', idParam).single()
        .then(({ data }) => {
          if (data) { openDrawer(data as Company); router.replace('/admin/empresas') }
        })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam, tenantId, pageLoading])

  // Auto-open drawer en modo crear desde ?new=1 (quick-add del topbar)
  useEffect(() => {
    if (!newParam || !tenantId || pageLoading) return
    openDrawer(null)
    router.replace('/admin/empresas')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newParam, tenantId, pageLoading])

  // Close contact results on outside click
  useEffect(() => {
    if (!showResults) return
    function handler(e: MouseEvent) {
      if (contactSearchRef.current?.contains(e.target as Node)) return
      setShowResults(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showResults])

  // ── Drawer ────────────────────────────────────────────────
  function openDrawer(company: Company | null) {
    setEditingId(company?.id ?? null)
    setLookupResult(null)
    setCedJurDupe(null)
    setContactQuery('')
    setContactResults([])
    setLinkedContacts([])
    setShowResults(false)
    setForm(company
      ? { name: company.name, trade_name: company.trade_name ?? '', cedula_juridica: company.cedula_juridica ?? '' }
      : { ...EMPTY_FORM }
    )
    if (company?.id && tenantId) {
      loadLinkedContacts(company.id, tenantId)
    }
    setDrawerOpen(true)
  }

  // ── Duplicate check ───────────────────────────────────────
  async function checkCedJurDupe() {
    const raw = form.cedula_juridica.trim()
    if (!raw) { setCedJurDupe(null); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (createClient() as any)
      .from('crm_companies').select('id,name')
      .eq('tenant_id', tenantId).eq('cedula_juridica', raw)
    if (editingId) q = q.neq('id', editingId)
    const { data } = await q.limit(1)
    setCedJurDupe(data?.[0] ?? null)
  }

  // ── Hacienda lookup ───────────────────────────────────────
  async function lookupCedula() {
    const raw = form.cedula_juridica.replace(/[^0-9]/g, '')
    if (raw.length < 9) { setLookupResult({ type: 'err', msg: 'Mínimo 9 dígitos' }); return }
    setLookingUp(true)
    setLookupResult(null)
    try {
      const r = await fetch(`https://api.hacienda.go.cr/fe/ae?identificacion=${raw}`)
      if (!r.ok) throw new Error()
      const d = await r.json()
      if (d.nombre) {
        setForm(prev => ({ ...prev, name: d.nombre.trim() }))
        const moroso = d.situacion?.moroso === 'SI' ? ' · ⚠ Morosidad en Hacienda' : ''
        setLookupResult({ type: 'ok', msg: `✓ ${d.nombre.trim()}${moroso}` })
      } else {
        setLookupResult({ type: 'err', msg: 'No encontrada — ingresá el nombre manualmente' })
      }
    } catch {
      setLookupResult({ type: 'err', msg: 'Sin resultado — ingresá el nombre manualmente' })
    }
    setLookingUp(false)
  }

  // ── Contact search ────────────────────────────────────────
  function handleContactQuery(val: string) {
    setContactQuery(val)
    setShowResults(true)
    if (contactQueryTimer.current) clearTimeout(contactQueryTimer.current)
    if (!val.trim()) { setContactResults([]); setShowResults(false); return }
    contactQueryTimer.current = setTimeout(() => searchContacts(val), 250)
  }

  async function searchContacts(q: string) {
    if (!tenantId) return
    setContactSearching(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (createClient() as any)
      .from('crm_contacts')
      .select('id,name,last_name,photo_url,cedula,crm_contact_types(contact_types(id,name,color))')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .or(`name.ilike.%${q}%,last_name.ilike.%${q}%,cedula.ilike.%${q}%`)
      .order('name')
      .limit(10)
    const linkedIds = new Set(linkedContacts.map(c => c.id))
    setContactResults(((data ?? []) as LinkedContact[]).filter(c => !linkedIds.has(c.id)))
    setContactSearching(false)
  }

  // ── Link / Unlink ─────────────────────────────────────────
  async function linkContact(contact: LinkedContact) {
    if (!editingId) return
    setLinking(contact.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (createClient() as any)
      .from('crm_contact_companies')
      .insert({ tenant_id: tenantId, contact_id: contact.id, company_id: editingId })
    setLinking(null)
    if (error) { showToast('Error al vincular: ' + error.message, 'error'); return }

    setContactQuery('')
    setContactResults([])
    setShowResults(false)
    setLinkedContacts(prev =>
      [...prev, contact].sort((a, b) => a.name.localeCompare(b.name))
    )
    setContactMap(prev => ({ ...prev, [editingId]: (prev[editingId] ?? 0) + 1 }))
  }

  async function unlinkContact(contactId: string) {
    if (!editingId) return
    setUnlinking(contactId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (createClient() as any)
      .from('crm_contact_companies')
      .delete()
      .eq('contact_id', contactId)
      .eq('company_id', editingId)
    setUnlinking(null)
    if (error) { showToast('Error al desvincular: ' + error.message, 'error'); return }
    setLinkedContacts(prev => prev.filter(c => c.id !== contactId))
    setContactMap(prev => ({ ...prev, [editingId]: Math.max(0, (prev[editingId] ?? 1) - 1) }))
  }

  // ── Save ──────────────────────────────────────────────────
  async function save() {
    if (!form.cedula_juridica.trim()) { showToast('La cédula jurídica es obligatoria', 'error'); return }
    if (!form.name.trim())            { showToast('La razón social es obligatoria', 'error'); return }

    // Fresh duplicate check on save
    if (form.cedula_juridica.trim()) {
      setSaving(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (createClient() as any)
        .from('crm_companies').select('id,name')
        .eq('tenant_id', tenantId).eq('cedula_juridica', form.cedula_juridica.trim())
      if (editingId) q = q.neq('id', editingId)
      const { data } = await q.limit(1)
      if (data?.[0]) {
        setCedJurDupe(data[0])
        showToast(`Cédula ya registrada: ${data[0].name}`, 'error')
        setSaving(false); return
      }
      setSaving(false)
    }

    setSaving(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createClient() as any

    const payload = {
      name:            form.name.trim(),
      trade_name:      form.trade_name.trim() || null,
      cedula_juridica: form.cedula_juridica.trim() || null,
    }

    if (editingId) {
      const { error } = await sb.from('crm_companies').update(payload).eq('id', editingId)
      setSaving(false)
      if (error) { showToast('Error: ' + error.message, 'error'); return }
      showToast('Empresa actualizada ✓', 'success')
      // Update local list
      setCompanies(prev => prev.map(co =>
        co.id === editingId ? { ...co, ...payload } : co
      ))
      setDrawerOpen(false)
      await loadCompanies(tenantId, search, showArchived)
    } else {
      // Create
      const { data: newCo, error } = await sb
        .from('crm_companies')
        .insert({ ...payload, tenant_id: tenantId, created_by: userId })
        .select('id').single()
      setSaving(false)
      if (error) { showToast('Error: ' + error.message, 'error'); return }

      const newId = newCo.id as string
      // Stay in drawer, switch to edit mode for linking
      setEditingId(newId)
      setCompanies(prev =>
        [...prev, { id: newId, created_by: userId, name: payload.name, trade_name: payload.trade_name ?? null, cedula_juridica: payload.cedula_juridica }]
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      showToast('Empresa creada ✓ — ahora podés vincular contactos', 'success')
    }
  }

  // ── Delete ────────────────────────────────────────────────
  async function deleteCompany(id: string) {
    setDeleting(id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (createClient() as any).from('crm_companies').update({ active: false }).eq('id', id)
    setDeleting(null)
    setConfirmDelete(null)
    if (error) { showToast('Error al archivar', 'error'); return }
    showToast('Empresa archivada', 'success')
    setCompanies(prev => prev.filter(co => co.id !== id))
  }
  async function restoreCompany(id: string) {
    setDeleting(id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (createClient() as any).from('crm_companies').update({ active: true }).eq('id', id)
    setDeleting(null)
    if (error) { showToast('Error al restaurar', 'error'); return }
    showToast('Empresa restaurada', 'success')
    setCompanies(prev => prev.filter(co => co.id !== id))
  }

  // ── Search ────────────────────────────────────────────────
  function handleSearch(val: string) {
    setSearch(val); setPage(0)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => loadCompanies(tenantId, val, showArchived), 300)
  }
  function toggleArchived() {
    const next = !showArchived
    setShowArchived(next); setPage(0)
    loadCompanies(tenantId, search, next)
  }

  // ── Toast ─────────────────────────────────────────────────
  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Style tokens ─────────────────────────────────────────
  const sInput: React.CSSProperties = {
    height: 38, padding: '0 12px',
    border: '1px solid #e2e5ea', borderRadius: 8,
    fontSize: 14, fontFamily: 'system-ui, sans-serif',
    background: '#fff', color: '#0d0f12',
    width: '100%', boxSizing: 'border-box', outline: 'none',
  }
  const sLabel: React.CSSProperties  = { fontSize: 12, fontWeight: 600, color: '#5a6070', marginBottom: 4, display: 'block' }
  const sField: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 4 }
  const sSecLbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '.06em', textTransform: 'uppercase' as const, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #e2e5ea' }

  if (pageLoading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>

  const hasSearch = !!search

  // Orden + paginación (cliente)
  const sortVal = (co: Company): string | number => {
    switch (sortKey) {
      case 'razon':  return co.name.toLowerCase()
      case 'cedula': return (co.cedula_juridica ?? '').toLowerCase()
      case 'count':  return contactMap[co.id] ?? 0
      default:       return (co.trade_name || co.name).toLowerCase()
    }
  }
  const sorted = [...companies].sort((a, b) => {
    const va = sortVal(a), vb = sortVal(b)
    if (va === vb) return 0
    if (typeof va === 'string' && va === '') return 1
    if (typeof vb === 'string' && vb === '') return -1
    return (va < vb ? -1 : 1) * (sortDir === 'asc' ? 1 : -1)
  })
  const total      = sorted.length
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize))
  const safePage   = Math.min(page, totalPages - 1)
  const pageStart  = pageSize === 0 ? 0 : safePage * pageSize
  const pageEnd    = pageSize === 0 ? total : Math.min(pageStart + pageSize, total)
  const paged      = pageSize === 0 ? sorted : sorted.slice(pageStart, pageEnd)

  return (
    <>
      {/* ── Header ─────────────────────────────────────────── */}
      <PageHeader title="Empresas"
        subtitle={companies.length === 0 && !hasSearch ? 'Sin empresas aún.' : `${companies.length} empresa${companies.length !== 1 ? 's' : ''}`}
        right={
          <button onClick={() => openDrawer(null)}
            style={{ background: 'var(--color-primary, #111)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Nueva empresa
          </button>
        } />

      {/* ── Toolbar ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none', display: 'flex' }}><Icon name="search" size={15} /></span>
          <input type="text" placeholder="Buscar por nombre…" value={search}
            onChange={e => handleSearch(e.target.value)}
            style={{ ...sInput, paddingLeft: 36 }} />
        </div>
        <button onClick={toggleArchived} title="Ver empresas archivadas"
          style={{ height: 38, padding: '0 14px', border: `1px solid ${showArchived ? '#0d0f12' : '#e2e5ea'}`, borderRadius: 8, fontSize: 13, fontWeight: 600, background: showArchived ? '#0d0f12' : '#fff', color: showArchived ? '#fff' : '#5a6070', fontFamily: 'inherit', cursor: 'pointer' }}>
          {showArchived ? 'Ver activas' : 'Archivadas'}
        </button>
        <select value={pageSize} onChange={e => changePageSize(Number(e.target.value))} title="Registros por página"
          style={{ height: 38, padding: '0 10px', border: '1px solid #e2e5ea', borderRadius: 8, fontSize: 13, background: '#fff', color: '#0d0f12', fontFamily: 'inherit', cursor: 'pointer', marginLeft: 'auto' }}>
          {[25, 50, 100].map(n => <option key={n} value={n}>{n} / pág.</option>)}
          <option value={0}>Todos</option>
        </select>
      </div>

      {/* ── List ───────────────────────────────────────────── */}
      {companies.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '60px 24px', border: '1px solid #ebebeb', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: '#c5cad3' }}><Icon name="building" size={32} /></div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#5a6070', margin: '0 0 8px' }}>
            {hasSearch ? 'Sin resultados' : 'Sin empresas aún'}
          </h3>
          <p style={{ fontSize: 14, color: '#9ca3af', margin: '0 0 20px' }}>
            {hasSearch ? 'Probá otra búsqueda.' : 'Agregá la primera empresa del CRM.'}
          </p>
          {!hasSearch && (
            <button onClick={() => openDrawer(null)}
              style={{ background: 'var(--color-primary, #111)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              + Nueva empresa
            </button>
          )}
        </div>
      ) : (
        <>
          <style>{`
            .em-trow:hover { background:#f9fafb; }
            .em-trow .em-actions { opacity:0; transition:opacity .15s; }
            .em-trow:hover .em-actions { opacity:1; }
            .em-btn { width:28px; height:28px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .12s; background:transparent; border:none; color:#9ca3af; }
            .em-btn:hover { background:#f0f1f3; color:#5a6070; }
            .em-btn-del:hover { background:#FEF2F2; color:#DC2626; }
            .em-resize { border-right:2px solid transparent; box-sizing:border-box; }
            .em-resize:hover { border-right-color:#9ca3af; }
          `}</style>

          <div style={{ background: '#fff', border: '1px solid #e2e5ea', borderRadius: 12, overflowX: 'auto' }}>
            <table style={{ width: colWidths.reduce((a, b) => a + b, 0), minWidth: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
              </colgroup>
              <thead>
                <tr style={{ background: '#f9fafb', color: '#5a6070', textAlign: 'left' }}>
                  {([['Nombre', 'name'], ['Razón social', 'razon'], ['Cédula jurídica', 'cedula'], ['Contactos', 'count'], ['', null]] as [string, SortKey | null][]).map(([label, key], i) => (
                    <th key={i}
                      onClick={key ? () => toggleSort(key) : undefined}
                      style={{ padding: '9px 12px', fontWeight: 500, position: 'relative', cursor: key ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap', borderRight: i < colWidths.length - 1 ? '1px solid #e5e7eb' : undefined }}>
                      {label}{key && sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                      {i < colWidths.length - 1 && (
                        <span className="em-resize" onMouseDown={e => startColResize(e, i)}
                          style={{ position: 'absolute', right: -4, top: 0, height: '100%', width: 8, cursor: 'col-resize', zIndex: 2 }} />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map(co => {
                  const count = contactMap[co.id] ?? 0
                  const isConfirming = confirmDelete === co.id
                  const isDeleting = deleting === co.id
                  const display = co.trade_name || co.name
                  const ac = nameToColor(display)
                  return (
                    <tr key={co.id} className="em-trow" style={{ borderTop: '1px solid #eef0f2' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <div onClick={() => openDrawer(co)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minWidth: 0 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: ac + '20', border: `2px solid ${ac}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: ac, flexShrink: 0, letterSpacing: '-0.5px' }}>{companyInitials(display)}</div>
                          <span style={{ fontWeight: 600, color: '#0d0f12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display}</span>
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#5a6070', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.name}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: co.cedula_juridica ? '#5a6070' : '#c5cad3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.cedula_juridica || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: count > 0 ? '#EEF4FF' : '#F4F5F7', color: count > 0 ? '#1B6EF3' : '#9ca3af', whiteSpace: 'nowrap' }}>{count}</span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <div className="em-actions" onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {!(isAdmin || (!!co.created_by && co.created_by === userId)) ? null : showArchived ? (
                            <button onClick={() => restoreCompany(co.id)} disabled={isDeleting}
                              style={{ fontSize: 12, fontWeight: 600, color: '#0d0f12', background: '#fff', border: '1px solid #e2e5ea', borderRadius: 7, padding: '5px 12px', cursor: isDeleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: isDeleting ? .6 : 1 }}>{isDeleting ? '…' : 'Restaurar'}</button>
                          ) : !isConfirming ? (
                            <>
                              <button className="em-btn em-btn-edit" title="Editar" onClick={() => openDrawer(co)}><EditIcon /></button>
                              <button className="em-btn em-btn-del" title="Archivar" onClick={() => setConfirmDelete(co.id)}><TrashIcon /></button>
                            </>
                          ) : (
                            <>
                              <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>¿Archivar?</span>
                              <button onClick={() => deleteCompany(co.id)} disabled={isDeleting}
                                style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#DC2626', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: isDeleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: isDeleting ? .6 : 1 }}>{isDeleting ? '…' : 'Sí'}</button>
                              <button onClick={() => setConfirmDelete(null)}
                                style={{ fontSize: 12, color: '#666', background: 'none', border: '1px solid #e0e0e0', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>No</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {pageSize !== 0 && totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>{pageStart + 1}–{pageEnd} de {total}</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button disabled={safePage <= 0} onClick={() => setPage(safePage - 1)}
                  style={{ height: 34, padding: '0 12px', border: '1px solid #e2e5ea', borderRadius: 8, background: '#fff', color: safePage <= 0 ? '#c5cad3' : '#0d0f12', cursor: safePage <= 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit' }}>‹ Anterior</button>
                <span style={{ fontSize: 12, color: '#5a6070', fontVariantNumeric: 'tabular-nums', padding: '0 4px' }}>Página {safePage + 1} de {totalPages}</span>
                <button disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}
                  style={{ height: 34, padding: '0 12px', border: '1px solid #e2e5ea', borderRadius: 8, background: '#fff', color: safePage >= totalPages - 1 ? '#c5cad3' : '#0d0f12', cursor: safePage >= totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Siguiente ›</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Drawer ─────────────────────────────────────────── */}
      <div
        onClick={e => { if (e.target === e.currentTarget) setDrawerOpen(false) }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(13,15,18,.45)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', opacity: drawerOpen ? 1 : 0, pointerEvents: drawerOpen ? 'all' : 'none', transition: 'opacity .2s' }}>

        <div style={{ width: 520, maxWidth: '100vw', height: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,.12)', overflow: 'hidden', transform: drawerOpen ? 'translateX(0)' : 'translateX(40px)', transition: 'transform .2s' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #e2e5ea', flexShrink: 0 }}>
            <div>
              <span style={{ fontSize: 17, fontWeight: 700, color: '#0d0f12' }}>
                {editingId ? 'Editar empresa' : 'Nueva empresa'}
              </span>
              {editingId && linkedContacts.length > 0 && (
                <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#EEF4FF', color: '#1B6EF3' }}>
                  {linkedContacts.length} cliente{linkedContacts.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <button onClick={() => setDrawerOpen(false)}
              style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#5a6070', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ✕
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

            {/* ── IDENTIFICACIÓN ─────────────────────────── */}
            <div style={{ marginBottom: 28 }}>
              <div style={sSecLbl}>Identificación</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, ...sField }}>
                  <label style={sLabel}>Cédula jurídica</label>
                  <input
                    type="text" placeholder="3-101-123456" maxLength={12}
                    value={form.cedula_juridica}
                    onChange={e => {
                      setCedJurDupe(null)
                      setLookupResult(null)
                      setForm(prev => ({ ...prev, cedula_juridica: formatCedulaJuridica(e.target.value) }))
                    }}
                    onBlur={checkCedJurDupe}
                    onKeyDown={e => { if (e.key === 'Enter') lookupCedula() }}
                    style={{ ...sInput, borderColor: cedJurDupe ? '#FDE68A' : '#e2e5ea', background: cedJurDupe ? '#FFFBEB' : '#fff' }} />
                </div>
                {countryHas(tenantCountry, 'hacienda') && (
                  <div style={{ ...sField, paddingTop: 22 }}>
                    <button onClick={lookupCedula} disabled={lookingUp}
                      style={{ height: 38, padding: '0 14px', border: '1px solid #e2e5ea', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: '#f4f5f7', color: '#0d0f12', cursor: lookingUp ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' as const, opacity: lookingUp ? .6 : 1 }}>
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
              {cedJurDupe && (
                <div style={{ fontSize: 12, padding: '7px 10px', borderRadius: 6, marginTop: 6, background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92610A', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⚠</span>
                  <span>Ya existe una empresa con esta cédula: <strong>{cedJurDupe.name}</strong></span>
                </div>
              )}
              <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, display: 'block' }}>
                {countryHas(tenantCountry, 'hacienda') ? 'Consulta Hacienda CR — autocompleta razón social. Enter para consultar.' : 'Ingresá la identificación fiscal de la empresa.'}
              </span>
            </div>

            {/* ── DATOS DE LA EMPRESA ─────────────────────── */}
            <div style={{ marginBottom: 28 }}>
              <div style={sSecLbl}>Datos de la empresa</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={sField}>
                  <label style={sLabel}>Razón social *</label>
                  <input
                    type="text" placeholder="Inversiones XYZ Sociedad Anónima"
                    value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                    style={sInput} />
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>
                    Se autocompleta con la búsqueda de Hacienda, o ingresalo manualmente.
                  </span>
                </div>
                <div style={sField}>
                  <label style={sLabel}>Nombre fantasía</label>
                  <input
                    type="text" placeholder="XYZ Inversiones"
                    value={form.trade_name}
                    onChange={e => setForm(prev => ({ ...prev, trade_name: e.target.value }))}
                    style={sInput} />
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>
                    Nombre comercial con el que opera el negocio, si es diferente a la razón social.
                  </span>
                </div>
              </div>
            </div>

            {/* ── CLIENTES VINCULADOS ─────────────────────── */}
            <div style={{ marginBottom: 12 }}>
              <div style={sSecLbl}>
                Clientes vinculados
                {editingId && linkedContacts.length > 0 &&
                  <span style={{ marginLeft: 6, fontWeight: 400, color: '#9ca3af' }}>({linkedContacts.length})</span>
                }
              </div>

              {!editingId ? (
                /* New company — prompt to save first */
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10 }}>
                  <span style={{ display: 'flex', color: '#D97706' }}><Icon name="lightbulb" size={18} /></span>
                  <span style={{ fontSize: 13, color: '#92610A' }}>
                    Guardá la empresa primero para poder vincular contactos.
                  </span>
                </div>
              ) : (
                <>
                  {/* Contact search */}
                  <div ref={contactSearchRef} style={{ position: 'relative', marginBottom: 12 }}>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none', display: 'flex' }}>
                        {contactSearching ? <span style={{ fontSize: 14 }}>⏳</span> : <Icon name="search" size={15} />}
                      </span>
                      <input
                        type="text"
                        placeholder="Buscar y vincular contacto por nombre o cédula…"
                        value={contactQuery}
                        onChange={e => handleContactQuery(e.target.value)}
                        onFocus={() => { if (contactResults.length > 0) setShowResults(true) }}
                        style={{ ...sInput, paddingLeft: 36, paddingRight: contactQuery ? 36 : 12 }}
                      />
                      {contactQuery && (
                        <button
                          onClick={() => { setContactQuery(''); setContactResults([]); setShowResults(false) }}
                          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, lineHeight: 1, padding: 0 }}>
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Search results dropdown */}
                    {showResults && contactResults.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e5ea', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 50, overflow: 'hidden', marginTop: 4 }}>
                        {contactResults.map(c => {
                          const cTypes = (c.crm_contact_types ?? []).map(r => r.contact_types).filter(Boolean) as { id?: string; name: string; color: string }[]
                          const ac  = nameToColor(c.name + (c.last_name ?? ''))
                          return (
                            <div
                              key={c.id}
                              onClick={() => linkContact(c)}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: linking === c.id ? 'not-allowed' : 'pointer', borderBottom: '1px solid #f4f5f7', transition: 'background .1s' }}
                              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#f9fafb'}
                              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                            >
                              {/* Avatar */}
                              <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: c.photo_url ? 'transparent' : ac + '22', border: `2px solid ${ac}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: ac }}>
                                {c.photo_url
                                  ? <img src={c.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : getInitials(c.name, c.last_name)}
                              </div>
                              {/* Info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#0d0f12', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {c.name}{c.last_name ? ' ' + c.last_name : ''}
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 1 }}>
                                  {c.cedula && <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{c.cedula}</span>}
                                </div>
                              </div>
                              {/* Type badges (múltiples) */}
                              {cTypes.length > 0 && (
                                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0, maxWidth: 160 }}>
                                  {cTypes.map((t, i) => (
                                    <span key={t.id ?? i} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: (t.color || '#1B6EF3') + '18', color: t.color || '#1B6EF3', whiteSpace: 'nowrap' }}>
                                      {t.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {/* Link icon */}
                              <span style={{ fontSize: 14, color: '#1B6EF3', flexShrink: 0 }}>
                                {linking === c.id ? '⏳' : '＋'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* No results message */}
                    {showResults && contactQuery.trim() && !contactSearching && contactResults.length === 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e5ea', borderRadius: 10, padding: '14px 16px', marginTop: 4, fontSize: 13, color: '#9ca3af', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,.08)', zIndex: 50 }}>
                        Sin clientes disponibles para esa búsqueda
                      </div>
                    )}
                  </div>

                  {/* Linked contacts list */}
                  {linkedContacts.length === 0 ? (
                    <div style={{ padding: '20px 16px', background: '#F9FAFB', borderRadius: 10, border: '1px dashed #e2e5ea', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6, color: '#c5cad3' }}><Icon name="users" size={22} /></div>
                      <div style={{ fontSize: 13, color: '#9ca3af' }}>Sin contactos vinculados aún</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {linkedContacts.map(c => {
                        const cTypes = (c.crm_contact_types ?? []).map(r => r.contact_types).filter(Boolean) as { id?: string; name: string; color: string }[]
                        const ac  = nameToColor(c.name + (c.last_name ?? ''))
                        return (
                          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#F9FAFB', borderRadius: 10, border: '1px solid #e2e5ea' }}>
                            {/* Avatar */}
                            <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: c.photo_url ? 'transparent' : ac + '22', border: `2px solid ${ac}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: ac }}>
                              {c.photo_url
                                ? <img src={c.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : getInitials(c.name, c.last_name)}
                            </div>
                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#0d0f12', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {c.name}{c.last_name ? ' ' + c.last_name : ''}
                              </div>
                              {c.cedula && <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{c.cedula}</div>}
                            </div>
                            {/* Type badges (múltiples) */}
                            {cTypes.length > 0 && (
                              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0, maxWidth: 160 }}>
                                {cTypes.map((t, i) => (
                                  <span key={t.id ?? i} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: (t.color || '#1B6EF3') + '18', color: t.color || '#1B6EF3', whiteSpace: 'nowrap' }}>
                                    {t.name}
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* Unlink button */}
                            <button
                              title="Desvincular"
                              onClick={() => unlinkContact(c.id)}
                              disabled={unlinking === c.id}
                              style={{ width: 26, height: 26, border: '1px solid #FECACA', borderRadius: 6, background: '#FEF2F2', color: '#DC2626', cursor: unlinking === c.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, opacity: unlinking === c.id ? .5 : 1, transition: 'all .15s' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#DC2626'; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FEF2F2'; (e.currentTarget as HTMLButtonElement).style.color = '#DC2626' }}>
                              {unlinking === c.id ? '…' : '✕'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #e2e5ea', padding: '16px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
            <button onClick={() => setDrawerOpen(false)}
              style={{ height: 38, padding: '0 20px', border: '1px solid #e2e5ea', borderRadius: 8, fontSize: 14, fontWeight: 600, background: '#fff', color: '#5a6070', cursor: 'pointer', fontFamily: 'inherit' }}>
              {editingId ? 'Cerrar' : 'Cancelar'}
            </button>
            <button onClick={save} disabled={saving}
              style={{ height: 38, padding: '0 24px', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, background: 'var(--color-primary, #111)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving ? .6 : 1 }}>
              {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear empresa'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Toast ──────────────────────────────────────────── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: toast.type === 'success' ? '#111' : '#DC2626', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,.2)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {toast.msg}
        </div>
      )}
    </>
  )
}
