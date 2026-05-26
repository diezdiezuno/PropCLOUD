import { headers } from 'next/headers'
import { getTenantByDomain, getTenantConfig, DEFAULT_THEME } from '@/lib/tenant'
import Nav from '@/components/Nav/Nav'
import Footer from '@/components/Footer/Footer'
import type { Tenant, TenantConfig } from '@/types'

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

  const theme = tenant?.theme ?? DEFAULT_THEME

  const cssVars = {
    '--primary': theme.primaryColor,
    '--accent': theme.accentColor,
    '--font-heading': `'${theme.fontHeading}', serif`,
    '--font-body': `'${theme.fontBody}', sans-serif`,
  } as React.CSSProperties

  const fontsUrl = googleFontsUrl(theme.fontHeading, theme.fontBody)

  return (
    <div style={{ ...cssVars, fontFamily: 'var(--font-body)' }} className="flex flex-col min-h-screen">
      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href={fontsUrl} rel="stylesheet" />

      <Nav tenant={tenant} />
      <main className="flex-1">
        {children}
      </main>
      <Footer config={config} tenant={tenant} />
    </div>
  )
}
