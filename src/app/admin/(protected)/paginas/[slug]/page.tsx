'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import type { PageConfig, PageSettings, NosotrosContent, ContactoContent, ReclutamientoContent } from '@/types'
import PageHeader from '@/components/admin/PageHeader'
import NosotrosTemplate from '@/app/(public)/nosotros/NosotrosTemplate'
import { EditableProvider, escribirRuta } from '@/components/public/EdicionEnVivo'

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

type Plantilla = 'estandar' | 'html'

// La plantilla diseñada pasó a ser la estándar. En la base quedaron valores
// viejos —'sunrise' era la diseñada, 'default' la simple— y se normalizan acá
// en vez de migrar: el sitio ya los interpreta igual y la próxima vez que se
// guarde la página quedan escritos con el nombre nuevo.
function normalizar(v: string | undefined): Plantilla {
  return v === 'html' ? 'html' : 'estandar'
}

export default function PageEditorPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [tenantId, setTenantId] = useState('')
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
  // Contenido de las plantillas de autor. Vive por tenant en pages_config,
  // asi que cada oficina edita el suyo sin tocar el componente.
  const [nosotrosContent, setNosotrosContent] = useState<NosotrosContent>({})
  const [contactoContent, setContactoContent] = useState<ContactoContent>({})
  const [reclutamientoContent, setReclutamientoContent] = useState<ReclutamientoContent>({})
  const [notificationEmails, setNotificationEmails] = useState('')
  const [reclutamientoTemplate, setReclutamientoTemplate] = useState<Plantilla>('estandar')
  const [listarTemplate, setListarTemplate] = useState<Plantilla>('estandar')
  const [nosotrosTemplate, setNosotrosTemplate] = useState<Plantilla>('estandar')
  const [contactoTemplate, setContactoTemplate] = useState<Plantilla>('estandar')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: adminRec } = await supabase
        .from('tenant_admins').select('tenant_id').eq('user_id', user.id).single()
      if (!adminRec) return
      setTenantId(adminRec.tenant_id)

      // Antes se leía el slug del tenant para mostrar el selector de diseño
      // solo a Sunrise. Las plantillas ya no traen contenido de nadie, así que
      // cualquier oficina puede elegirlas y cargar el suyo.

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
      setReclutamientoTemplate(normalizar(s.reclutamiento_template))
      setListarTemplate(normalizar(s.listar_template))
      setNosotrosTemplate(normalizar(s.nosotros_template))
      setContactoTemplate(normalizar(s.contacto_template))
      setNosotrosContent(s.nosotros_content ?? {})
      setContactoContent(s.contacto_content ?? {})
      setReclutamientoContent(s.reclutamiento_content ?? {})

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

  // Mezclan una rama del contenido sin pisar el resto.
  const setN = (patch: Partial<NosotrosContent>) => setNosotrosContent(c => ({ ...c, ...patch }))
  // La vista previa editable manda rutas con puntos ('hero.title'); se escriben
  // en el mismo estado que usan los controles de listas.
  const setNRuta = (ruta: string, valor: string) =>
    setNosotrosContent(c => escribirRuta(c as Record<string, unknown>, ruta, valor) as NosotrosContent)
  const setC = (patch: Partial<ContactoContent>) => setContactoContent(c => ({ ...c, ...patch }))
  const setR = (patch: Partial<ReclutamientoContent>) => setReclutamientoContent(c => ({ ...c, ...patch }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const settings: PageSettings = {}
    // El contenido se guarda aunque la plantilla no esté activa: si solo se
    // guardara con la plantilla diseñada activa, cambiar a "HTML simple" y guardar
    // borraría todo el texto cargado, sin aviso y sin forma de recuperarlo.
    const keep = (o: object) => Object.keys(o).length > 0
    if (slug !== 'contacto') {
      if (seoDescription.trim()) settings.seo_description = seoDescription.trim()
    }
    if (slug === 'contacto') {
      settings.contacto_template = contactoTemplate
      if (keep(contactoContent)) settings.contacto_content = contactoContent
    }
    if (slug === 'nosotros' || page?.custom) {
      settings.nosotros_template = nosotrosTemplate
      settings.content_html = contentHtml
      if (keep(nosotrosContent)) settings.nosotros_content = nosotrosContent
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
      if (keep(reclutamientoContent)) settings.reclutamiento_content = reclutamientoContent
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
            {(
              <Section title="Diseño de la página">
                <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 14 }}>
                  Seleccioná el diseño que se usará para esta página.
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  {([
                    { value: 'estandar', label: 'Estándar', desc: 'Landing con hero, tarjetas de contacto y formulario destacado.' },
                    { value: 'html', label: 'HTML simple', desc: 'Diseño mínimo con formulario y datos de contacto.' },
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
            {contactoTemplate === 'estandar' && (
              <Section title="Textos de la página">
                <Inp label="Título" value={contactoContent.hero?.title ?? ''}
                  onChange={v => setC({ hero: { ...contactoContent.hero, title: v } })}
                  placeholder="Hablemos." />
                <div style={{ height: 14 }} />
                <Inp label="Palabras destacadas" value={contactoContent.hero?.accent ?? ''}
                  onChange={v => setC({ hero: { ...contactoContent.hero, accent: v } })}
                  placeholder="Estamos aquí."
                  hint="Se muestran con el degradado de color, al final del título." />
                <div style={{ height: 14 }} />
                <Txt label="Texto de presentación" rows={3} value={contactoContent.hero?.text ?? ''}
                  onChange={v => setC({ hero: { ...contactoContent.hero, text: v } })} />
                <Inp label="Título del formulario" value={contactoContent.form?.title ?? ''}
                  onChange={v => setC({ form: { ...contactoContent.form, title: v } })} />
                <div style={{ height: 14 }} />
                <Txt label="Texto del formulario" rows={2} value={contactoContent.form?.text ?? ''}
                  onChange={v => setC({ form: { ...contactoContent.form, text: v } })} />
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
            {(
              <Section title="Diseño de la página">
                <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 14 }}>
                  Seleccioná el diseño que se usará para esta página.
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  {([
                    { value: 'estandar', label: 'Estándar', desc: 'Landing con hero, misión, visión y pilares.' },
                    { value: 'html', label: 'HTML simple', desc: 'Muestra el contenido HTML personalizable.' },
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
            {nosotrosTemplate === 'html' && (
              <Section title="Contenido de la página">
                <HtmlEditor value={contentHtml} onChange={setContentHtml} />
              </Section>
            )}
            {nosotrosTemplate === 'estandar' && (
              <>
                <Section title="Contenido de la página">
                  <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 14 }}>
                    Hacé clic sobre cualquier texto para editarlo. Se ve tal cual queda en el sitio.
                    Las cifras y los pilares —que son listas— se manejan abajo.
                  </p>
                  {/* La plantilla real, en modo edición. Escribe en el mismo estado
                      que las listas de abajo, así que guarda todo junto el botón
                      del pie. `--nav-h: 0` saca el hueco de la barra pública, que
                      acá no existe. */}
                  <div style={{ border: '1px solid #e0e0e0', borderRadius: 12, overflowX: 'auto', '--nav-h': '0px' } as React.CSSProperties}>
                    <EditableProvider editando onChange={setNRuta}>
                      <NosotrosTemplate content={nosotrosContent} />
                    </EditableProvider>
                  </div>
                </Section>

                <Section title="Cifras">
                  <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 14 }}>
                    Franja de números del encabezado. Si no cargás ninguna, no se muestra.
                  </p>
                  <ObjList label="Cifras" items={nosotrosContent.stats ?? []}
                    onChange={v => setN({ stats: v })}
                    fields={[{ key: 'num', label: 'Cifra (ej: +30)' }, { key: 'label', label: 'Descripción' }]}
                    blank={{ num: '', label: '' }} />
                </Section>

                <Section title="Párrafos de «Cómo trabajamos»">
                  <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 14 }}>
                    Agregá, quitá o reordená párrafos. El texto de cada uno se edita arriba, en la vista previa.
                  </p>
                  <StringList label="Párrafos" multiline items={nosotrosContent.work?.paragraphs ?? []}
                    onChange={v => setN({ work: { ...nosotrosContent.work, paragraphs: v } })} />
                </Section>

                <Section title="Pilares">
                  <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 14 }}>
                    Etiquetas con emoji del cierre de la página. Si no cargás ninguna, la sección no se muestra.
                  </p>
                  <ObjList label="Pilares" items={nosotrosContent.pillars?.items ?? []}
                    onChange={v => setN({ pillars: { ...nosotrosContent.pillars, items: v } })}
                    fields={[{ key: 'icon', label: 'Emoji' }, { key: 'label', label: 'Nombre' }]}
                    blank={{ icon: '', label: '' }} />
                </Section>
              </>
            )}
          </>
        )}

        {/* ── LISTAR ── */}
        {slug === 'listar' && (
          <>
            {(
              <Section title="Diseño de la página">
                <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 14 }}>
                  Seleccioná el diseño que se usará para esta página.
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  {([
                    { value: 'estandar', label: 'Estándar', desc: 'Landing completa con hero, beneficios, proceso y formulario avanzado.' },
                    { value: 'html', label: 'HTML simple', desc: 'Formulario simple con los campos seleccionados.' },
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
            {<Section title="Diseño de la página">
              <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 14 }}>
                Seleccioná el diseño que se usará para esta página.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                {([
                  { value: 'estandar', label: 'Estándar', desc: 'Landing completa con hero, beneficios y formulario detallado.' },
                  { value: 'html', label: 'HTML simple', desc: 'Formulario simple con las posiciones configuradas.' },
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
            {reclutamientoTemplate === 'estandar' && (
              <>
                <Section title="Encabezado">
                  <Inp label="Título" value={reclutamientoContent.hero?.title ?? ''}
                    onChange={v => setR({ hero: { ...reclutamientoContent.hero, title: v } })}
                    placeholder="Tu carrera en" />
                  <div style={{ height: 14 }} />
                  <Inp label="Palabras destacadas" value={reclutamientoContent.hero?.accent ?? ''}
                    onChange={v => setR({ hero: { ...reclutamientoContent.hero, accent: v } })}
                    placeholder="bienes raíces"
                    hint="Se muestran con el degradado de color, en medio del título." />
                  <div style={{ height: 14 }} />
                  <Inp label="Cierre del título" value={reclutamientoContent.hero?.tail ?? ''}
                    onChange={v => setR({ hero: { ...reclutamientoContent.hero, tail: v } })}
                    placeholder="empieza aquí."
                    hint="Va en la línea de abajo, después de las palabras destacadas." />
                  <div style={{ height: 14 }} />
                  <Txt label="Texto de presentación" rows={3} value={reclutamientoContent.hero?.text ?? ''}
                    onChange={v => setR({ hero: { ...reclutamientoContent.hero, text: v } })} />
                </Section>

                <Section title="Beneficios">
                  <Inp label="Antetítulo" value={reclutamientoContent.benefits?.eyebrow ?? ''}
                    onChange={v => setR({ benefits: { ...reclutamientoContent.benefits, eyebrow: v } })}
                    placeholder="Por qué nosotros" />
                  <div style={{ height: 14 }} />
                  <Inp label="Título" value={reclutamientoContent.benefits?.title ?? ''}
                    onChange={v => setR({ benefits: { ...reclutamientoContent.benefits, title: v } })} />
                  <div style={{ height: 14 }} />
                  <ObjList label="Beneficios" items={reclutamientoContent.benefits?.items ?? []}
                    onChange={v => setR({ benefits: { ...reclutamientoContent.benefits, items: v } })}
                    fields={[
                      { key: 'icon',  label: 'Emoji' },
                      { key: 'title', label: 'Título' },
                      { key: 'desc',  label: 'Descripción', wide: true },
                      { key: 'id',    label: 'Identificador interno (sin espacios)' },
                    ]}
                    blank={{ id: '', icon: '', title: '', desc: '' }} />
                </Section>

                <Section title="Zonas del formulario">
                  <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 14 }}>
                    Las zonas que puede elegir quien aplica. Se agrupan por título — por ejemplo una zona principal y otra con el resto.
                    El campo es obligatorio: si no cargás ninguna, se muestran las provincias.
                  </p>
                  {(reclutamientoContent.zones?.groups ?? []).map((g, gi) => {
                    const groups = reclutamientoContent.zones?.groups ?? []
                    const upd = (ng: typeof groups) => setR({ zones: { groups: ng } })
                    return (
                      <div key={gi} style={{ border: '1px solid #ebebeb', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginBottom: 10 }}>
                          <div style={{ flex: 1 }}>
                            <Inp label={`Grupo ${gi + 1}`} value={g.label}
                              onChange={v => upd(groups.map((x, j) => j === gi ? { ...x, label: v } : x))}
                              placeholder="Ej: Este de San José (zona principal)" />
                          </div>
                          <button type="button" onClick={() => upd(groups.filter((_, j) => j !== gi))} style={rmBtn} title="Quitar grupo">×</button>
                        </div>
                        <StringList label="Zonas" items={g.items ?? []}
                          onChange={v => upd(groups.map((x, j) => j === gi ? { ...x, items: v } : x))}
                          placeholder="Nombre de la zona" />
                      </div>
                    )
                  })}
                  <button type="button" style={addBtn}
                    onClick={() => setR({ zones: { groups: [...(reclutamientoContent.zones?.groups ?? []), { label: '', items: [] }] } })}>
                    + Agregar grupo
                  </button>
                </Section>

                <Section title="Mensaje de confirmación">
                  <Inp label="Título" value={reclutamientoContent.success?.title ?? ''}
                    onChange={v => setR({ success: { ...reclutamientoContent.success, title: v } })}
                    placeholder="¡Aplicación recibida!" />
                  <div style={{ height: 14 }} />
                  <Txt label="Texto" rows={2} value={reclutamientoContent.success?.text ?? ''}
                    onChange={v => setR({ success: { ...reclutamientoContent.success, text: v } })}
                    hint="Se muestra después de enviar el formulario." />
                </Section>
              </>
            )}
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
        {slug !== 'agentes' && (
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

/** Textarea con el mismo estilo que Inp. */
function Txt({ label, value, onChange, rows = 3, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        style={{ ...inputSt, resize: 'vertical', lineHeight: 1.6 }} />
      {hint && <p style={{ fontSize: 12, color: '#aaa', margin: '6px 0 0' }}>{hint}</p>}
    </div>
  )
}

/** Lista editable de textos sueltos (parrafos, zonas). */
function StringList({ label, items, onChange, placeholder, multiline }: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder?: string; multiline?: boolean }) {
  const set = (i: number, v: string) => onChange(items.map((x, j) => j === i ? v : x))
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>{label}</label>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'flex-start' }}>
          {multiline
            ? <textarea value={it} onChange={e => set(i, e.target.value)} rows={3} placeholder={placeholder} style={{ ...inputSt, resize: 'vertical', lineHeight: 1.6 }} />
            : <input value={it} onChange={e => set(i, e.target.value)} placeholder={placeholder} style={inputSt} />}
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} style={rmBtn} title="Quitar">×</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ''])} style={addBtn}>+ Agregar</button>
    </div>
  )
}

