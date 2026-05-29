'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

// ── Font lists ────────────────────────────────────────────────────────────────
const FONT_HEADINGS = [
  { name: 'Playfair Display', sample: 'Residencia de lujo en Escazú' },
  { name: 'Merriweather',     sample: 'Residencia de lujo en Escazú' },
  { name: 'Lora',             sample: 'Residencia de lujo en Escazú' },
  { name: 'Poppins',          sample: 'Residencia de lujo en Escazú' },
  { name: 'Raleway',          sample: 'Residencia de lujo en Escazú' },
  { name: 'Montserrat',       sample: 'Residencia de lujo en Escazú' },
]
const FONT_BODIES = [
  { name: 'Outfit',     sample: 'Casa amplia, 4 cuartos, piscina privada. Precio: $850,000' },
  { name: 'Inter',      sample: 'Casa amplia, 4 cuartos, piscina privada. Precio: $850,000' },
  { name: 'DM Sans',    sample: 'Casa amplia, 4 cuartos, piscina privada. Precio: $850,000' },
  { name: 'Nunito',     sample: 'Casa amplia, 4 cuartos, piscina privada. Precio: $850,000' },
  { name: 'Open Sans',  sample: 'Casa amplia, 4 cuartos, piscina privada. Precio: $850,000' },
  { name: 'Lato',       sample: 'Casa amplia, 4 cuartos, piscina privada. Precio: $850,000' },
]


type Tab = 'identidad' | 'branding' | 'contacto' | 'analiticas'

