'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export default function ContactoPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tenantId, setTenantId] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [instagram, setInstagram] = useState('')
  const [facebook, setFacebook] = useState('')
  const [linkedin, setLinkedin] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: adminRec } = await supabase
        .from('tenant_admins').select('tenant_id').eq('user_id', user.id).single()
      if (!adminRec) return
      setTenantId(adminRec.tenant_id)
      const { data: cfg } = await supabase
        .from('tenant_config')
        .select('whatsapp, contact_email, address, instagram, facebook, linkedin')
        .eq('tenant_id', adminRec.tenant_id).single()
      if (cfg) {
        setWhatsapp(cfg.whatsapp ?? '')
        setEmail(cfg.contact_email ?? '')
        setAddress(cfg.address ?? '')
        setInstagram(cfg.instagram ?? '')
        setFacebook(cfg.facebook ?? '')
        setLinkedin(cfg.linkedin ?? '')
      }
      setLoading(false)
    })
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    await supabase.from('tenant_config').upsert({
      tenant_id: tenantId,
      whatsapp: whatsapp || null,
      contact_email: email || null,
      address: address || null,
      instagram: instagram || null,
      facebook: facebook || null,
      linkedin: linkedin || null,
    }, { onConflict: 'tenant_id' })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="Contacto y redes" desc="Información de contacto y links a redes sociales" />
      <form onSubmit={save}>

        <Section title="Contacto directo">
          <Field label="WhatsApp (con código de país, sin + ni espacios)">
            <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
              placeholder="50688888888" style={inputStyle} />
          </Field>
          <Field label="Email de contacto">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="info@tuinmobiliaria.com" style={inputStyle} />
          </Field>
          <Field label="Dirección">
            <input value={address} onChange={e => setAddress(e.target.value)}
              placeholder="San José, Costa Rica" style={inputStyle} />
          </Field>
        </Section>

        <Section title="Redes sociales">
          {([
            ['Instagram', instagram, setInstagram, 'https://instagram.com/tuinmobiliaria'],
            ['Facebook',  facebook,  setFacebook,  'https://facebook.com/tuinmobiliaria'],
            ['LinkedIn',  linkedin,  setLinkedin,  'https://linkedin.com/company/tuinmobiliaria'],
          ] as const).map(([label, value, setter, placeholder]) => (
            <Field key={label} label={label}>
              <input value={value} onChange={e => setter(e.target.value)}
                placeholder={placeholder} style={inputStyle} />
            </Field>
          ))}
        </Section>

        <SaveBar saving={saving} saved={saved} />
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>{label}</label>{children}</div>
}
function PageLoader() { return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div> }
function PageHeader({ title, desc }: { title: string; desc: string }) {
  return <div style={{ marginBottom: 32 }}><h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 6px' }}>{title}</h1><p style={{ fontSize: 14, color: '#888', margin: 0 }}>{desc}</p></div>
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ background: '#fff', borderRadius: 12, padding: '22px 24px', marginBottom: 16, border: '1px solid #ebebeb' }}><div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.08em' }}>{title}</div>{children}</div>
}
function SaveBar({ saving, saved }: { saving: boolean; saved: boolean }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 4 }}><button type="submit" disabled={saving} style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>{saved && <span style={{ fontSize: 13, color: '#38a169' }}>✓ Guardado</span>}</div>
}
const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #e0e0e0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 0 }
