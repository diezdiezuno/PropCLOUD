import { headers } from 'next/headers'
import { getTenantByDomain, getTenantConfig } from '@/lib/tenant'
import NosotrosTemplate from './NosotrosTemplate'
import { EdicionProvider } from '@/components/public/EdicionEnVivo'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const domain = h.get('x-tenant-domain') ?? 'localhost'
  const tenant = await getTenantByDomain(domain).catch(() => null)
  const config = tenant ? await getTenantConfig(tenant.id).catch(() => null) : null
  const pageCfg = config?.pages_config?.find(p => p.slug === 'nosotros')
  const description = pageCfg?.settings?.seo_description ?? 'Conocé nuestra historia, misión y el equipo detrás de nuestra inmobiliaria.'
  return { title: 'Nosotros', description, alternates: { canonical: '/nosotros' } }
}

export default async function NosotrosPage() {
  const h = await headers()
  const domain = h.get('x-tenant-domain') ?? 'localhost'
  const tenant = await getTenantByDomain(domain).catch(() => null)
  const config = tenant ? await getTenantConfig(tenant.id).catch(() => null) : null

  const pageCfg = config?.pages_config?.find(p => p.slug === 'nosotros')
  const settings = pageCfg?.settings ?? {}
  const html = settings?.content_html ?? config?.about_html ?? ''

  // La plantilla diseñada es la estándar: se usa salvo que la oficina pida
  // explícitamente el HTML plano. Los valores viejos ('sunrise', 'default')
  // caen acá también, así que no hizo falta migrar nada.
  if (settings.nosotros_template !== 'html') {
    const plantilla = <NosotrosTemplate content={settings.nosotros_content} />
    // Sin tenant no hay dónde guardar: se sirve la página tal cual.
    return tenant
      ? <EdicionProvider tenantId={tenant.id} slug="nosotros" campo="nosotros_content"
          inicial={settings.nosotros_content as Record<string, unknown> | undefined}>
          {plantilla}
        </EdicionProvider>
      : plantilla
  }

  // Only 404 if the page is explicitly hidden — don't 404 just for missing content
  // (Google may have indexed this URL; returning 404 sends a bad signal)
  if (pageCfg && pageCfg.visible === false) notFound()

  return (
    <div style={{ paddingTop: 'var(--nav-h,68px)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '60px 24px 80px' }}>
        <div
          className="prose-content"
          dangerouslySetInnerHTML={{ __html: html }}
          style={{ fontSize: 16, lineHeight: 1.8, color: '#333' }}
        />
      </div>
    </div>
  )
}
