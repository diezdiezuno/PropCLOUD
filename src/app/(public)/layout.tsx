import { headers } from 'next/headers'
import { getTenantByDomain, getTenantConfig, DEFAULT_THEME } from '@/lib/tenant'
import Nav from '@/components/Nav/Nav'
import Footer from '@/components/Footer/Footer'
import { FilterProvider } from '@/contexts/FilterContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import type { Metadata } from 'next'
import type { Lang } from '@/contexts/LanguageContext'
import type { Tenant, TenantConfig } from '@/types'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const domain = headersList.get('x-tenant-domain') ?? 'localhost'
  try {
    const tenant = await getTenantByDomain(domain)
    if (tenant?.name) return {
      title: { default: tenant.name, template: `%s · ${tenant.name}` },
      icons: tenant.favicon_url ? { icon: tenant.favicon_url } : undefined,
    }
  } catch {}
  return { title: 'PropCLOUD' }
}

function googleFontsUrl(heading: string, body: string): string {
  const encode = (f: string) => encodeURIComponent(f).replace(/%20/g, '+')
  return `https://fonts.googleapis.com/css2?family=${encode(heading)}:wght@400;600;700&family=${encode(body)}:wght@300;400;500;600&display=swap`
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const domain = headersList.get('x-tenant-domain') ?? 'localhost'

  let tenant: Tenant | null = null
  let config: TenantConfig | null = null
  try {
    tenant = await getTenantByDomain(domain)
    if (tenant) config = await getTenantConfig(tenant.id)
  } catch {}

  // No tenant → wrap with FilterProvider so client pages don't crash,
  // but skip Nav/Footer (LandingPage has its own layout)
  if (!tenant) {
    return <LanguageProvider><FilterProvider>{children}</FilterProvider></LanguageProvider>
  }

  const theme = tenant.theme ?? DEFAULT_THEME
  const cssVars = {
    '--primary': theme.primaryColor,
    '--accent': theme.accentColor,
    '--font-heading': `'${theme.fontHeading}', serif`,
    '--font-body': `'${theme.fontBody}', sans-serif`,
  } as React.CSSProperties

  const fontsUrl = googleFontsUrl(theme.fontHeading, theme.fontBody)
  const gaId = (config as TenantConfig & { ga_id?: string | null })?.ga_id ?? null

  return (
    <div style={{ ...cssVars, fontFamily: 'var(--font-body)' }} className="flex flex-col min-h-screen">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href={fontsUrl} rel="stylesheet" />
      {gaId && (
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
          <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${gaId}');` }} />
        </>
      )}
      <LanguageProvider defaultLang={(config?.default_language ?? 'es') as Lang}>
        <FilterProvider>
          <Nav tenant={tenant} zones={config?.zone_config ?? null} pagesConfig={config?.pages_config ?? null} />
          <main>{children}</main>
          <Footer config={config} tenant={tenant} />
        </FilterProvider>
      </LanguageProvider>
    </div>
  )
}
