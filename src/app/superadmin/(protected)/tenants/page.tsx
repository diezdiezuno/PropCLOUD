'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Tenant { id: string; name: string; slug: string; domain: string; adminCount: number; sourceCount: number; created_at: string }

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm] = useState({ name: '', slug: '', domain: '', admin_email: '' })
  const [inviteFallback, setInviteFallback] = useState<{ id: string; warning: string; link: string } | null>(null)
  const router = useRouter()

  async function load() {
    const res = await fetch('/api/superadmin/tenants')
    if (res.ok) setTenants(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  async function createTenant(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    const res = await fetch('/api/superadmin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const tenant = await res.json()
      // Si el email de invitación al admin falló, no navegamos en silencio:
      // mostramos el link de registro para pasarlo a mano.
      if (tenant.adminInvite?.warning && tenant.adminInvite?.link) {
        setCreating(false)
        setInviteFallback({ id: tenant.id, warning: tenant.adminInvite.warning, link: tenant.adminInvite.link })
        return
      }
      setShowCreate(false)
      setForm({ name: '', slug: '', domain: '', admin_email: '' })
      router.push(`/superadmin/tenants/${tenant.id}`)
    } else {
      const { error } = await res.json()
      setCreateError(error)
    }
    setCreating(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>Tenants</h1>
          <p style={{ fontSize: 14, color: '#666', margin: 0 }}>{loading ? '…' : `${tenants.length} inmobiliaria${tenants.length !== 1 ? 's' : ''} registrada${tenants.length !== 1 ? 's' : ''}`}</p>
        </div>
        {!showCreate && (
          <button onClick={() => setShowCreate(true)} style={{ background: '#fff', color: '#111', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Nuevo tenant
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={createTenant} style={{ background: '#1a1a1a', borderRadius: 12, padding: '22px 24px', marginBottom: 20, border: '1px solid #2a2a2a' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#aaa', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.08em' }}>Nuevo tenant</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Nombre</label>
              <input value={form.name} onChange={f('name')} placeholder="Sunrise CR" required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Slug <span style={{ color: '#555', fontWeight: 400 }}>(único, sin espacios)</span></label>
              <input value={form.slug} onChange={f('slug')} placeholder="sunrise" required style={inputStyle}
                onBlur={() => setForm(p => ({ ...p, slug: p.slug.toLowerCase().replace(/\s+/g, '-') }))} />
            </div>
            <div>
              <label style={labelStyle}>Dominio</label>
              <input value={form.domain} onChange={f('domain')} placeholder="sunrisecr.com" required style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email del admin <span style={{ color: '#555', fontWeight: 400 }}>(recibe la invitación para configurar)</span></label>
            <input type="email" value={form.admin_email} onChange={f('admin_email')} placeholder="admin@sunrisecr.com" style={inputStyle} />
          </div>
          {createError && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{createError}</div>}
          {inviteFallback && (
            <div style={{ background: '#1f1a0e', border: '1px solid #5a4a1a', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ color: '#f5c451', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>El tenant se creó, pero el email de invitación no salió.</div>
              <div style={{ color: '#b0a070', fontSize: 12, marginBottom: 8 }}>{inviteFallback.warning}. Pasale este link al admin para que cree su cuenta:</div>
              <input readOnly value={inviteFallback.link} onClick={e => (e.target as HTMLInputElement).select()} style={{ ...inputStyle, fontSize: 12 }} />
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => navigator.clipboard?.writeText(inviteFallback.link)} style={{ background: '#f5c451', color: '#111', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Copiar link</button>
                <button type="button" onClick={() => router.push(`/superadmin/tenants/${inviteFallback.id}`)} style={{ background: 'none', border: '1px solid #333', borderRadius: 6, padding: '7px 16px', fontSize: 12, color: '#888', cursor: 'pointer', fontFamily: 'inherit' }}>Continuar →</button>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={creating} style={{ background: '#fff', color: '#111', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1, fontFamily: 'inherit' }}>
              {creating ? 'Creando…' : 'Crear tenant'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} style={{ background: 'none', border: '1px solid #333', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: '#888', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Tenant table */}
      <div style={{ background: '#141414', borderRadius: 12, border: '1px solid #222', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '32px 24px', color: '#555', fontSize: 14 }}>Cargando…</div>
        ) : tenants.length === 0 ? (
          <div style={{ padding: '32px 24px', color: '#555', fontSize: 14, textAlign: 'center' }}>No hay tenants registrados</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 80px 40px', gap: 0, padding: '10px 20px', borderBottom: '1px solid #222' }}>
              {['Nombre / Slug', 'Dominio', 'Admins', 'Fuentes', ''].map((h, i) => (
                <div key={i} style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '.08em' }}>{h}</div>
              ))}
            </div>
            {tenants.map((t, i) => (
              <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 80px 40px', alignItems: 'center', padding: '14px 20px', borderTop: i > 0 ? '1px solid #1e1e1e' : 'none', cursor: 'pointer' }}
                onClick={() => router.push(`/superadmin/tenants/${t.id}`)}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{t.slug}</div>
                </div>
                <div style={{ fontSize: 13, color: '#aaa' }}>{t.domain}</div>
                <div style={{ fontSize: 13, color: '#aaa' }}>{t.adminCount}</div>
                <div style={{ fontSize: 13, color: '#aaa' }}>{t.sourceCount}</div>
                <div style={{ fontSize: 16, color: '#444' }}>›</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#888', display: 'block', marginBottom: 6 }
const inputStyle: React.CSSProperties = { width: '100%', background: '#111', border: '1px solid #333', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
