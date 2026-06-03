'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'

// ── Types ─────────────────────────────────────────────────────
interface Company {
  id: string
  name: string
  cedula_juridica: string | null
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

// ── Component ─────────────────────────────────────────────────
export default function EmpresasClient() {
  const [tenantId,    setTenantId]    = useState('')
  const [userId,      setUserId]      = useState('')
  const [companies,   setCompanies]   = useState<Company[]>([])
  const [contactMap,  setContactMap]  = useState<Record<string, number>>({})
  const [pageLoading, setPageLoading] = useState(true)

  const [search,      setSearch]      = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [drawerOpen,  setDrawerOpen]  = useState(false)
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [form,        setForm]        = useState<FormState>({ ...EMPTY_FORM })
  const [saving,      setSaving]      = useState(false)

  const [lookupResult, setLookupResult] = useState<LookupState>(null)
  const [lookingUp,    setLookingUp]    = useState(false)

  const [toast,         setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting,      setDeleting]      = useState<string | null>(null)
  const [hoveredRow,    setHoveredRow]    = useState<string | null>(null)
  const [hoveredBtn,    setHoveredBtn]    = useState<string | null>(null)

  // ── Load ──────────────────────────────────────────────────
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

  // ── Drawer ────────────────────────────────────────────────
  function openDrawer(company: Company | null) {
    setEditingId(company?.id ?? null)
    setLookupResult(null)
    setForm(company
      ? { name: company.name, cedula_juridica: company.cedula_juridica ?? '' }
      : { ...EMPTY_FORM }
    )
    setDrawerOpen(true)
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

  // ── Save ──────────────────────────────────────────────────
  async function save() {
    if (!form.name.trim()) { showToast('El nombre es obligatorio', 'error'); return }
    setSaving(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createClient() as any

    const payload = {
      name:            form.name.trim(),
      cedula_juridica: form.cedula_juridica.trim() || null,
    }

    let err
    if (editingId) {
      ;({ error: err } = await sb.from('crm_companies').update(payload).eq('id', editingId))
    } else {
      ;({ error: err } = await sb.from('crm_companies').insert({
        ...payload,
        tenant_id:  tenantId,
        created_by: userId,
      }))
    }

    setSaving(false)
    if (err) { showToast('Error: ' + err.message, 'error'); return }

    showToast(editingId ? 'Empresa actualizada ✓' : 'Empresa creada ✓', 'success')
    setDrawerOpen(false)
    await loadCompanies(tenantId, search)
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
    await loadCompanies(tenantId, search)
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

  if (pageLoading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>

  const filtered = companies // already filtered server-side
  const hasSearch = !!search

  return (
    <>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>Empresas</h1>
          <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>
            {filtered.length === 0 && !hasSearch ? 'Sin empresas aún.' : `${filtered.length} empresa${filtered.length !== 1 ? 's' : ''}`}
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
          <input
            type="text"
            placeholder="Buscar por nombre…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            style={{ ...sInput, paddingLeft: 36 }}
          />
        </div>
      </div>

      {/* ── List ───────────────────────────────────────────── */}
      {filtered.length === 0 ? (
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
          {filtered.map(co => {
            const count = contactMap[co.id] ?? 0
            const isConfirming = confirmDelete === co.id
            const isDeleting   = deleting === co.id
            const hasContacts  = count > 0

            return (
              <div
                key={co.id}
                onMouseEnter={() => setHoveredRow(co.id)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{
                  background: '#fff', border: '1px solid #e2e5ea', borderRadius: 10,
                  padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
                  transition: 'border-color .15s', cursor: 'default',
                }}
                onMouseOver={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#1B6EF3'}
                onMouseOut={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e5ea'}
              >
                {/* Icon */}
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F5F5F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                  🏢
                </div>

                {/* Info */}
                <div
                  onClick={() => openDrawer(co)}
                  style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0d0f12', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {co.name}
                  </div>
                  {co.cedula_juridica && (
                    <div style={{ fontSize: 12, color: '#5a6070', marginTop: 2, fontFamily: 'monospace' }}>
                      {co.cedula_juridica}
                    </div>
                  )}
                </div>

                {/* Contacts badge */}
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                  background: count > 0 ? '#EEF4FF' : '#F4F5F7',
                  color: count > 0 ? '#1B6EF3' : '#9ca3af',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {count} cliente{count !== 1 ? 's' : ''}
                </span>

                {/* Actions */}
                <div
                  onClick={e => e.stopPropagation()}
                  style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, opacity: hoveredRow === co.id || isConfirming ? 1 : 0, transition: 'opacity .15s' }}
                >
                  {!isConfirming ? (
                    <>
                      <button
                        title="Editar"
                        onClick={() => openDrawer(co)}
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

        <div style={{ width: 480, maxWidth: '100vw', height: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,.12)', overflow: 'hidden', transform: drawerOpen ? 'translateX(0)' : 'translateX(40px)', transition: 'transform .2s' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #e2e5ea', flexShrink: 0 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: '#0d0f12' }}>
              {editingId ? 'Editar empresa' : 'Nueva empresa'}
            </span>
            <button
              onClick={() => setDrawerOpen(false)}
              style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#5a6070', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ✕
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

            {/* ── IDENTIFICACIÓN ─────────────────────────── */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '.06em', textTransform: 'uppercase' as const, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #e2e5ea' }}>
                Identificación
              </div>

              {/* Cédula jurídica + Consultar */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, ...sField }}>
                  <label style={sLabel}>Cédula jurídica</label>
                  <input
                    type="text"
                    placeholder="3-101-123456"
                    maxLength={12}
                    value={form.cedula_juridica}
                    onChange={e => {
                      setForm(prev => ({ ...prev, cedula_juridica: formatCedulaJuridica(e.target.value) }))
                      setLookupResult(null)
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') lookupCedula() }}
                    style={sInput}
                  />
                </div>
                <div style={{ ...sField, paddingTop: 22 }}>
                  <button
                    onClick={lookupCedula}
                    disabled={lookingUp}
                    style={{ height: 38, padding: '0 14px', border: '1px solid #e2e5ea', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: '#f4f5f7', color: '#0d0f12', cursor: lookingUp ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0, opacity: lookingUp ? .6 : 1 }}>
                    {lookingUp ? '…' : 'Consultar →'}
                  </button>
                </div>
              </div>

              {/* Lookup result */}
              {lookupResult && (
                <div style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, marginTop: 8, ...(lookupResult.type === 'ok' ? { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' } : { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }) }}>
                  {lookupResult.msg}
                </div>
              )}

              <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, display: 'block' }}>
                Consulta Hacienda CR — autocompleta razón social. Enter para consultar.
              </span>
            </div>

            {/* ── DATOS DE LA EMPRESA ─────────────────────── */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '.06em', textTransform: 'uppercase' as const, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #e2e5ea' }}>
                Datos de la empresa
              </div>

              <div style={sField}>
                <label style={sLabel}>Razón social / Nombre *</label>
                <input
                  type="text"
                  placeholder="Nombre de la empresa"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  style={sInput}
                  autoFocus={!editingId}
                />
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  Se autocompleta con la búsqueda de Hacienda, o ingresalo manualmente.
                </span>
              </div>
            </div>

            {/* Clientes vinculados (solo al editar) */}
            {editingId && (contactMap[editingId] ?? 0) > 0 && (
              <div style={{ background: '#EEF4FF', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>👥</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1B6EF3' }}>
                    {contactMap[editingId]} cliente{contactMap[editingId] !== 1 ? 's' : ''} vinculado{contactMap[editingId] !== 1 ? 's' : ''}
                  </div>
                  <div style={{ fontSize: 12, color: '#5a6070' }}>
                    Esta empresa no puede eliminarse mientras tenga clientes.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #e2e5ea', padding: '16px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
            <button
              onClick={() => setDrawerOpen(false)}
              style={{ height: 38, padding: '0 20px', border: '1px solid #e2e5ea', borderRadius: 8, fontSize: 14, fontWeight: 600, background: '#fff', color: '#5a6070', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
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
