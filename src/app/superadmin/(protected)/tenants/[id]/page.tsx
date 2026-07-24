'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Admin { id: string; user_id: string; email: string; role: string }
interface Source { id: string; type: string; config: Record<string, string>; is_active: boolean }
interface TenantTheme { primaryColor: string; accentColor: string; fontHeading: string; fontBody: string; mapStyle: string }
interface Tenant { id: string; name: string; slug: string; domain: string; logo_url: string | null; theme: TenantTheme; proptools_apps?: string[] | null; crm_apps?: string[] | null }

// Menús de CRM y herramientas activables por tenant (mismas claves que AdminShell).
const CRM_CATALOG: { key: string; label: string }[] = [
  { key: 'propiedades', label: 'Propiedades' },
  { key: 'contactos',   label: 'Contactos' },
  { key: 'empresas',    label: 'Empresas' },
  { key: 'leads',       label: 'Leads' },
]
const TOOLS_CATALOG: { key: string; label: string }[] = [
  { key: 'firmas',       label: 'Firmas' },
  { key: 'tarjetas',     label: 'Tarjetas' },
  { key: 'rotulos',      label: 'Rótulos' },
  { key: 'valoraciones', label: 'Valoraciones' },
  { key: 'calendario',   label: 'Calendario' },
  { key: 'equipos',      label: 'Equipos' },
]