/** Lista editable de objetos, con los campos que se le indiquen. */
function ObjList<T extends Record<string, string>>({ label, items, onChange, fields, blank }: { label: string; items: T[]; onChange: (v: T[]) => void; fields: { key: keyof T & string; label: string; wide?: boolean }[]; blank: T }) {
  const set = (i: number, k: string, v: string) => onChange(items.map((x, j) => j === i ? { ...x, [k]: v } : x))
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>{label}</label>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, display: 'grid', gap: 6 }}>
            {fields.map(f => f.wide
              ? <textarea key={f.key} value={it[f.key] ?? ''} onChange={e => set(i, f.key, e.target.value)} rows={2} placeholder={f.label} style={{ ...inputSt, resize: 'vertical', lineHeight: 1.6 }} />
              : <input key={f.key} value={it[f.key] ?? ''} onChange={e => set(i, f.key, e.target.value)} placeholder={f.label} style={inputSt} />)}
          </div>
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} style={rmBtn} title="Quitar">×</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { ...blank }])} style={addBtn}>+ Agregar</button>
    </div>
  )
}

const rmBtn: React.CSSProperties = {
  width: 30, height: 34, flexShrink: 0, borderRadius: 8, border: '1px solid #fee2e2',
  background: '#fff', color: '#e53e3e', cursor: 'pointer', fontSize: 16, lineHeight: 1,
}
const addBtn: React.CSSProperties = {
  border: '1.5px dashed #d0d0d0', background: 'transparent', color: '#888',
  borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
}


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
