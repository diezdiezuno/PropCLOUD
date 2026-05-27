'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import type { PageConfig, PageSettings } from '@/types'

const PREDEFINED_SLUGS = ['nosotros', 'contacto', 'listar', 'reclutamiento']

const LISTAR_FIELD_OPTIONS = [
  { key: 'phone',       label: 'Teléfono' },
  { key: 'type',        label: 'Tipo de propiedad' },
  { key: 'transaction', label: 'Tipo de transacción' },
  { key: 'price',       label: 'Precio estimado' },
  { key: 'area',        label: 'Área (m²)' },
  { key: 'lot',         label: 'Lote (m²)' },
  { key: 'address',     label: 'Dirección o zona' },
  { key: 'bedrooms',    label: 'Habitaciones' },
  { key: 'bathrooms',   label: 'Baños' },
  { key: 'description', label: 'Descripción' },
]

const DEFAULT_LISTAR_FIELDS = ['phone', 'type', 'address', 'price', 'description']

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
  const [listarFields, setListarFields] = useState<string[]>(DEFAULT_LISTAR_FIELDS)
  const [listarIntro, setListarIntro] = useState('')
  const [submissionWhatsapp, setSubmissionWhatsapp] = useState('')
  const [reclutamientoPositions, setReclutamientoPositions] = useState<string[]>([])
  const [reclutamientoIntro, setReclutamientoIntro] = useState('')
  const [newPosition, setNewPosition] = useState('')

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
      setListarFields(s.listar_fields ?? DEFAULT_LISTAR_FIELDS)
      setListarIntro(s.listar_intro ?? '')
      setSubmissionWhatsapp(s.submission_whatsapp ?? '')
      setReclutamientoPositions(s.reclutamiento_positions ?? [])
      setReclutamientoIntro(s.reclutamiento_intro ?? '')

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
    if (slug === 'nosotros' || page?.custom) {
      settings.content_html = contentHtml
    }
    if (slug === 'listar') {
      settings.listar_fields = listarFields
      settings.listar_intro = listarIntro
      if (submissionWhatsapp.trim()) settings.submission_whatsapp = submissionWhatsapp.trim()
    }
    if (slug === 'reclutamiento') {
      settings.reclutamiento_positions = reclutamientoPositions
      settings.reclutamiento_intro = reclutamientoIntro
      if (submissionWhatsapp.trim()) settings.submission_whatsapp = submissionWhatsapp.trim()
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
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>{pageTitle}</h1>
        <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>/{slug}</p>
      </div>

      <form onSubmit={save}>
        {/* ── CONTACTO — info only, no editable settings ── */}
        {slug === 'contacto' && (
          <Section title="Información de contacto">
            <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
              Esta página muestra automáticamente los datos de contacto configurados en <a href="/admin/general" style={{ color: 'var(--primary,#6b2fa0)' }}>General</a>: WhatsApp, email, dirección y redes sociales.
              No hay contenido adicional que editar aquí.
            </p>
          </Section>
        )}

        {/* ── NOSOTROS — HTML content ── */}
        {slug === 'nosotros' && (
          <Section title="Contenido de la página">
            <HtmlEditor value={contentHtml} onChange={setContentHtml} />
          </Section>
        )}

        {/* ── LISTAR ── */}
        {slug === 'listar' && (
          <>
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
                  style={{ padding: '9px 16px', borderRadius: 8, background: '#111', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  + Agregar
                </button>
              </div>
            </Section>

            <Section title="Envío">
              <Inp label="WhatsApp destino (opcional)" value={submissionWhatsapp} onChange={setSubmissionWhatsapp}
                placeholder="+506 8888-8888"
                hint="Si se define, el formulario abre WhatsApp al enviarse. Si no, se guarda solo como lead." />
            </Section>
          </>
        )}

        {/* ── CUSTOM PAGE — HTML content ── */}
        {page?.custom && (
          <Section title="Contenido de la página">
            <HtmlEditor value={contentHtml} onChange={setContentHtml} />
          </Section>
        )}

        {/* Save bar — not shown for contacto */}
        {slug !== 'contacto' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 4 }}>
            <button type="submit" disabled={saving}
              style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>
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