const DEFAULT_THEME: TenantTheme = { primaryColor: '#111111', accentColor: '#f59e0b', fontHeading: 'system-ui, sans-serif', fontBody: 'system-ui, sans-serif', mapStyle: 'mapbox://styles/mapbox/streets-v12' }
interface DomainVerification { type: string; domain: string; value: string }
interface DomainStatus { verified: boolean; misconfigured?: boolean; verification: DomainVerification[]; error?: { message: string } | null }
interface DomainResult { domain: string; apex: DomainStatus | null; www: DomainStatus | null }

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [admins, setAdmins] = useState<Admin[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [domainResult, setDomainResult] = useState<DomainResult | null>(null)
  const [domainLoading, setDomainLoading] = useState(false)
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [theme, setTheme] = useState<TenantTheme>(DEFAULT_THEME)
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [adminError, setAdminError] = useState('')
  const [adminNotice, setAdminNotice] = useState<{ msg: string; link?: string } | null>(null)
  const [featSaving, setFeatSaving] = useState('')

  // CRM: null = todo prendido. Tools: allowlist estricta (null/[] = ninguna).
  const crmOn = (key: string) => !tenant?.crm_apps || tenant.crm_apps.includes(key)
  const toolOn = (key: string) => (tenant?.proptools_apps ?? []).includes(key)

  async function toggleFeature(kind: 'crm' | 'tools', key: string) {
    if (!tenant) return
    const field = kind === 'crm' ? 'crm_apps' : 'proptools_apps'
    const all = (kind === 'crm' ? CRM_CATALOG : TOOLS_CATALOG).map(c => c.key)
    // Base actual materializada (crm null → todo prendido).
    const current = kind === 'crm'
      ? (tenant.crm_apps ?? all)
      : (tenant.proptools_apps ?? [])
    const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key]
    setFeatSaving(key)
    const res = await fetch(`/api/superadmin/tenants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: next }),
    })
    if (res.ok) setTenant(t => t ? { ...t, [field]: next } : t)
    setFeatSaving('')
  }

  async function load() {
    const res = await fetch(`/api/superadmin/tenants/${id}`)
    if (!res.ok) { router.push('/superadmin/tenants'); return }
    const data = await res.json()
    setTenant(data.tenant)
    setName(data.tenant.name)
    setDomain(data.tenant.domain)
    setLogoUrl(data.tenant.logo_url ?? '')
    setTheme({ ...DEFAULT_THEME, ...data.tenant.theme })
    setAdmins(data.admins)
    setSources(data.sources)
    setLoading(false)
    // Load domain status in background
    loadDomainStatus()
  }

  async function loadDomainStatus() {
    setDomainLoading(true)
    const res = await fetch(`/api/superadmin/tenants/${id}/domain`)
    if (res.ok) setDomainResult(await res.json())
    setDomainLoading(false)
  }

  async function addToVercel() {
    setDomainLoading(true)
    const res = await fetch(`/api/superadmin/tenants/${id}/domain`, { method: 'POST' })
    if (res.ok) setDomainResult(await res.json())
    setDomainLoading(false)
  }

  async function recheckVercel() {
    setDomainLoading(true)
    const res = await fetch(`/api/superadmin/tenants/${id}/domain`, { method: 'PUT' })
    if (res.ok) setDomainResult(await res.json())
    setDomainLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function saveTenant(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setSaveError('')
    const res = await fetch(`/api/superadmin/tenants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, domain, logo_url: logoUrl, theme }),
    })
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    else { const { error } = await res.json(); setSaveError(error) }
    setSaving(false)
  }

  async function addAdmin(e: React.FormEvent) {
    e.preventDefault()
    setAddingAdmin(true); setAdminError(''); setAdminNotice(null)
    const res = await fetch(`/api/superadmin/tenants/${id}/admins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newAdminEmail }),
    })
    if (res.ok) {
      const out = await res.json()
      setNewAdminEmail('')
      if (out.invited) {
        // Aún no aparece en la lista (no se registró); se avisa la invitación.
        setAdminNotice(out.adminInvite?.warning
          ? { msg: `${out.adminInvite.warning}. Pasale este link:`, link: out.adminInvite.link }
          : { msg: `Invitación enviada a ${out.email}.` })
      }
      await load()
    }
    else { const { error } = await res.json(); setAdminError(error) }
    setAddingAdmin(false)
  }

  async function removeAdmin(userId: string) {
    if (!confirm('¿Quitar acceso de admin a este usuario?')) return
    await fetch(`/api/superadmin/tenants/${id}/admins`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    await load()
  }

  async function deleteTenant() {
    if (!confirm(`¿Eliminar el tenant "${tenant?.name}"? Esta acción no se puede deshacer.`)) return
    if (!confirm('¿Estás seguro? Se eliminarán todos sus datos.')) return
    const res = await fetch(`/api/superadmin/tenants/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/superadmin/tenants')
  }

  if (loading) return <div style={{ color: '#555', padding: 40 }}>Cargando…</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <button onClick={() => router.push('/superadmin/tenants')} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 13, padding: '0 0 8px', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
            ← Todos los tenants
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>{tenant?.name}</h1>
          <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>{tenant?.slug} · {tenant?.domain}</div>
        </div>
        <a href={`/admin`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#666', textDecoration: 'none', border: '1px solid #333', borderRadius: 8, padding: '8px 14px' }}>
          Abrir panel admin →
        </a>
      </div>

      {/* Basic info */}
      <Section title="Información básica">
        <form onSubmit={saveTenant}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <Field label="Nombre">
              <input value={name} onChange={e => setName(e.target.value)} required style={inputStyle} />
            </Field>
            <Field label="Dominio">
              <input value={domain} onChange={e => setDomain(e.target.value)} required style={inputStyle} />
            </Field>
          </div>
          <Field label="URL del logo">
            <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
          </Field>
          {logoUrl && <img src={logoUrl} alt="" style={{ height: 36, objectFit: 'contain', marginTop: 10, filter: 'brightness(0) invert(1)', opacity: 0.7 }} />}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
            <Field label="Color primario">
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="color" value={theme.primaryColor} onChange={e => setTheme({ ...theme, primaryColor: e.target.value })} style={{ ...inputStyle, padding: 2, width: 44, flexShrink: 0 }} />
                <input value={theme.primaryColor} onChange={e => setTheme({ ...theme, primaryColor: e.target.value })} style={inputStyle} />
              </div>
            </Field>
            <Field label="Color de acento">
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="color" value={theme.accentColor} onChange={e => setTheme({ ...theme, accentColor: e.target.value })} style={{ ...inputStyle, padding: 2, width: 44, flexShrink: 0 }} />
                <input value={theme.accentColor} onChange={e => setTheme({ ...theme, accentColor: e.target.value })} style={inputStyle} />
              </div>
            </Field>
            <Field label="Fuente títulos">
              <input value={theme.fontHeading} onChange={e => setTheme({ ...theme, fontHeading: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Fuente texto">
              <input value={theme.fontBody} onChange={e => setTheme({ ...theme, fontBody: e.target.value })} style={inputStyle} />
            </Field>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <button type="submit" disabled={saving} style={btnStyle}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            {saved && <span style={{ fontSize: 13, color: '#4ade80' }}>✓ Guardado</span>}
            {saveError && <span style={{ fontSize: 13, color: '#f87171' }}>{saveError}</span>}
          </div>
        </form>
      </Section>

      {/* Domain / Vercel */}
      <Section title="Dominio en Vercel">
        {/* Row per domain */}
        {[
          { label: tenant?.domain ?? '', status: domainResult?.apex },
          { label: `www.${tenant?.domain ?? ''}`, status: domainResult?.www },
        ].map(({ label, status }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <code style={{ fontSize: 13, color: '#e2e8f0', background: '#0f0f0f', padding: '4px 10px', borderRadius: 6, minWidth: 200 }}>
              {label}
            </code>
            {domainLoading ? (
              <span style={{ fontSize: 12, color: '#555' }}>…</span>
            ) : !domainResult ? (
              <span style={{ fontSize: 12, color: '#555' }}>—</span>
            ) : !status ? (
              <span style={{ fontSize: 12, color: '#f59e0b' }}>⚠ No agregado</span>
            ) : status.error ? (
              <span style={{ fontSize: 12, color: '#f87171' }} title={status.error.message}>✗ Error: {status.error.message}</span>
            ) : status.verified ? (
              <span style={{ fontSize: 12, color: '#4ade80' }}>✓ Verificado</span>
            ) : (
              <span style={{ fontSize: 12, color: '#f87171' }}>✗ Pendiente de DNS</span>
            )}
          </div>
        ))}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, marginBottom: 16 }}>
          <button onClick={addToVercel} disabled={domainLoading} style={btnStyle}>
            {domainResult ? 'Re-agregar a Vercel' : 'Agregar a Vercel'}
          </button>
          {domainResult && (
            <button onClick={recheckVercel} disabled={domainLoading} style={{ ...btnStyle, background: 'transparent', color: '#aaa', border: '1px solid #333' }}>
              Reverificar
            </button>
          )}
        </div>

        {/* DNS records — show standard records + any TXT verification records */}
        <div style={{ background: '#0f0f0f', borderRadius: 8, padding: '14px 16px', fontSize: 12 }}>
          <div style={{ color: '#666', marginBottom: 10 }}>
            Registros DNS a configurar en el registrar del cliente:
          </div>
          <DnsRow type="A" name={tenant?.domain ?? ''} value="76.76.21.21" />
          <DnsRow type="CNAME" name="www" value="cname.vercel-dns.com" />
          {/* Extra TXT verification records from Vercel if needed */}
          {[domainResult?.apex, domainResult?.www].flatMap(s =>
            (s?.verification ?? []).filter(v => v.type === 'TXT')
          ).map((v, i) => (
            <DnsRow key={i} type="TXT" name={v.domain} value={v.value} />
          ))}
        </div>

      </Section>

      {/* Admins */}
      <Section title={`Admins (${admins.length})`}>
        <div style={{ marginBottom: 14 }}>
          {admins.length === 0 ? (
            <div style={{ fontSize: 13, color: '#555', marginBottom: 14 }}>Sin admins asignados</div>
          ) : (
            admins.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #222' }}>
                <div>
                  <div style={{ fontSize: 13, color: '#ddd' }}>{a.email}</div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{a.role}</div>
                </div>
                <button onClick={() => removeAdmin(a.user_id)} style={{ background: 'none', border: '1px solid #333', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#888', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Quitar
                </button>
              </div>
            ))
          )}
        </div>
        <form onSubmit={addAdmin} style={{ display: 'flex', gap: 10 }}>
          <input
            type="email"
            value={newAdminEmail}
            onChange={e => setNewAdminEmail(e.target.value)}
            placeholder="email@inmobiliaria.com"
            required
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="submit" disabled={addingAdmin} style={btnStyle}>
            {addingAdmin ? '…' : 'Agregar'}
          </button>
        </form>
        {adminError && <div style={{ fontSize: 13, color: '#f87171', marginTop: 8 }}>{adminError}</div>}
        {adminNotice && (
          <div style={{ fontSize: 13, color: '#8fd19e', marginTop: 8 }}>
            {adminNotice.msg}
            {adminNotice.link && (
              <input readOnly value={adminNotice.link} onClick={e => (e.target as HTMLInputElement).select()}
                style={{ ...inputStyle, fontSize: 12, marginTop: 6 }} />
            )}
          </div>
        )}
        <p style={{ fontSize: 11, color: '#555', marginTop: 8 }}>
          Si el email ya tiene cuenta, se agrega directo. Si no, se le envía una invitación para crearla.
        </p>
      </Section>

      {/* Funciones activables */}
      <Section title="Funciones">
        <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 8 }}>Menús de CRM</div>
        {CRM_CATALOG.map(c => (
          <FeatureToggle key={c.key} label={c.label} on={crmOn(c.key)}
            busy={featSaving === c.key} onToggle={() => toggleFeature('crm', c.key)} />
        ))}
        <div style={{ fontSize: 12, fontWeight: 600, color: '#888', margin: '18px 0 8px' }}>Herramientas</div>
        {TOOLS_CATALOG.map(c => (
          <FeatureToggle key={c.key} label={c.label} on={toolOn(c.key)}
            busy={featSaving === c.key} onToggle={() => toggleFeature('tools', c.key)} />
        ))}
        <p style={{ fontSize: 11, color: '#555', marginTop: 12 }}>
          Se guarda al instante. Los cambios aparecen en el panel del tenant al recargar.
        </p>
      </Section>

      {/* Sources */}
      <Section title={`Fuentes de propiedades (${sources.length})`}>
        {sources.length === 0 ? (
          <div style={{ fontSize: 13, color: '#555' }}>Sin fuentes. Configurar desde el panel admin del tenant.</div>
        ) : (
          sources.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #1e1e1e' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.is_active ? '#4ade80' : '#555', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, color: '#ddd' }}>{s.type}</div>
                <div style={{ fontSize: 11, color: '#555' }}>{JSON.stringify(s.config)}</div>
              </div>
            </div>
          ))
        )}
      </Section>

      {/* Danger zone */}
      <div style={{ background: '#1a0f0f', borderRadius: 12, padding: '20px 24px', border: '1px solid #3a1515', marginTop: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#f87171', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.08em' }}>Zona de peligro</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, color: '#ddd' }}>Eliminar tenant</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Se eliminan todos los datos permanentemente.</div>
          </div>
          <button onClick={deleteTenant} style={{ background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#141414', borderRadius: 12, padding: '20px 24px', marginBottom: 16, border: '1px solid #222' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.08em' }}>{title}</div>
      {children}
    </div>
  )
}
function FeatureToggle({ label, on, busy, onToggle }: { label: string; on: boolean; busy: boolean; onToggle: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1e1e1e' }}>
      <span style={{ fontSize: 13, color: on ? '#ddd' : '#666' }}>{label}</span>
      <button onClick={onToggle} disabled={busy} title={on ? 'Activo' : 'Inactivo'}
        style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: busy ? 'wait' : 'pointer', padding: 2, background: on ? '#4ade80' : '#333', opacity: busy ? 0.6 : 1, transition: 'background .15s' }}>
        <span style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: on ? 'translateX(18px)' : 'translateX(0)', transition: 'transform .15s' }} />
      </button>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><label style={labelStyle}>{label}</label>{children}</div>
}
function DnsRow({ type, name, value }: { type: string; name: string; value: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 1fr', gap: 10, marginBottom: 6, alignItems: 'start' }}>
      <span style={{ color: '#60a5fa', fontWeight: 700, fontFamily: 'monospace' }}>{type}</span>
      <span style={{ color: '#aaa', fontFamily: 'monospace', wordBreak: 'break-all' }}>{name}</span>
      <span style={{ color: '#e2e8f0', fontFamily: 'monospace', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#888', display: 'block', marginBottom: 6 }
const inputStyle: React.CSSProperties = { width: '100%', background: '#111', border: '1px solid #333', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const btnStyle: React.CSSProperties = { background: '#fff', color: '#111', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
