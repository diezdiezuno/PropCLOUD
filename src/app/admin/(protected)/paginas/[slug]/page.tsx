'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import type { PageConfig, PageSettings } from '@/types'
import PageHeader from '@/components/admin/PageHeader'

const PREDEFINED_SLUGS = ['nosotros', 'agentes', 'contacto', 'listar', 'reclutamiento']

const LISTAR_FIELD_OPTIONS = [
  { key: 'phone',       label: 'Teléfono' },
  { key: 'type',        label: 'Tipo de propiedad' },
  { key: 'transaction', label: 'Tipo de transacción' },
  { key: 'provincia',   label: 'Provincia' },
  { key: 'canton',      label: 'Cantón' },
  { key: 'distrito',    label: 'Distrito' },
  { key: 'address',     label: 'Dirección exacta' },
  { key: 'finca',       label: 'Número de finca' },
  { key: 'price',       label: 'Precio estimado' },
  { key: 'area',        label: 'Área construida (m²)' },
  { key: 'lot',         label: 'Área del lote (m²)' },
  { key: 'bedrooms',    label: 'Habitaciones' },
  { key: 'bathrooms',   label: 'Baños' },
  { key: 'description', label: 'Descripción adicional' },
]

const DEFAULT_LISTAR_FIELDS = ['phone', 'type', 'provincia', 'address', 'finca', 'price', 'description']

