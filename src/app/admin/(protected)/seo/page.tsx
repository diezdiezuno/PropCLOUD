'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import PageHeader from '@/components/admin/PageHeader'

export default function SeoAdminPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [tenantId, setTenantId] = useState('')
  const [siteUrl, setSiteUrl] = useState('')


  // SEO settings
  const [ogImage, setOgImage] = useState('')
  const [googleScVerification, setGoogleScVerification] = useState('')
  const [gaId, setGaId] = useState('')

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
        .select('og_image, google_sc_verification, ga_id')
        .eq('tenant_id', adminRec.tenant_id)
        .single()

      if (cfg) {
        setOgImage((cfg as Record<string, string | null>).og_image ?? '')
        setGoogleScVerification((cfg as Record<string, string | null>).google_sc_verification ?? '')
        setGaId((cfg as Record<string, string | null>).ga_id ?? '')
      }
      // Derive public site URL from current window location
      if (typeof window !== 'undefined') {
        setSiteUrl(window.location.origin)
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
      og_image: ogImage.trim() || null,
      google_sc_verification: googleScVerification.trim() || null,
      ga_id: gaId.trim() || null,
    }, { onConflict: 'tenant_id' })
    setSaving(false)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 3000)
  }

  if (loading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>

  const robotsUrl = siteUrl ? `${siteUrl}/robots.txt` : '/robots.txt'
  const sitemapUrl = siteUrl ? `${siteUrl}/sitemap.xml` : '/sitemap.xml'
  const richResultsUrl = siteUrl
    ? `https://search.google.com/test/rich-results?url=${encodeURIComponent(siteUrl)}`
    : 'https://search.google.com/test/rich-results'

  return (
    <div>
      {/* Header */}
      <PageHeader title={<>SEO</>} subtitle={<>Configuración de visibilidad en buscadores y redes sociales.</>} />

      <form onSubmit={save}>

        {/* ── Compartir en redes sociales ── */}
        <Section title="Compartir en redes sociales">
          <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 16 }}>
            Cuando alguien comparte una URL de tu sitio en WhatsApp, Facebook o Twitter, se muestra esta imagen de previsualización. Se recomienda una imagen de 1200 × 630 px.
          </p>
          <Inp
            label="URL de imagen social (og:image)"
            value={ogImage}
            onChange={setOgImage}
            placeholder="https://tusitio.com/og-image.jpg"
            hint="Si se deja vacío, se usa el logo del sitio."
          />
        </Section>

        {/* ── Google Analytics ── */}
        <Section title="Google Analytics">
          <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 16 }}>
            El código de seguimiento de GA4 se inyecta automáticamente en todas las páginas. También podés configurarlo en{' '}
            <a href="/admin/general" style={{ color: 'var(--primary,#6b2fa0)' }}>General → Analíticas</a>.
          </p>
          <Inp
            label="Measurement ID"
            value={gaId}
            onChange={setGaId}
            placeholder="G-XXXXXXXXXX"
            hint="Encontralo en Google Analytics → Admin → Data Streams → Web."
          />
          {gaId && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38a169', display: 'inline-block' }} />
              <span style={{ fontSize: 12, color: '#38a169' }}>GA configurado ({gaId})</span>
            </div>
          )}
          {!gaId && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e53e3e', display: 'inline-block' }} />
              <span style={{ fontSize: 12, color: '#e53e3e' }}>GA no configurado — el tráfico no se está midiendo</span>
            </div>
          )}
        </Section>

        {/* ── Google Search Console ── */}
        <Section title="Google Search Console">
          <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 16 }}>
            Para verificar la propiedad en Search Console con el método de meta tag, pegá el valor del atributo <code style={{ background: '#f5f5f5', padding: '1px 4px', borderRadius: 4, fontSize: 12 }}>content</code> del tag de verificación aquí.
          </p>
          <Inp
            label="Código de verificación de Google (meta tag)"
            value={googleScVerification}
            onChange={setGoogleScVerification}
            placeholder="abc123xyz..."
            hint='Solo pegá el valor del atributo content, no el tag completo. Ej: "nR3x4ZTp..."'
          />
          <div style={{ marginTop: 16 }}>
            <a
              href="https://search.google.com/search-console"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: 'var(--primary,#6b2fa0)', textDecoration: 'none' }}
            >
              Abrir Google Search Console →
            </a>
          </div>
        </Section>

        {/* Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 4 }}>
          <button type="submit" disabled={saving}
            style={{ background: 'var(--color-primary, #111)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {savedMsg && <span style={{ fontSize: 13, color: '#38a169' }}>✓ Guardado</span>}
        </div>
      </form>

      {/* ── Estado técnico ── */}
      <div style={{ marginTop: 32 }}>
        <Section title="Estado técnico">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            <StatusRow
              label="Robots.txt"
              description="Indica a los buscadores qué páginas rastrear. Bloquea /admin/ y /api/ por defecto."
              link={robotsUrl}
              linkLabel="Ver robots.txt"
            />

            <StatusRow
              label="Sitemap XML"
              description="Lista de todas las URLs del sitio, enviada a Google para indexación. Incluye propiedades activas."
              link={sitemapUrl}
              linkLabel="Ver sitemap.xml"
            />

            <StatusRow
              label="JSON-LD (schema.org)"
              description="Las páginas de propiedades incluyen datos estructurados RealEstateListing para resultados enriquecidos en Google."
              link={richResultsUrl}
              linkLabel="Probar con Rich Results Test"
              external
            />

            <StatusRow
              label="Open Graph"
              description="Todas las páginas incluyen meta tags og:title, og:description e og:image para compartir en redes."
            />

            <StatusRow
              label="Meta descripciones"
              description="Cada página tiene su meta description. Podés personalizarlas en Páginas → [página] → SEO."
              link="/admin/paginas"
              linkLabel="Ir a Páginas"
            />

            <StatusRow
              label="Eventos de Analytics"
              description="Se rastrean: click en WhatsApp de propiedad, envío de formulario de contacto/listar/reclutamiento."
            />

          </div>
        </Section>
      </div>

      {/* ── Herramientas externas ── */}
      <div style={{ marginTop: 0 }}>
        <Section title="Herramientas externas">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {[
              { label: 'Google Search Console', url: 'https://search.google.com/search-console' },
              { label: 'Google Analytics', url: 'https://analytics.google.com' },
              { label: 'Rich Results Test', url: richResultsUrl },
              { label: 'PageSpeed Insights', url: siteUrl ? `https://pagespeed.web.dev/report?url=${encodeURIComponent(siteUrl)}` : 'https://pagespeed.web.dev' },
              { label: 'Open Graph Debugger', url: siteUrl ? `https://www.opengraph.xyz/url/${encodeURIComponent(siteUrl)}` : 'https://www.opengraph.xyz' },
            ].map(({ label, url }) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 13, color: '#555', border: '1px solid #e0e0e0',
                  borderRadius: 8, padding: '8px 14px', textDecoration: 'none',
                  background: '#fff', display: 'inline-block',
                }}
              >
                {label} ↗
              </a>
            ))}
          </div>
        </Section>
      </div>
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

function Inp({ label, value, onChange, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string
}) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputSt} />
      {hint && <p style={{ fontSize: 12, color: '#aaa', margin: '6px 0 0' }}>{hint}</p>}
    </div>
  )
}

function StatusRow({ label, description, link, linkLabel, external }: {
  label: string; description: string; link?: string; linkLabel?: string; external?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: 12, borderBottom: '1px solid #f5f5f5' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38a169', display: 'inline-block', marginTop: 5, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#222', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#888' }}>{description}</div>
        {link && linkLabel && (
          <a
            href={link}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            style={{ fontSize: 12, color: 'var(--primary,#6b2fa0)', textDecoration: 'none', display: 'inline-block', marginTop: 4 }}
          >
            {linkLabel} {external ? '↗' : '→'}
          </a>
        )}
      </div>
    </div>
  )
}

const inputSt: React.CSSProperties = {
  width: '100%', border: '1px solid #e0e0e0', borderRadius: 8,
  padding: '9px 12px', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff',
}
