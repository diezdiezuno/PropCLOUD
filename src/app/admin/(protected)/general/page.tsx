'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export default function GeneralPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: adminRec } = await supabase
        .from('tenant_admins').select('tenant_id').eq('user_id', user.id).single()
      if (!adminRec) return
      setTenantId(adminRec.tenant_id)
      const { data: tenant } = await supabase
        .from('tenants').select('slug, name, domain').eq('id', adminRec.tenant_id).single()
      if (tenant) {
        setSlug(tenant.slug)
        setName(tenant.name)
        setDomain(tenant.domain)
      }
      setLoading(false)
    })
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase
      .from('tenants')
      .update({ name, domain: domain.toLowerCase().trim() })
      .eq('id', tenantId)
    if (err) {
      setError(err.message.includes('unique') ? 'Ese dominio ya está registrado en otro tenant.' : err.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  if (loading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 6px' }}>General</h1>
        <p style={{ fontSize: 14, color: '#888', margin: 0 }}>Nombre e identidad del tenant</p>
      </div>

      <form onSubmit={save}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '22px 24px', marginBottom: 16, border: '1px solid #ebebeb' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Identidad
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Slug <span style={{ color: '#bbb', fontWeight: 400 }}>(solo lectura)</span></label>
            <input value={slug} readOnly style={{ ...inputStyle, background: '#f9f9f9', color: '#aaa', cursor: 'not-allowed' }} />
            <p style={{ fontSize: 11, color: '#bbb', margin: '4px 0 0' }}>Identificador interno, no se puede cambiar.</p>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Nombre de la inmobiliaria</label>
            <input value={name} onChange={e => setName(e.target.value)} required style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Dominio</label>
            <input
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="sunrisecr.com"
              required
              style={inputStyle}
            />
            <p style={{ fontSize: 11, color: '#888', margin: '6px 0 0', lineHeight: 1.5 }}>
              Sin <code>https://</code> ni <code>www</code>. Ejemplo: <code>sunrisecr.com</code><br />
              El sistema sirve el tenant correcto cuando detecta este dominio en el request.<br />
              <span style={{ color: '#e07b39' }}>⚠️ Cambiarlo no actualiza el DNS — asegurate de apuntar el dominio a Vercel primero.</span>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button type="submit" disabled={saving} style={{
            background: '#111', color: '#fff', border: 'none', borderRadius: 10,
            padding: '11px 24px', fontSize: 14, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit',
          }}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {saved && <span style={{ fontSize: 13, color: '#38a169' }}>✓ Guardado</span>}
          {error && <span style={{ fontSize: 13, color: '#c53030' }}>{error}</span>}
        </div>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }
const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #e0e0e0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
