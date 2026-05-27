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

// ── Map styles ────────────────────────────────────────────────────────────────
const MAP_STYLES = [
  {
    value: 'mapbox://styles/mapbox/streets-v12',
    label: 'Streets',
    color: '#e8ddd0',
    desc: 'Calles, edificios y puntos de interés. El más completo para propiedades urbanas.',
  },
  {
    value: 'mapbox://styles/mapbox/light-v11',
    label: 'Light',
    color: '#f2f0ec',
    desc: 'Fondo claro y minimalista. Los markers de propiedades destacan sin distracción.',
  },
  {
    value: 'mapbox://styles/mapbox/dark-v11',
    label: 'Dark',
    color: '#1a1c23',
    desc: 'Fondo oscuro elegante. Perfecto para inmobiliarias premium o de nicho.',
  },
  {
    value: 'mapbox://styles/mapbox/satellite-streets-v12',
    label: 'Satélite',
    color: '#3a5a3a',
    desc: 'Fotografía aérea real con calles superpuestas. Ideal para lotes y propiedades grandes.',
  },
  {
    value: 'mapbox://styles/mapbox/outdoors-v12',
    label: 'Outdoors',
    color: '#d6e8cc',
    desc: 'Topografía y terreno natural. Para propiedades rurales, de playa o de montaña.',
  },
]

type Tab = 'identidad' | 'branding'

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

  // Branding
  const [logoUrl, setLogoUrl] = useState('')
  const [footerLogoMode, setFooterLogoMode] = useState<'same' | 'custom'>('same')
  const [footerLogoUrl, setFooterLogoUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#6b2fa0')
  const [accentColor, setAccentColor] = useState('#f59e0b')
  const [fontHeading, setFontHeading] = useState('Playfair Display')
  const [fontBody, setFontBody] = useState('Outfit')
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/streets-v12')
  const [uploading, setUploading] = useState<{ nav: boolean; footer: boolean }>({ nav: false, footer: false })

  async function uploadLogo(file: File, field: 'nav' | 'footer') {
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
    else setFooterLogoUrl(publicUrl)
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
        supabase.from('tenants').select('name, domain, logo_url, theme').eq('id', adminRec.tenant_id).single(),
        supabase.from('tenant_config').select('footer_logo_url').eq('tenant_id', adminRec.tenant_id).single(),
      ])

      if (tenant) {
        setName(tenant.name ?? '')
        setDomain(tenant.domain ?? '')
        setLogoUrl(tenant.logo_url ?? '')
        setPrimaryColor(tenant.theme?.primaryColor ?? '#6b2fa0')
        setAccentColor(tenant.theme?.accentColor ?? '#f59e0b')
        setFontHeading(tenant.theme?.fontHeading ?? 'Playfair Display')
        setFontBody(tenant.theme?.fontBody ?? 'Outfit')
        setMapStyle(tenant.theme?.mapStyle ?? 'mapbox://styles/mapbox/streets-v12')
      }
      if (cfg?.footer_logo_url) {
        setFooterLogoMode('custom')
        setFooterLogoUrl(cfg.footer_logo_url)
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
        .update({ name, domain: domain.toLowerCase().trim() })
        .eq('id', tenantId)
      if (err) {
        setError(err.message.includes('unique') ? 'Ese dominio ya está registrado en otro tenant.' : err.message)
        setSaving(false)
        return
      }
    } else {
      await supabase.from('tenants').update({
        logo_url: logoUrl || null,
        theme: { primaryColor, accentColor, fontHeading, fontBody, mapStyle },
      }).eq('id', tenantId)
      await supabase.from('tenant_config').upsert({
        tenant_id: tenantId,
        footer_logo_url: footerLogoMode === 'custom' ? (footerLogoUrl || null) : null,
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
        {(['identidad', 'branding'] as Tab[]).map(t => (
          <button key={t} onClick={() => { setTab(t); setError(''); setSaved(false) }} style={{
            padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: tab === t ? 600 : 400,
            color: tab === t ? '#111' : '#888', fontFamily: 'inherit',
            borderBottom: `2px solid ${tab === t ? '#111' : 'transparent'}`,
            marginBottom: -1, transition: 'color .15s',
            textTransform: 'capitalize',
          }}>
            {t === 'identidad' ? 'Identidad' : 'Branding'}
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

            {/* Map style */}
            <Section title="Estilo del mapa">
              <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
                Define la apariencia visual del mapa en la página principal y en los mapas estáticos de cada propiedad.
                No afecta qué propiedades se muestran ni su ubicación.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {MAP_STYLES.map(s => {
                  const active = mapStyle === s.value
                  return (
                    <button key={s.value} type="button" onClick={() => setMapStyle(s.value)} style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
                      borderRadius: 10, border: `2px solid ${active ? '#111' : '#eee'}`,
                      background: active ? '#111' : '#fff', cursor: 'pointer', textAlign: 'left',
                    }}>
                      {/* Color swatch */}
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: s.color, flexShrink: 0, border: '1px solid rgba(0,0,0,.08)' }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: active ? '#fff' : '#111', marginBottom: 2 }}>{s.label}</div>
                        <div style={{ fontSize: 11, color: active ? 'rgba(255,255,255,.55)' : '#aaa' }}>{s.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
              <Field label="URL de estilo custom (Mapbox Studio)">
                <input value={mapStyle} onChange={e => setMapStyle(e.target.value)}
                  placeholder="mapbox://styles/..." style={inputStyle} />
                <p style={hintStyle}>Si tenés un estilo propio en Mapbox Studio, pegá la URL aquí.</p>
              </Field>
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
  url, onUrl, onFile, uploading, hint, darkPreview,
}: {
  url: string
  onUrl: (v: string) => void
  onFile: (f: File) => void
  uploading: boolean
  hint?: string
  darkPreview?: boolean
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
        {/* Preview or placeholder */}
        <div style={{
          width: 72, height: 48, flexShrink: 0, borderRadius: 7, overflow: 'hidden',
          background: darkPreview ? '#1a1a1a' : '#f0f0f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid #e8e8e8',
        }}>
          {uploading ? (
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #ddd', borderTopColor: '#888', animation: 'spin 0.7s linear infinite' }} />
          ) : url ? (
            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
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