export default function PageEditorPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [tenantId, setTenantId] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')
  const [allPages, setAllPages] = useState<PageConfig[]>([])
  const [page, setPage] = useState<PageConfig | null>(null)

  // Settings state
  const [contentHtml, setContentHtml] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [listarFields, setListarFields] = useState<string[]>(DEFAULT_LISTAR_FIELDS)
  const [listarIntro, setListarIntro] = useState('')
  const [submissionWhatsapp, setSubmissionWhatsapp] = useState('')
  const [reclutamientoPositions, setReclutamientoPositions] = useState<string[]>([])
  const [reclutamientoIntro, setReclutamientoIntro] = useState('')
  const [newPosition, setNewPosition] = useState('')
  const [notificationEmails, setNotificationEmails] = useState('')
  const [reclutamientoTemplate, setReclutamientoTemplate] = useState<'default' | 'sunrise'>('default')
  const [listarTemplate, setListarTemplate] = useState<'default' | 'sunrise'>('default')
  const [nosotrosTemplate, setNosotrosTemplate] = useState<'default' | 'sunrise'>('default')
  const [contactoTemplate, setContactoTemplate] = useState<'default' | 'sunrise'>('default')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: adminRec } = await supabase
        .from('tenant_admins').select('tenant_id').eq('user_id', user.id).single()
      if (!adminRec) return
      setTenantId(adminRec.tenant_id)

      const { data: tenantRow } = await supabase
        .from('tenants').select('slug').eq('id', adminRec.tenant_id).single()
      setTenantSlug(tenantRow?.slug ?? '')

      const { data: cfg } = await supabase
        .from('tenant_config')
        .select('pages_config')
        .eq('tenant_id', adminRec.tenant_id).single()

      const pages: PageConfig[] = (cfg?.pages_config as PageConfig[] | null) ?? []
      setAllPages(pages)

      // Find this page's config
      const pageCfg = pages.find(p => p.slug === slug)
      setPage(pageCfg ?? { slug, title: slug, visible: true, order: 99, custom: !PREDEFINED_SLUGS.includes(slug) })

      // Populate settings from config
      const s = pageCfg?.settings ?? {}
      setContentHtml(s.content_html ?? '')
      setSeoDescription(s.seo_description ?? '')
      setListarFields(s.listar_fields ?? DEFAULT_LISTAR_FIELDS)
      setListarIntro(s.listar_intro ?? '')
      setSubmissionWhatsapp(s.submission_whatsapp ?? '')
      setReclutamientoPositions(s.reclutamiento_positions ?? [])
      setReclutamientoIntro(s.reclutamiento_intro ?? '')
      setNotificationEmails(s.notification_emails ?? '')
      setReclutamientoTemplate(s.reclutamiento_template ?? 'default')
      setListarTemplate(s.listar_template ?? 'default')
      setNosotrosTemplate(s.nosotros_template ?? 'default')
      setContactoTemplate(s.contacto_template ?? 'default')

      setLoading(false)
    })
  }, [slug])

  function toggleListarField(key: string) {
    setListarFields(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  function addPosition() {
    const val = newPosition.trim()
    if (!val || reclutamientoPositions.includes(val)) return
    setReclutamientoPositions(prev => [...prev, val])
    setNewPosition('')
  }

  function removePosition(pos: string) {
    setReclutamientoPositions(prev => prev.filter(p => p !== pos))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const settings: PageSettings = {}
    if (slug !== 'contacto') {
      if (seoDescription.trim()) settings.seo_description = seoDescription.trim()
    }
    if (slug === 'contacto') {
      settings.contacto_template = contactoTemplate
    }
    if (slug === 'nosotros' || page?.custom) {
      settings.nosotros_template = nosotrosTemplate
      settings.content_html = contentHtml
    }
    if (slug === 'listar') {
      settings.listar_template = listarTemplate
      settings.listar_fields = listarFields
      settings.listar_intro = listarIntro
      if (submissionWhatsapp.trim()) settings.submission_whatsapp = submissionWhatsapp.trim()
    }
    if (slug === 'reclutamiento') {
      settings.reclutamiento_template = reclutamientoTemplate
      settings.reclutamiento_positions = reclutamientoPositions
      settings.reclutamiento_intro = reclutamientoIntro
      if (submissionWhatsapp.trim()) settings.submission_whatsapp = submissionWhatsapp.trim()
      if (notificationEmails.trim()) settings.notification_emails = notificationEmails.trim()
    }

    // Update pages_config array preserving all other pages
    const updatedPages: PageConfig[] = allPages.map(p =>
      p.slug === slug ? { ...p, settings } : p
    )
    // If page wasn't in the array yet (new custom page not yet saved), add it
    if (!allPages.find(p => p.slug === slug) && page) {
      updatedPages.push({ ...page, settings })
    }

    const supabase = createClient()
    await supabase.from('tenant_config').upsert({
      tenant_id: tenantId,
      pages_config: updatedPages,
    }, { onConflict: 'tenant_id' })

    setSaving(false)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 3000)
  }

  if (loading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>
  if (!page) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Página no encontrada.</div>

  const pageTitle = page.title || slug

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <button onClick={() => router.push('/admin/paginas')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 13, padding: 0, fontFamily: 'inherit', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          ← Páginas
        </button>
        <PageHeader title={pageTitle} subtitle={`/${slug}`} style={{ marginBottom: 0 }} />
      </div>

      <form onSubmit={save}>
        {/* ── CONTACTO ── */}
        {slug === 'contacto' && (
          <>
            {tenantSlug === 'sunrise' && (
              <Section title="Diseño de la página">
                <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 14 }}>
                  Seleccioná el diseño que se usará para esta página.
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  {([
                    { value: 'default', label: 'Estándar', desc: 'Diseño simple con formulario y datos de contacto.' },
                    { value: 'sunrise', label: 'Sunrise', desc: 'Landing page con hero, tarjetas de contacto y formulario destacado.' },
                  ] as const).map(opt => (
                    <label key={opt.value} style={{
                      flex: 1, border: `2px solid ${contactoTemplate === opt.value ? '#111' : '#e0e0e0'}`,
                      borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
                      background: contactoTemplate === opt.value ? '#f5f5f7' : '#fff',
                      transition: 'border-color .15s',
                    }}>
                      <input type="radio" name="contacto_template" value={opt.value}
                        checked={contactoTemplate === opt.value}
                        onChange={() => setContactoTemplate(opt.value)}
                        style={{ display: 'none' }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 4 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{opt.desc}</div>
                    </label>
                  ))}
                </div>
              </Section>
            )}
            <Section title="Información de contacto">
              <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
                Los datos (WhatsApp, email, dirección, redes) se configuran en <a href="/admin/general" style={{ color: 'var(--primary,#6b2fa0)' }}>General</a> y se muestran automáticamente en esta página.
              </p>
            </Section>
          </>
        )}

        {/* ── AGENTES ── */}
        {slug === 'agentes' && (
          <Section title="Equipo de agentes">
            <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
              Esta página muestra automáticamente los agentes activos configurados en{' '}
              <a href="/admin/agentes" style={{ color: 'var(--primary,#6b2fa0)' }}>Agentes</a>.
              Activá o desactivá agentes desde ahí para controlar quiénes aparecen.
            </p>
          </Section>
        )}

        {/* ── NOSOTROS ── */}
        {slug === 'nosotros' && (
          <>
            {tenantSlug === 'sunrise' && (
              <Section title="Diseño de la página">
                <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 14 }}>
                  Seleccioná el diseño que se usará para esta página.
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  {([
                    { value: 'default', label: 'Estándar', desc: 'Muestra el contenido HTML personalizable.' },
                    { value: 'sunrise', label: 'Sunrise', desc: 'Landing page con hero, misión, visión y pilares.' },
                  ] as const).map(opt => (
                    <label key={opt.value} style={{
                      flex: 1, border: `2px solid ${nosotrosTemplate === opt.value ? '#111' : '#e0e0e0'}`,
                      borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
                      background: nosotrosTemplate === opt.value ? '#f5f5f7' : '#fff',
                      transition: 'border-color .15s',
                    }}>
                      <input type="radio" name="nosotros_template" value={opt.value}
                        checked={nosotrosTemplate === opt.value}
                        onChange={() => setNosotrosTemplate(opt.value)}
                        style={{ display: 'none' }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 4 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{opt.desc}</div>
                    </label>
                  ))}
                </div>
              </Section>
            )}
            {nosotrosTemplate !== 'sunrise' && (
              <Section title="Contenido de la página">
                <HtmlEditor value={contentHtml} onChange={setContentHtml} />
              </Section>
            )}
          </>
        )}

        {/* ── LISTAR ── */}
        {slug === 'listar' && (
          <>
            {tenantSlug === 'sunrise' && (
              <Section title="Diseño de la página">
                <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 14 }}>
                  Seleccioná el diseño que se usará para esta página.
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  {([
                    { value: 'default', label: 'Estándar', desc: 'Formulario simple configurable con los campos seleccionados.' },
                    { value: 'sunrise', label: 'Sunrise', desc: 'Landing page completa con hero, beneficios, proceso y formulario avanzado.' },
                  ] as const).map(opt => (
                    <label key={opt.value} style={{
                      flex: 1, border: `2px solid ${listarTemplate === opt.value ? '#111' : '#e0e0e0'}`,
                      borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
                      background: listarTemplate === opt.value ? '#f5f5f7' : '#fff',
                      transition: 'border-color .15s',
                    }}>
                      <input
                        type="radio"
                        name="listar_template"
                        value={opt.value}
                        checked={listarTemplate === opt.value}
                        onChange={() => setListarTemplate(opt.value)}
                        style={{ display: 'none' }}
                      />
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 4 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{opt.desc}</div>
                    </label>
                  ))}
                </div>
              </Section>
            )}

            <Section title="Texto introductorio">
              <Inp label="Párrafo de introducción" value={listarIntro} onChange={setListarIntro}
                placeholder="Completá el formulario y un agente se comunicará con vos." />
            </Section>

            <Section title="Campos del formulario">
              <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 16 }}>
                Nombre y email son siempre obligatorios. Activá los campos opcionales que querés mostrar.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {LISTAR_FIELD_OPTIONS.map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: '#333' }}>
                    <input
                      type="checkbox"
                      checked={listarFields.includes(key)}
                      onChange={() => toggleListarField(key)}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary,#6b2fa0)' }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </Section>

            <Section title="Envío">
              <Inp label="WhatsApp destino (opcional)" value={submissionWhatsapp} onChange={setSubmissionWhatsapp}
                placeholder="+506 8888-8888"
                hint="Si se define, el formulario abre WhatsApp al enviarse. Si no, se guarda solo como lead." />
            </Section>
          </>
        )}

        {/* ── RECLUTAMIENTO ── */}
        {slug === 'reclutamiento' && (
          <>
            {tenantSlug === 'sunrise' && <Section title="Diseño de la página">
              <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 14 }}>
                Seleccioná el diseño que se usará para esta página.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                {([
                  { value: 'default', label: 'Estándar', desc: 'Formulario simple con las posiciones configuradas.' },
                  { value: 'sunrise', label: 'Sunrise', desc: 'Landing page completa con hero, beneficios y formulario detallado.' },
                ] as const).map(opt => (
                  <label key={opt.value} style={{
                    flex: 1, border: `2px solid ${reclutamientoTemplate === opt.value ? '#111' : '#e0e0e0'}`,
                    borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
                    background: reclutamientoTemplate === opt.value ? '#f5f5f7' : '#fff',
                    transition: 'border-color .15s',
                  }}>
                    <input
                      type="radio"
                      name="reclutamiento_template"
                      value={opt.value}
                      checked={reclutamientoTemplate === opt.value}
                      onChange={() => setReclutamientoTemplate(opt.value)}
                      style={{ display: 'none' }}
                    />
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 4 }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{opt.desc}</div>
                  </label>
                ))}
              </div>
            </Section>}

            <Section title="Texto introductorio">
              <Inp label="Párrafo de introducción" value={reclutamientoIntro} onChange={setReclutamientoIntro}
                placeholder="Completá el formulario y nos pondremos en contacto." />
            </Section>

            <Section title="Posiciones disponibles">
              <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 14 }}>
                Agregá los puestos disponibles. El formulario mostrará un selector con estas opciones.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {reclutamientoPositions.map(pos => (
                  <div key={pos} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f7f7f7', borderRadius: 8, padding: '8px 12px' }}>
                    <span style={{ flex: 1, fontSize: 14, color: '#333' }}>{pos}</span>
                    <button type="button" onClick={() => removePosition(pos)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 16, lineHeight: 1, padding: 0 }}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={newPosition}
                  onChange={e => setNewPosition(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPosition() } }}
                  placeholder="Ej: Agente de ventas"
                  style={{ ...inputSt, flex: 1 }}
                />
                <button type="button" onClick={addPosition}
                  style={{ padding: '9px 16px', borderRadius: 8, background: 'var(--color-primary, #111)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  + Agregar
                </button>
              </div>
            </Section>

            <Section title="Notificaciones por email">
              <Inp
                label="Emails de notificación"
                value={notificationEmails}
                onChange={setNotificationEmails}
                placeholder="ana@oficina.com, juan@oficina.com"
                hint="Uno o más emails separados por coma. Recibirán un aviso por cada aplicación recibida."
              />
            </Section>
          </>
        )}

        {/* ── CUSTOM PAGE — HTML content ── */}
        {page?.custom && (
          <Section title="Contenido de la página">
            <HtmlEditor value={contentHtml} onChange={setContentHtml} />
          </Section>
        )}

        {/* ── SEO description — shown for all pages except contacto and agentes ── */}
        {slug !== 'contacto' && slug !== 'agentes' && (
          <Section title="SEO">
            <Inp
              label="Meta descripción (opcional)"
              value={seoDescription}
              onChange={setSeoDescription}
              placeholder="Descripción corta para Google (150–160 caracteres)."
              hint="Si se deja vacío, se usa la descripción por defecto de la página."
            />
          </Section>
        )}

        {/* Save bar */}
        {slug !== 'agentes' && (slug !== 'contacto' || tenantSlug === 'sunrise') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 4 }}>
            <button type="submit" disabled={saving}
              style={{ background: 'var(--color-primary, #111)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            {savedMsg && <span style={{ fontSize: 13, color: '#38a169' }}>✓ Guardado</span>}
          </div>
        )}
      </form>
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '22px 24px', marginBottom: 16, border: '1px solid #ebebeb' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.08em' }}>{title}</div>
      {children}
    </div>
  )
}

function Inp({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <div style={{ marginBottom: hint ? 0 : 0 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputSt} />
      {hint && <p style={{ fontSize: 12, color: '#aaa', margin: '6px 0 0' }}>{hint}</p>}
    </div>
  )
}

function HtmlEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>
        Contenido HTML
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={16}
        placeholder={'<h1>Título</h1>\n<p>Texto de la página…</p>'}
        style={{ ...inputSt, resize: 'vertical', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6 }}
        spellCheck={false}
      />
      <p style={{ fontSize: 12, color: '#aaa', margin: '6px 0 0' }}>
        Podés usar etiquetas HTML: &lt;h1&gt;, &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;img&gt;, etc.
      </p>
    </div>
  )
}

const inputSt: React.CSSProperties = {
  width: '100%', border: '1px solid #e0e0e0', borderRadius: 8,
  padding: '9px 12px', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff',
}