export default function GeneralPage() {
  const [tab, setTab] = useState<Tab>('identidad')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [tenantId, setTenantId] = useState('')

  // Identidad
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [tagline, setTagline] = useState('')
  const [defaultLang, setDefaultLang] = useState<'es' | 'en'>('es')

  // Branding
  const [logoUrl, setLogoUrl] = useState('')
  const [footerLogoMode, setFooterLogoMode] = useState<'same' | 'custom'>('same')
  const [footerLogoUrl, setFooterLogoUrl] = useState('')
  const [faviconUrl, setFaviconUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#6b2fa0')
  const [accentColor, setAccentColor] = useState('#f59e0b')
  const [fontHeading, setFontHeading] = useState('Playfair Display')
  const [fontBody, setFontBody] = useState('Outfit')
  const [uploading, setUploading] = useState<{ nav: boolean; footer: boolean; favicon: boolean }>({ nav: false, footer: false, favicon: false })

  // Analíticas
  const [gaId, setGaId] = useState('')

  // Contacto
  const [whatsapp, setWhatsapp] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactEmail2, setContactEmail2] = useState('')
  const [address, setAddress] = useState('')
  const [instagram, setInstagram] = useState('')
  const [facebook, setFacebook] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [youtube, setYoutube] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [twitter, setTwitter] = useState('')

  async function uploadLogo(file: File, field: 'nav' | 'footer' | 'favicon') {
    if (!tenantId) { setError('tenantId no disponible — recargá la página.'); return }
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${tenantId}/${field}-logo-${Date.now()}.${ext}`
    setUploading(u => ({ ...u, [field]: true }))
    setError('')
    const supabase = createClient()
    const { error: upErr } = await supabase.storage
      .from('tenant-assets')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) {
      console.error('[uploadLogo]', upErr)
      setUploading(u => ({ ...u, [field]: false }))
      setError(`Error al subir: ${upErr.message}`)
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('tenant-assets').getPublicUrl(path)
    if (field === 'nav') setLogoUrl(publicUrl)
    else if (field === 'footer') setFooterLogoUrl(publicUrl)
    else setFaviconUrl(publicUrl)
    setUploading(u => ({ ...u, [field]: false }))
  }

  // Load Google Fonts into admin so previews render correctly
  useEffect(() => {
    const allFonts = [...FONT_HEADINGS, ...FONT_BODIES].map(f => f.name.replace(/ /g, '+') + ':wght@400;600;700').join('|')
    const id = 'admin-gfonts'
    if (!document.getElementById(id)) {
      const link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?${[...FONT_HEADINGS, ...FONT_BODIES].map(f => `family=${f.name.replace(/ /g, '+')}:wght@400;600;700`).join('&')}&display=swap`
      document.head.appendChild(link)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: adminRec } = await supabase
        .from('tenant_admins').select('tenant_id').eq('user_id', user.id).single()
      if (!adminRec) return
      setTenantId(adminRec.tenant_id)

      const [{ data: tenant }, { data: cfg }] = await Promise.all([
        supabase.from('tenants').select('name, domain, tagline, logo_url, favicon_url, theme').eq('id', adminRec.tenant_id).single(),
        supabase.from('tenant_config').select('footer_logo_url, default_language, whatsapp, contact_email, contact_email_2, address, instagram, facebook, linkedin, youtube, tiktok, twitter, ga_id').eq('tenant_id', adminRec.tenant_id).single(),
      ])

      if (tenant) {
        setName(tenant.name ?? '')
        setDomain(tenant.domain ?? '')
        setTagline(tenant.tagline ?? '')
        setLogoUrl(tenant.logo_url ?? '')
        setFaviconUrl(tenant.favicon_url ?? '')
        setPrimaryColor(tenant.theme?.primaryColor ?? '#6b2fa0')
        setAccentColor(tenant.theme?.accentColor ?? '#f59e0b')
        setFontHeading(tenant.theme?.fontHeading ?? 'Playfair Display')
        setFontBody(tenant.theme?.fontBody ?? 'Outfit')
      }
      if (cfg?.footer_logo_url) {
        setFooterLogoMode('custom')
        setFooterLogoUrl(cfg.footer_logo_url)
      }
      if (cfg?.default_language) setDefaultLang(cfg.default_language as 'es' | 'en')
      if (cfg) {
        setWhatsapp(cfg.whatsapp ?? '')
        setContactEmail(cfg.contact_email ?? '')
        setContactEmail2((cfg as Record<string, string | null>).contact_email_2 ?? '')
        setAddress(cfg.address ?? '')
        setInstagram(cfg.instagram ?? '')
        setFacebook(cfg.facebook ?? '')
        setLinkedin(cfg.linkedin ?? '')
        setYoutube(cfg.youtube ?? '')
        setTiktok(cfg.tiktok ?? '')
        setTwitter(cfg.twitter ?? '')
        setGaId((cfg as unknown as { ga_id?: string | null }).ga_id ?? '')
      }
      setLoading(false)
    })
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const supabase = createClient()

    if (tab === 'identidad') {
      const { error: err } = await supabase
        .from('tenants')
        .update({ name, domain: domain.toLowerCase().trim(), tagline: tagline.trim() || null })
        .eq('id', tenantId)
      if (err) {
        setError(err.message.includes('unique') ? 'Ese dominio ya está registrado en otro tenant.' : err.message)
        setSaving(false)
        return
      }
      await supabase.from('tenant_config').upsert(
        { tenant_id: tenantId, default_language: defaultLang },
        { onConflict: 'tenant_id' }
      )
    } else if (tab === 'branding') {
      // Fetch current theme first so we don't overwrite mapStyle (managed in Mapa)
      const { data: tenantRow } = await supabase.from('tenants').select('theme').eq('id', tenantId).single()
      await supabase.from('tenants').update({
        logo_url: logoUrl || null,
        favicon_url: faviconUrl || null,
        theme: { ...(tenantRow?.theme ?? {}), primaryColor, accentColor, fontHeading, fontBody },
      }).eq('id', tenantId)
      await supabase.from('tenant_config').upsert({
        tenant_id: tenantId,
        footer_logo_url: footerLogoMode === 'custom' ? (footerLogoUrl || null) : null,
      }, { onConflict: 'tenant_id' })
    } else if (tab === 'contacto') {
      await supabase.from('tenant_config').upsert({
        tenant_id: tenantId,
        whatsapp: whatsapp.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_email_2: contactEmail2.trim() || null,
        address: address.trim() || null,
        instagram: instagram.trim() || null,
        facebook: facebook.trim() || null,
        linkedin: linkedin.trim() || null,
        youtube: youtube.trim() || null,
        tiktok: tiktok.trim() || null,
        twitter: twitter.trim() || null,
      }, { onConflict: 'tenant_id' })
    } else {
      // analiticas
      await supabase.from('tenant_config').upsert({
        tenant_id: tenantId,
        ga_id: gaId.trim() || null,
      }, { onConflict: 'tenant_id' })
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 6px' }}>General</h1>
        <p style={{ fontSize: 14, color: '#888', margin: 0 }}>Identidad y apariencia de tu inmobiliaria</p>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e8e8e8', marginBottom: 24 }}>
        {([['identidad', 'Identidad'], ['branding', 'Branding'], ['contacto', 'Contacto'], ['analiticas', 'Analíticas']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setError(''); setSaved(false) }} style={{
            padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: tab === id ? 600 : 400,
            color: tab === id ? '#111' : '#888', fontFamily: 'inherit',
            borderBottom: `2px solid ${tab === id ? '#111' : 'transparent'}`,
            marginBottom: -1, transition: 'color .15s',
          }}>
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={save}>

        {/* ══ TAB: IDENTIDAD ══ */}
        {tab === 'identidad' && (
          <Section title="Datos de la inmobiliaria">
            <Field label="Nombre de la inmobiliaria">
              <input value={name} onChange={e => setName(e.target.value)} required style={inputStyle} />
              <p style={hintStyle}>Aparece en el título del browser, el footer y el panel.</p>
            </Field>
            <div style={{ height: 16 }} />
            <Field label="Idioma predeterminado del sitio">
              <div style={{ display: 'flex', gap: 10 }}>
                {([['es', 'Español', 'Títulos y descripciones en español por defecto'], ['en', 'English', 'Titles and descriptions in English by default']] as const).map(([v, label, desc]) => {
                  const active = defaultLang === v
                  return (
                    <button key={v} type="button" onClick={() => setDefaultLang(v)} style={{
                      flex: 1, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                      border: `2px solid ${active ? '#111' : '#e5e5e5'}`,
                      background: active ? '#111' : '#fff',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: active ? '#fff' : '#111', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 11, color: active ? 'rgba(255,255,255,.55)' : '#aaa' }}>{desc}</div>
                    </button>
                  )
                })}
              </div>
              <p style={hintStyle}>Los visitantes pueden cambiar el idioma en cualquier momento usando el toggle ES | EN en la navegación.</p>
            </Field>
            <div style={{ height: 16 }} />
            <Field label="Slogan / descripción corta">
              <textarea
                value={tagline}
                onChange={e => setTagline(e.target.value)}
                placeholder="Ej: Especialistas en propiedades residenciales en el Valle Central desde 2008."
                maxLength={180}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              />
              <p style={hintStyle}>
                Aparece debajo del logo en el footer. Máximo 180 caracteres.
                {tagline.length > 0 && <span style={{ float: 'right', color: tagline.length > 160 ? '#e53e3e' : '#bbb' }}>{tagline.length}/180</span>}
              </p>
            </Field>
            <div style={{ height: 16 }} />
            <Field label="Dominio">
              <input
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="sunrisecr.com"
                required
                style={inputStyle}
              />
              <p style={hintStyle}>
                Sin <code>https://</code> ni <code>www</code>. Ejemplo: <code>sunrisecr.com</code><br />
                El sistema muestra el tenant correcto cuando detecta este dominio en el request.
              </p>
            </Field>
          </Section>
        )}

        {/* ══ TAB: BRANDING ══ */}
        {tab === 'branding' && (
          <>
            {/* Logos */}
            <Section title="Logo principal (Nav)">
              <LogoUploader
                url={logoUrl}
                onUrl={setLogoUrl}
                onFile={f => uploadLogo(f, 'nav')}
                uploading={uploading.nav}
                hint="Se muestra en la barra de navegación. PNG o SVG con fondo transparente recomendado."
              />
            </Section>

            <Section title="Logo del footer">
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                {([['same', 'Usar el mismo logo'], ['custom', 'Logo diferente']] as const).map(([v, label]) => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: '#333' }}>
                    <input type="radio" name="footerLogoMode" value={v}
                      checked={footerLogoMode === v} onChange={() => setFooterLogoMode(v)}
                      style={{ accentColor: '#111' }} />
                    {label}
                  </label>
                ))}
              </div>
              {footerLogoMode === 'custom' ? (
                <LogoUploader
                  url={footerLogoUrl}
                  onUrl={setFooterLogoUrl}
                  onFile={f => uploadLogo(f, 'footer')}
                  uploading={uploading.footer}
                  hint="Versión del logo para fondo oscuro del footer. Generalmente blanca o clara."
                  darkPreview
                />
              ) : logoUrl ? (
                <div style={{ background: '#1a1a1a', borderRadius: 8, padding: '12px 16px', display: 'inline-block', marginTop: 4 }}>
                  <img src={logoUrl} alt="Footer logo preview"
                    style={{ height: 36, objectFit: 'contain', display: 'block' }} />
                </div>
              ) : (
                <p style={{ fontSize: 13, color: '#bbb', margin: 0 }}>Subí primero el logo principal.</p>
              )}
            </Section>

            {/* Favicon */}
            <Section title="Favicon">
              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <LogoUploader
                    url={faviconUrl}
                    onUrl={setFaviconUrl}
                    onFile={f => uploadLogo(f, 'favicon')}
                    uploading={uploading.favicon}
                    hint="PNG o ICO de 32×32 px (mínimo) o 64×64 px. Aparece en la pestaña del browser y bookmarks."
                    square
                  />
                </div>
                {/* Browser tab mockup */}
                <div style={{ flexShrink: 0, paddingTop: 4 }}>
                  <div style={{ fontSize: 10, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Vista previa</div>
                  <div style={{ background: '#e8e8e8', borderRadius: '8px 8px 0 0', padding: '6px 12px 0', width: 180 }}>
                    <div style={{ background: '#fff', borderRadius: '6px 6px 0 0', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {faviconUrl ? (
                        <img src={faviconUrl} alt="" style={{ width: 14, height: 14, objectFit: 'contain', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 14, height: 14, borderRadius: 3, background: '#e0e0e0', flexShrink: 0 }} />
                      )}
                      <span style={{ fontSize: 11, color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {name || 'Mi inmobiliaria'}
                      </span>
                      <span style={{ fontSize: 11, color: '#bbb', marginLeft: 'auto', flexShrink: 0 }}>×</span>
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            {/* Colors */}
            <Section title="Colores">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 18 }}>
                <Field label="Color primario">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                      style={{ width: 44, height: 36, borderRadius: 8, border: '1px solid #e0e0e0', padding: 2, cursor: 'pointer' }} />
                    <input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                      style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }} />
                  </div>
                  <p style={{ ...hintStyle, marginTop: 5 }}>Menú activo, botones, gradientes.</p>
                </Field>
                <Field label="Color de acento">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                      style={{ width: 44, height: 36, borderRadius: 8, border: '1px solid #e0e0e0', padding: 2, cursor: 'pointer' }} />
                    <input value={accentColor} onChange={e => setAccentColor(e.target.value)}
                      style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }} />
                  </div>
                  <p style={{ ...hintStyle, marginTop: 5 }}>Badges, etiquetas, precio en cards, redes sociales.</p>
                </Field>
              </div>

              {/* Color preview */}
              <div style={{ background: '#f8f8f8', borderRadius: 10, padding: '14px 18px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#bbb', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 12 }}>Vista previa</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 10, color: '#999', marginBottom: 6 }}>Slider de precio</div>
                    <div style={{ position: 'relative', height: 6, background: '#e0e0e0', borderRadius: 3 }}>
                      <div style={{ position: 'absolute', left: '20%', width: '60%', height: '100%', background: `linear-gradient(90deg, ${accentColor}, ${primaryColor})`, borderRadius: 3 }} />
                      <div style={{ position: 'absolute', left: '20%', top: '50%', transform: 'translate(-50%,-50%)', width: 14, height: 14, borderRadius: '50%', background: '#1a1a1a', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
                      <div style={{ position: 'absolute', left: '80%', top: '50%', transform: 'translate(-50%,-50%)', width: 14, height: 14, borderRadius: '50%', background: '#1a1a1a', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#999', marginBottom: 8 }}>Carga</div>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: `conic-gradient(from 0deg, ${primaryColor} 0%, ${accentColor} 60%, transparent 85%)`, WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px))', mask: 'radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px))' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#999', marginBottom: 6 }}>Etiqueta</div>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: accentColor }}>Casa</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#999', marginBottom: 6 }}>Botón</div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: `linear-gradient(135deg, ${accentColor}, ${primaryColor})`, padding: '5px 12px', borderRadius: 4 }}>Ver propiedad</span>
                  </div>
                </div>
              </div>
            </Section>

            {/* Typography */}
            <Section title="Tipografía">
              <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 20, lineHeight: 1.6 }}>
                La <strong style={{ color: '#555' }}>fuente de títulos</strong> se usa en nombres de propiedades, títulos de sección y el logo de texto.
                La <strong style={{ color: '#555' }}>fuente de cuerpo</strong> se usa en precios, descripciones, navegación y formularios.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Heading font */}
                <div>
                  <label style={labelStyle}>Fuente de títulos</label>
                  <select value={fontHeading} onChange={e => setFontHeading(e.target.value)} style={selectStyle}>
                    {FONT_HEADINGS.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                  </select>
                  {/* Live preview */}
                  <div style={{ marginTop: 12, padding: '14px 16px', background: '#f9f9f9', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: 10, color: '#bbb', fontFamily: 'system-ui', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Vista previa</div>
                    <div style={{ fontFamily: `'${fontHeading}', serif`, fontSize: 20, color: '#111', lineHeight: 1.3, marginBottom: 6 }}>
                      Casa Contemporánea con Vista al Valle
                    </div>
                    <div style={{ fontFamily: `'${fontHeading}', serif`, fontSize: 13, color: '#888', fontStyle: 'italic' }}>
                      Residencia de diseño en Escazú
                    </div>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {FONT_HEADINGS.map(f => (
                      <button key={f.name} type="button" onClick={() => setFontHeading(f.name)} style={{
                        padding: '8px 12px', borderRadius: 7, border: `1px solid ${fontHeading === f.name ? '#111' : '#eee'}`,
                        background: fontHeading === f.name ? '#111' : '#fff', cursor: 'pointer',
                        display: 'flex', alignItems: 'baseline', gap: 10, textAlign: 'left',
                      }}>
                        <span style={{ fontSize: 10, color: fontHeading === f.name ? '#aaa' : '#bbb', fontFamily: 'system-ui', minWidth: 80 }}>{f.name}</span>
                        <span style={{ fontFamily: `'${f.name}', serif`, fontSize: 15, color: fontHeading === f.name ? '#fff' : '#333' }}>
                          {f.sample.slice(0, 20)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Body font */}
                <div>
                  <label style={labelStyle}>Fuente de cuerpo</label>
                  <select value={fontBody} onChange={e => setFontBody(e.target.value)} style={selectStyle}>
                    {FONT_BODIES.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                  </select>
                  {/* Live preview */}
                  <div style={{ marginTop: 12, padding: '14px 16px', background: '#f9f9f9', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: 10, color: '#bbb', fontFamily: 'system-ui', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Vista previa</div>
                    <div style={{ fontFamily: `'${fontBody}', sans-serif`, fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 4 }}>
                      $1,250,000
                    </div>
                    <div style={{ fontFamily: `'${fontBody}', sans-serif`, fontSize: 13, color: '#666', lineHeight: 1.6 }}>
                      4 habitaciones · 3 baños · 320 m² const.
                    </div>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {FONT_BODIES.map(f => (
                      <button key={f.name} type="button" onClick={() => setFontBody(f.name)} style={{
                        padding: '8px 12px', borderRadius: 7, border: `1px solid ${fontBody === f.name ? '#111' : '#eee'}`,
                        background: fontBody === f.name ? '#111' : '#fff', cursor: 'pointer',
                        display: 'flex', alignItems: 'baseline', gap: 10, textAlign: 'left',
                      }}>
                        <span style={{ fontSize: 10, color: fontBody === f.name ? '#aaa' : '#bbb', fontFamily: 'system-ui', minWidth: 80 }}>{f.name}</span>
                        <span style={{ fontFamily: `'${f.name}', sans-serif`, fontSize: 14, color: fontBody === f.name ? '#fff' : '#555' }}>
                          {f.sample.slice(0, 28)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

          </>
        )}

        {/* ══ TAB: CONTACTO ══ */}
        {tab === 'contacto' && (
          <>
            <Section title="Contacto directo">
              <Field label="WhatsApp (con código de país, sin + ni espacios)">
                <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                  placeholder="50688888888" style={inputStyle} />
                <p style={hintStyle}>Aparece en el footer y en el botón de contacto de cada propiedad.</p>
              </Field>
              <div style={{ height: 14 }} />
              <Field label="Email de contacto">
                <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                  placeholder="info@tuinmobiliaria.com" style={inputStyle} />
              </Field>
              <div style={{ height: 14 }} />
              <Field label="Email de contacto 2 (opcional)">
                <input type="email" value={contactEmail2} onChange={e => setContactEmail2(e.target.value)}
                  placeholder="ventas@tuinmobiliaria.com" style={inputStyle} />
                <p style={hintStyle}>Si se define, las notificaciones de formularios también se envían a este email.</p>
              </Field>
              <div style={{ height: 14 }} />
              <Field label="Dirección">
                <input value={address} onChange={e => setAddress(e.target.value)}
                  placeholder="San José, Costa Rica" style={inputStyle} />
              </Field>
            </Section>

            <Section title="Redes sociales">
              <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 16, lineHeight: 1.5 }}>
                Pegá la URL completa de cada perfil. Las redes con URL aparecen como íconos en el footer.
              </p>
              {([
                ['📸', 'Instagram',   instagram,  setInstagram,  'https://instagram.com/tuinmobiliaria'],
                ['👥', 'Facebook',    facebook,   setFacebook,   'https://facebook.com/tuinmobiliaria'],
                ['💼', 'LinkedIn',    linkedin,   setLinkedin,   'https://linkedin.com/company/tu'],
                ['▶️', 'YouTube',     youtube,    setYoutube,    'https://youtube.com/@tuinmobiliaria'],
                ['🎵', 'TikTok',      tiktok,     setTiktok,     'https://tiktok.com/@tuinmobiliaria'],
                ['𝕏',  'X / Twitter', twitter,    setTwitter,    'https://x.com/tuinmobiliaria'],
              ] as [string, string, string, (v: string) => void, string][]).map(([icon, label, value, setter, placeholder]) => (
                <Field key={label} label={`${icon} ${label}`}>
                  <input value={value} onChange={e => setter(e.target.value)}
                    placeholder={placeholder} style={{ ...inputStyle, marginBottom: 10 }} />
                </Field>
              ))}
            </Section>
          </>
        )}

        {/* ══ TAB: ANALÍTICAS ══ */}
        {tab === 'analiticas' && (
          <>
            <Section title="Google Analytics">
              <Field label="Measurement ID">
                <input
                  value={gaId}
                  onChange={e => setGaId(e.target.value)}
                  placeholder="G-XXXXXXXXXX"
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                />
                <p style={hintStyle}>
                  Encontralo en Google Analytics → Admin → Data Streams → tu stream → Measurement ID.
                  El script se inyecta automáticamente en todas las páginas del sitio.
                </p>
              </Field>
              {gaId.trim() && (
                <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>✅</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>Google Analytics activo</div>
                    <div style={{ fontSize: 12, color: '#4ade80' }}>{gaId.trim()}</div>
                  </div>
                  <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer"
                    style={{ marginLeft: 'auto', fontSize: 12, color: '#166534', textDecoration: 'none', fontWeight: 500, padding: '5px 12px', border: '1px solid #86efac', borderRadius: 6 }}>
                    Abrir Analytics →
                  </a>
                </div>
              )}
            </Section>

            <Section title="Dashboard de métricas">
              <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 12 }}>
                Visualizá leads y actividad interna del sitio.
              </p>
              <a href="/admin/metricas"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#111', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                📊 Ver métricas →
              </a>
            </Section>
          </>
        )}

        {error && (
          <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 10, padding: '12px 16px', marginBottom: 12, fontSize: 13, color: '#c53030', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>⚠️</span>
            <span>{error}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 4 }}>
          <button type="submit" disabled={saving} style={{
            background: '#111', color: '#fff', border: 'none', borderRadius: 10,
            padding: '11px 24px', fontSize: 14, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit',
          }}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {saved && <span style={{ fontSize: 13, color: '#38a169' }}>✓ Guardado</span>}
        </div>
      </form>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function LogoUploader({
  url, onUrl, onFile, uploading, hint, darkPreview, square,
}: {
  url: string
  onUrl: (v: string) => void
  onFile: (f: File) => void
  uploading: boolean
  hint?: string
  darkPreview?: boolean
  square?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) onFile(file)
  }

  return (
    <div>
      {/* Drop zone */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        style={{
          border: '2px dashed #e0e0e0', borderRadius: 10, padding: '20px 16px',
          display: 'flex', alignItems: 'center', gap: 16, cursor: uploading ? 'default' : 'pointer',
          background: uploading ? '#f9f9f9' : '#fdfdfd',
          transition: 'border-color .15s, background .15s',
        }}
        onMouseEnter={e => { if (!uploading) (e.currentTarget as HTMLElement).style.borderColor = '#bbb' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e0e0e0' }}
      >
        {/* Thumbnail */}
        <div style={{
          width: square ? 48 : 64, height: square ? 48 : 64, flexShrink: 0, borderRadius: square ? 6 : 8, overflow: 'hidden',
          background: darkPreview ? '#1a1a1a' : '#f0f0f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid #e8e8e8',
        }}>
          {uploading ? (
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #ddd', borderTopColor: '#888', animation: 'spin 0.7s linear infinite' }} />
          ) : url ? (
            <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: 6 }} />
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 2 }}>
            {uploading ? 'Subiendo…' : url ? 'Cambiar imagen' : 'Subir imagen'}
          </div>
          <div style={{ fontSize: 11, color: '#aaa' }}>
            {uploading ? 'Por favor esperá' : 'PNG, SVG, JPG o WebP · Arrastrá o hacé click'}
          </div>
        </div>

        {url && !uploading && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onUrl('') }}
            style={{ fontSize: 11, color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, fontFamily: 'inherit', flexShrink: 0 }}
          >
            Quitar
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/svg+xml,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }}
      />

      {/* Full preview */}
      {url && !uploading && (
        <div style={{
          marginTop: 10, borderRadius: 8, padding: '16px 20px',
          background: darkPreview ? '#1a1a1a' : '#f7f7f7',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 72, border: `1px solid ${darkPreview ? '#333' : '#ebebeb'}`,
        }}>
          <img
            src={url}
            alt="Logo preview"
            style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain', display: 'block' }}
          />
        </div>
      )}

      {/* URL fallback */}
      <div style={{ marginTop: 10 }}>
        <label style={{ fontSize: 11, color: '#bbb', display: 'block', marginBottom: 4 }}>O pegá una URL directamente</label>
        <input
          value={url}
          onChange={e => onUrl(e.target.value)}
          placeholder="https://..."
          style={{ ...inputStyle, fontSize: 12 }}
        />
      </div>

      {hint && <p style={hintStyle}>{hint}</p>}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '22px 24px', marginBottom: 16, border: '1px solid #ebebeb' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.08em' }}>{title}</div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }
const hintStyle: React.CSSProperties = { fontSize: 11, color: '#bbb', margin: '6px 0 0', lineHeight: 1.5 }
const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #e0e0e0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const selectStyle: React.CSSProperties = { ...inputStyle, background: '#fff', cursor: 'pointer' }
