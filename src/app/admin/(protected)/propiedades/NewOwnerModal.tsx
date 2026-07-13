'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { countryHas } from '@/lib/country'
import ContactForm from '@/components/crm/ContactForm'

/* ── Types ───────────────────────────────────────────────────── */
interface DupeCompany { id: string; name: string }
type LookupState      = { type: 'ok' | 'err'; msg: string } | null

export interface NewOwnerResult {
  type: 'contact' | 'company'
  id: string; name: string; subtitle: string
}

interface Props {
  type:      'contact' | 'company'
  tenantId:  string
  country?:  string
  initial?:  string
  onCreated: (owner: NewOwnerResult) => void
  onClose:   () => void
}

/* ── Helpers ─────────────────────────────────────────────────── */
function formatCedulaJuridica(val: string): string {
  const v = val.replace(/[^0-9]/g, '')
  if (v.length <= 1) return v
  if (v.length <= 4) return v[0] + '-' + v.slice(1)
  return v[0] + '-' + v.slice(1, 4) + '-' + v.slice(4, 10)
}

/* ── Style helpers ───────────────────────────────────────────── */
const inputSt: React.CSSProperties = {
  height: 38, width: '100%', border: '1px solid #e2e5ea', borderRadius: 8,
  padding: '0 12px', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff', color: '#0d0f12',
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

/* ══════════════════════════════════════════════════════════════
   COMPANY FORM — idéntico al formulario de Empresas
══════════════════════════════════════════════════════════════ */
function CompanyForm({ tenantId, country, initial, onCreated, onClose }: Omit<Props, 'type'>) {
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
        {countryHas(country, 'hacienda') && (
          <div style={{ paddingTop: 22 }}>
            <button onClick={() => lookupCedJur(cedJur)} disabled={looking}
              style={{ ...lookupBtnSt, opacity: looking ? .6 : 1 }}>
              {looking ? '…' : 'Consultar →'}
            </button>
          </div>
        )}
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
      {countryHas(country, 'hacienda') && (
        <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 4px' }}>
          Consulta Hacienda CR — autocompleta razón social. Enter o &ldquo;Consultar →&rdquo; para buscar.
        </p>
      )}

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
          style={{ flex: 1, height: 40, background: 'var(--color-primary, #111)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: (saving || !!cedJurDupe) ? 'not-allowed' : 'pointer', opacity: (saving || !!cedJurDupe) ? 0.7 : 1, fontFamily: 'inherit' }}>
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
export default function NewOwnerModal({ type, tenantId, country, initial, onCreated, onClose }: Props) {
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
          ? <ContactForm
              tenantId={tenantId}
              country={country}
              initialName={initial}
              submitLabel="Registrar cliente"
              onSaved={r => onCreated({
                type:     'contact',
                id:       r.id,
                name:     [r.name, r.last_name].filter(Boolean).join(' '),
                subtitle: r.email ?? r.cedula ?? 'Persona física',
              })}
              onCancel={onClose}
            />
          : <CompanyForm tenantId={tenantId} country={country} initial={initial} onCreated={onCreated} onClose={onClose} />
        }
      </div>
    </div>
  )
}
