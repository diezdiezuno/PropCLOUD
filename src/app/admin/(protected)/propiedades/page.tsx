'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { getMembership } from '@/lib/membership'
import PageHeader from '@/components/admin/PageHeader'

const CRM_STATUS_LABELS: Record<string, string> = {
  draft:        'Borrador',
  captacion:    'En captación',
  preparacion:  'En preparación',
  lista:        'Lista para publicar',
  active:       'Publicada',
  bajo_oferta:  'Bajo oferta',
  sold:         'Cerrada',
  archived:     'Archivada',
}
const CRM_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  draft:        { bg: '#f5f5f5',              color: '#888' },
  captacion:    { bg: 'rgba(37,99,235,.08)',   color: '#1d4ed8' },
  preparacion:  { bg: 'rgba(217,119,6,.08)',   color: '#b45309' },
  lista:        { bg: 'rgba(107,47,160,.08)',  color: '#6b2fa0' },
  active:       { bg: 'rgba(5,150,105,.08)',   color: '#047857' },
  bajo_oferta:  { bg: 'rgba(234,88,12,.08)',   color: '#c2410c' },
  sold:         { bg: '#111',                  color: '#fff' },
  archived:     { bg: '#f5f5f5',              color: '#aaa' },
}

interface PropRow {
  id: string
  title: string
  type: string
  transaction: string
  price: number
  currency: string
  crm_status: string | null
  status: string
  address: string | null
  provincia: string | null
  canton: string | null
  images: string[]
  agent_id: string | null
  created_at: string
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

function formatPrice(price: number, currency: string) {
  if (currency === 'USD') return `$${price.toLocaleString('en-US')}`
  return `₡${price.toLocaleString('es-CR')}`
}
function locationText(p: PropRow) {
  return [p.canton, p.provincia].filter(Boolean).join(', ') || p.address || ''
}

type SortKey = 'title' | 'location' | 'price' | 'status' | 'date'

export default function PropiedadesPage() {
  const router = useRouter()
  const [loading,  setLoading]  = useState(true)
  const [props,    setProps]    = useState<PropRow[]>([])
  const [tenantId, setTenantId] = useState('')
  const [search,   setSearch]   = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [toast,         setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting,      setDeleting]      = useState<string | null>(null)
  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000)
  }

  // Paginación y orden
  const [page,     setPage]     = useState(0)
  const [pageSize, setPageSize] = useState<number>(25)
  const [sortKey,  setSortKey]  = useState<SortKey>('date')
  const [sortDir,  setSortDir]  = useState<'asc' | 'desc'>('desc')
  function changePageSize(n: number) { setPageSize(n); setPage(0); localStorage.setItem('propiedades_page_size', String(n)) }
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'date' ? 'desc' : 'asc') }
    setPage(0)
  }

  // Anchos: Propiedad, Ubicación, Precio, Estado, Fecha (redimensionables) + Acciones (fija)
  const ACTIONS_W = 88
  const DEFAULT_COLS = [340, 200, 140, 160, 110, ACTIONS_W]
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
    localStorage.setItem('propiedades_col_widths', JSON.stringify(colWidthsRef.current))
    document.body.style.cursor = ''
  }, [onColMove])
  function startColResize(e: React.MouseEvent, idx: number) {
    e.preventDefault(); e.stopPropagation()
    dragRef.current = { idx, startX: e.clientX, startW: colWidths[idx] }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', onColMove)
    window.addEventListener('mouseup', onColUp)
  }

  const loadProps = useCallback(async (tid: string, q: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (createClient() as any)
      .from('properties')
      .select('id,title,type,transaction,price,currency,crm_status,status,address,provincia,canton,images,agent_id,created_at')
      .eq('tenant_id', tid)
      .eq('source', 'manual')
      .order('created_at', { ascending: false })
    if (q) query = query.or(`title.ilike.%${q}%,address.ilike.%${q}%,canton.ilike.%${q}%,provincia.ilike.%${q}%`)
    const { data } = await query
    setProps((data ?? []) as PropRow[])
  }, [])

  useEffect(() => {
    getMembership().then(async m => {
      if (!m) return
      const adminRec = { tenant_id: m.tenantId }
      setTenantId(adminRec.tenant_id)
      const ps = localStorage.getItem('propiedades_page_size')
      if (ps !== null && !isNaN(Number(ps))) setPageSize(Number(ps))
      try {
        const cw = JSON.parse(localStorage.getItem('propiedades_col_widths') || 'null')
        if (Array.isArray(cw) && cw.length === DEFAULT_COLS.length && cw.every(n => typeof n === 'number')) {
          cw[cw.length - 1] = ACTIONS_W
          setColWidths(cw); colWidthsRef.current = cw
        }
      } catch { /* ignore */ }
      await loadProps(adminRec.tenant_id, '')
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadProps])

  function handleSearch(val: string) {
    setSearch(val); setPage(0)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => loadProps(tenantId, val), 300)
  }

  async function deleteProperty(id: string) {
    setDeleting(id)
    const { error } = await createClient().from('properties').delete().eq('id', id)
    setDeleting(null); setConfirmDelete(null)
    if (error) { showToast('No se pudo eliminar (puede tener datos vinculados)', 'error'); return }
    showToast('Propiedad eliminada', 'success')
    await loadProps(tenantId, search)
  }

  // Orden + paginación (cliente)
  const sortVal = (p: PropRow): string | number => {
    switch (sortKey) {
      case 'location': return locationText(p).toLowerCase()
      case 'price':    return p.price ?? 0
      case 'status':   return (CRM_STATUS_LABELS[p.crm_status ?? 'draft'] ?? '').toLowerCase()
      case 'date':     return p.created_at ?? ''
      default:         return (p.title ?? '').toLowerCase()
    }
  }
  const sorted = [...props].sort((a, b) => {
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

  const sInput: React.CSSProperties = {
    height: 38, padding: '0 12px', border: '1px solid #e2e5ea', borderRadius: 8,
    fontSize: 14, fontFamily: 'system-ui, sans-serif', background: '#fff', color: '#0d0f12',
    width: '100%', boxSizing: 'border-box', outline: 'none',
  }

  if (loading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>

  return (
    <>
      {/* Header */}
      <PageHeader title="Propiedades"
        subtitle={props.length === 0 && !search ? 'Sin propiedades manuales aún.' : `${props.length} propiedad${props.length !== 1 ? 'es' : ''} en inventario`}
        right={
          <a href="/admin/propiedades/nueva"
            style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>
            + Nueva propiedad
          </a>
        } />

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
          <input type="text" placeholder="Buscar por título o ubicación…" value={search}
            onChange={e => handleSearch(e.target.value)} style={{ ...sInput, paddingLeft: 36 }} />
        </div>
        <select value={pageSize} onChange={e => changePageSize(Number(e.target.value))} title="Registros por página"
          style={{ height: 38, padding: '0 10px', border: '1px solid #e2e5ea', borderRadius: 8, fontSize: 13, background: '#fff', color: '#0d0f12', fontFamily: 'inherit', cursor: 'pointer', marginLeft: 'auto' }}>
          {[25, 50, 100].map(n => <option key={n} value={n}>{n} / pág.</option>)}
          <option value={0}>Todos</option>
        </select>
      </div>

      {props.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '60px 24px', border: '1px solid #ebebeb', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏘️</div>
          <p style={{ fontSize: 14, color: '#aaa', margin: '0 0 20px' }}>
            {search ? 'Sin resultados para esa búsqueda.' : 'Las propiedades cargadas manualmente aparecerán aquí.'}
          </p>
          {!search && (
            <a href="/admin/propiedades/nueva"
              style={{ display: 'inline-block', background: '#111', color: '#fff', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              Cargar primera propiedad
            </a>
          )}
        </div>
      ) : (
        <>
          <style>{`
            .pr-trow:hover { background:#f9fafb; }
            .pr-trow .pr-actions { opacity:0; transition:opacity .15s; }
            .pr-trow:hover .pr-actions { opacity:1; }
            .pr-btn { width:28px; height:28px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .12s; background:transparent; border:none; color:#9ca3af; }
            .pr-btn:hover { background:#f0f1f3; color:#5a6070; }
            .pr-btn-del:hover { background:#FEF2F2; color:#DC2626; }
            .pr-resize { border-right:2px solid transparent; box-sizing:border-box; }
            .pr-resize:hover { border-right-color:#9ca3af; }
          `}</style>

          <div style={{ background: '#fff', border: '1px solid #e2e5ea', borderRadius: 12, overflowX: 'auto' }}>
            <table style={{ width: colWidths.reduce((a, b) => a + b, 0), minWidth: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
              </colgroup>
              <thead>
                <tr style={{ background: '#f9fafb', color: '#5a6070', textAlign: 'left' }}>
                  {([['Propiedad', 'title'], ['Ubicación', 'location'], ['Precio', 'price'], ['Estado CRM', 'status'], ['Fecha', 'date'], ['', null]] as [string, SortKey | null][]).map(([label, key], i) => (
                    <th key={i}
                      onClick={key ? () => toggleSort(key) : undefined}
                      style={{ padding: '9px 12px', fontWeight: 500, position: 'relative', cursor: key ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap', borderRight: i < colWidths.length - 1 ? '1px solid #e5e7eb' : undefined }}>
                      {label}{key && sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                      {i < colWidths.length - 1 && (
                        <span className="pr-resize" onMouseDown={e => startColResize(e, i)}
                          style={{ position: 'absolute', right: -4, top: 0, height: '100%', width: 8, cursor: 'col-resize', zIndex: 2 }} />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map(p => {
                  const statusKey = p.crm_status ?? 'draft'
                  const statusStyle = CRM_STATUS_COLORS[statusKey] ?? CRM_STATUS_COLORS.draft
                  const thumb = p.images?.[0]
                  const loc = locationText(p)
                  const isConfirming = confirmDelete === p.id
                  const isDeleting = deleting === p.id
                  return (
                    <tr key={p.id} className="pr-trow" style={{ borderTop: '1px solid #eef0f2' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <div onClick={() => router.push(`/admin/propiedades/${p.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minWidth: 0 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f0ede8', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                            {thumb ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🏠'}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: '#0d0f12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.title || <span style={{ color: '#bbb', fontWeight: 400 }}>Sin título</span>}
                            </div>
                            <div style={{ fontSize: 12, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {[p.type, p.transaction === 'sale' ? 'Venta' : p.transaction === 'rent' ? 'Alquiler' : p.transaction === 'sale_rent' ? 'Venta y alquiler' : ''].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px', color: loc ? '#5a6070' : '#c5cad3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc || '—'}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0d0f12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.price ? formatPrice(p.price, p.currency) : '—'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 500, borderRadius: 100, padding: '3px 10px', background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.color}22`, whiteSpace: 'nowrap' }}>
                          {CRM_STATUS_LABELS[statusKey] ?? statusKey}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                        {new Date(p.created_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <div className="pr-actions" onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {!isConfirming ? (
                            <>
                              <button className="pr-btn pr-btn-edit" title="Editar" onClick={() => router.push(`/admin/propiedades/${p.id}`)}><EditIcon /></button>
                              <button className="pr-btn pr-btn-del" title="Eliminar" onClick={() => setConfirmDelete(p.id)}><TrashIcon /></button>
                            </>
                          ) : (
                            <>
                              <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>¿Eliminar?</span>
                              <button onClick={() => deleteProperty(p.id)} disabled={isDeleting}
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

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, zIndex: 999, fontFamily: 'system-ui, sans-serif', pointerEvents: 'none', ...(toast.type === 'success' ? { background: '#15803d', color: '#fff' } : { background: '#DC2626', color: '#fff' }) }}>
          {toast.msg}
        </div>
      )}
    </>
  )
}
