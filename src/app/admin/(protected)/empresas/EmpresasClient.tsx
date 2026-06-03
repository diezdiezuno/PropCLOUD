'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'

// ── Types ─────────────────────────────────────────────────────
interface Company {
  id: string
  name: string
  cedula_juridica: string | null
}

interface LinkedContact {
  id: string
  name: string
  last_name: string | null
  photo_url: string | null
  cedula: string | null
  company_id: string | null
  contact_types: { name: string; color: string } | null
}

interface FormState {
  name: string
  cedula_juridica: string
}

type LookupState = { type: 'ok' | 'err'; msg: string } | null

const EMPTY_FORM: FormState = { name: '', cedula_juridica: '' }

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

// ── Component ─────────────────────────────────────────────────
export default function EmpresasClient() {
  const [tenantId,    setTenantId]    = useState('')
  const [userId,      setUserId]      = useState('')
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
  const [hoveredRow,    setHoveredRow]    = useState<string | null>(null)
  const [hoveredBtn,    setHoveredBtn]    = useState<string | null>(null)

  // ── Load companies ────────────────────────────────────────
  const loadCompanies = useCallback(async (tid: string, q: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createClient() as any
    let query = sb
      .from('crm_companies')
      .select('id,name,cedula_juridica')
      .eq('tenant_id', tid)
      .order('name')
    if (q) query = query.ilike('name', `%${q}%`)
    const { data } = await query
    setCompanies((data ?? []) as Company[])
  }, [])

  const loadContactCounts = useCallback(async (tid: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (createClient() as any)
      .from('crm_contacts')
      .select('company_id')
      .eq('tenant_id', tid)
      .eq('active', true)
      .not('company_id', 'is', null)
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
      .from('crm_contacts')
      .select('id,name,last_name,photo_url,cedula,company_id,contact_types(name,color)')
      .eq('tenant_id', tid)
      .eq('company_id', companyId)
      .eq('active', true)
      .order('name')
    setLinkedContacts((data ?? []) as LinkedContact[])
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
      await Promise.all([
        loadCompanies(adminRec.tenant_id, ''),
        loadContactCounts(adminRec.tenant_id),
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
      ? { name: company.name, cedula_juridica: company.cedula_juridica ?? '' }
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
      .select('id,name,last_name,photo_url,cedula,company_id,contact_types(name,color)')
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
      .from('crm_contacts').update({ company_id: editingId }).eq('id', contact.id)
    setLinking(null)
    if (error) { showToast('Error al vincular: ' + error.message, 'error'); return }

    setContactQuery('')
    setContactResults([])
    setShowResults(false)
    // Add to linked list
    setLinkedContacts(prev =>
      [...prev, { ...contact, company_id: editingId }]
        .sort((a, b) => a.name.localeCompare(b.name))
    )
    // Update counts
    setContactMap(prev => {
      const next = { ...prev, [editingId]: (prev[editingId] ?? 0) + 1 }
      if (contact.company_id && contact.company_id !== editingId) {
        next[contact.company_id] = Math.max(0, (prev[contact.company_id] ?? 1) - 1)
      }
      return next
    })
  }

  async function unlinkContact(contactId: string) {
    if (!editingId) return
    setUnlinking(contactId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (createClient() as any)
      .from('crm_contacts').update({ company_id: null }).eq('id', contactId)
    setUnlinking(null)
    if (error) { showToast('Error al desvincular: ' + error.message, 'error'); return }
    setLinkedContacts(prev => prev.filter(c => c.id !== contactId))
    setContactMap(prev => ({ ...prev, [editingId]: Math.max(0, (prev[editingId] ?? 1) - 1) }))
  }

  // ── Save ──────────────────────────────────────────────────
  async function save() {
    if (!form.name.trim()) { showToast('El nombre es obligatorio', 'error'); return }

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
      await loadCompanies(tenantId, search)
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
        [...prev, { id: newId, name: payload.name, cedula_juridica: payload.cedula_juridica }]
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      showToast('Empresa creada ✓ — ahora podés vincular clientes', 'success')
    }
  }

  // ── Delete ────────────────────────────────────────────────
  async function deleteCompany(id: string) {
    setDeleting(id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (createClient() as any).from('crm_companies').delete().eq('id', id)
    setDeleting(null)
    setConfirmDelete(null)
    if (error) { showToast('Error: ' + error.message, 'error'); return }
    showToast('Empresa eliminada', 'success')
    setCompanies(prev => prev.filter(co => co.id !== id))
  }

  // ── Search ────────────────────────────────────────────────
  function handleSearch(val: string) {
    setSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => loadCompanies(tenantId, val), 300)
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

  return (
    <>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>Empresas</h1>
          <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>
            {companies.length === 0 && !hasSearch ? 'Sin empresas aún.' : `${companies.length} empresa${companies.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={() => openDrawer(null)}
          style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Nueva empresa
        </button>
      </div>

      {/* ── Search ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ position: 'relative', maxWidth: 380 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
          <input type="text" placeholder="Buscar por nombre…" value={search}
            onChange={e => handleSearch(e.target.value)}
            style={{ ...sInput, paddingLeft: 36 }} />
        </div>
      </div>

      {/* ── List ───────────────────────────────────────────── */}
      {companies.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '60px 24px', border: '1px solid #ebebeb', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#5a6070', margin: '0 0 8px' }}>
            {hasSearch ? 'Sin resultados' : 'Sin empresas aún'}
          </h3>
          <p style={{ fontSize: 14, color: '#9ca3af', margin: '0 0 20px' }}>
            {hasSearch ? 'Probá otra búsqueda.' : 'Agregá la primera empresa del CRM.'}
          </p>
          {!hasSearch && (
            <button onClick={() => openDrawer(null)}
              style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              + Nueva empresa
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {companies.map(co => {
            const count        = contactMap[co.id] ?? 0
            const isConfirming = confirmDelete === co.id
            const isDeleting   = deleting === co.id
            const hasContacts  = count > 0

            return (
              <div key={co.id}
                onMouseEnter={() => setHoveredRow(co.id)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{ background: '#fff', border: '1px solid #e2e5ea', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, transition: 'border-color .15s', cursor: 'default' }}
                onMouseOver={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#1B6EF3'}
                onMouseOut={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e5ea'}>

                {/* Icon */}
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F5F5F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🏢</div>

                {/* Info */}
                <div onClick={() => openDrawer(co)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0d0f12', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{co.name}</div>
                  {co.cedula_juridica && (
                    <div style={{ fontSize: 12, color: '#5a6070', marginTop: 2, fontFamily: 'monospace' }}>{co.cedula_juridica}</div>
                  )}
                </div>

                {/* Badge */}
                <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: count > 0 ? '#EEF4FF' : '#F4F5F7', color: count > 0 ? '#1B6EF3' : '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {count} cliente{count !== 1 ? 's' : ''}
                </span>

                {/* Actions */}
                <div onClick={e => e.stopPropagation()}
                  style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, opacity: hoveredRow === co.id || isConfirming ? 1 : 0, transition: 'opacity .15s' }}>
                  {!isConfirming ? (
                    <>
                      <button title="Editar" onClick={() => openDrawer(co)}
                        onMouseEnter={() => setHoveredBtn(`${co.id}-edit`)}
                        onMouseLeave={() => setHoveredBtn(null)}
                        style={{ width: 30, height: 30, border: `1px solid ${hoveredBtn === `${co.id}-edit` ? '#F5D98A' : '#e2e5ea'}`, borderRadius: 6, background: hoveredBtn === `${co.id}-edit` ? '#FEF9EC' : '#F4F5F7', color: hoveredBtn === `${co.id}-edit` ? '#92610A' : '#5a6070', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, transition: 'all .15s' }}>
                        ✏️
                      </button>
                      <button
                        title={hasContacts ? `Tiene ${count} cliente${count !== 1 ? 's' : ''} vinculado${count !== 1 ? 's' : ''}` : 'Eliminar'}
                        onClick={() => hasContacts ? showToast(`No se puede eliminar: tiene ${count} cliente${count !== 1 ? 's' : ''} vinculado${count !== 1 ? 's' : ''}`, 'error') : setConfirmDelete(co.id)}
                        onMouseEnter={() => setHoveredBtn(`${co.id}-del`)}
                        onMouseLeave={() => setHoveredBtn(null)}
                        style={{ width: 30, height: 30, border: `1px solid ${hoveredBtn === `${co.id}-del` ? (hasContacts ? '#e2e5ea' : 'transparent') : '#FECACA'}`, borderRadius: 6, background: hoveredBtn === `${co.id}-del` ? (hasContacts ? '#F4F5F7' : '#DC2626') : '#FEF2F2', color: hoveredBtn === `${co.id}-del` ? (hasContacts ? '#9ca3af' : '#fff') : '#DC2626', cursor: hasContacts ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, transition: 'all .15s', opacity: hasContacts ? .5 : 1 }}>
                        🗑
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>¿Eliminar?</span>
                      <button onClick={() => deleteCompany(co.id)} disabled={isDeleting}
                        style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#DC2626', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: isDeleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: isDeleting ? .6 : 1 }}>
                        {isDeleting ? '…' : 'Sí'}
                      </button>
                      <button onClick={() => setConfirmDelete(null)}
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
                <div style={{ ...sField, paddingTop: 22 }}>
                  <button onClick={lookupCedula} disabled={lookingUp}
                    style={{ height: 38, padding: '0 14px', border: '1px solid #e2e5ea', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: '#f4f5f7', color: '#0d0f12', cursor: lookingUp ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' as const, opacity: lookingUp ? .6 : 1 }}>
                    {lookingUp ? '…' : 'Consultar →'}
                  </button>
                </div>
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
                Consulta Hacienda CR — autocompleta razón social. Enter para consultar.
              </span>
            </div>

            {/* ── DATOS DE LA EMPRESA ─────────────────────── */}
            <div style={{ marginBottom: 28 }}>
              <div style={sSecLbl}>Datos de la empresa</div>
              <div style={sField}>
                <label style={sLabel}>Razón social / Nombre *</label>
                <input
                  type="text" placeholder="Nombre de la empresa"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  style={sInput} />
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  Se autocompleta con la búsqueda de Hacienda, o ingresalo manualmente.
                </span>
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
                  <span style={{ fontSize: 18 }}>💡</span>
                  <span style={{ fontSize: 13, color: '#92610A' }}>
                    Guardá la empresa primero para poder vincular clientes.
                  </span>
                </div>
              ) : (
                <>
                  {/* Contact search */}
                  <div ref={contactSearchRef} style={{ position: 'relative', marginBottom: 12 }}>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 14, pointerEvents: 'none' }}>
                        {contactSearching ? '⏳' : '🔍'}
                      </span>
                      <input
                        type="text"
                        placeholder="Buscar y vincular cliente por nombre o cédula…"
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
                          const tc  = c.contact_types?.color || '#1B6EF3'
                          const tBg = tc + '18'
                          const hasOtherCompany = c.company_id && c.company_id !== editingId
                          return (
                            <div
                              key={c.id}
                              onClick={() => linkContact(c)}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: linking === c.id ? 'not-allowed' : 'pointer', borderBottom: '1px solid #f4f5f7', transition: 'background .1s' }}
                              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#f9fafb'}
                              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                            >
                              {/* Avatar */}
                              <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: tBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: tc }}>
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
                                  {hasOtherCompany && <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600 }}>⚠ Ya tiene empresa</span>}
                                </div>
                              </div>
                              {/* Type badge */}
                              {c.contact_types?.name && (
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: tBg, color: tc, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  {c.contact_types.name}
                                </span>
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
                      <div style={{ fontSize: 22, marginBottom: 6 }}>👥</div>
                      <div style={{ fontSize: 13, color: '#9ca3af' }}>Sin clientes vinculados aún</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {linkedContacts.map(c => {
                        const tc  = c.contact_types?.color || '#1B6EF3'
                        const tBg = tc + '18'
                        return (
                          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#F9FAFB', borderRadius: 10, border: '1px solid #e2e5ea' }}>
                            {/* Avatar */}
                            <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: tBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: tc }}>
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
                            {/* Type badge */}
                            {c.contact_types?.name && (
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: tBg, color: tc, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {c.contact_types.name}
                              </span>
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
              style={{ height: 38, padding: '0 24px', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, background: '#111', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving ? .6 : 1 }}>
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
