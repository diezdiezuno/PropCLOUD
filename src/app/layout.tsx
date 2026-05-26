import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'
import { getTenantByDomain, DEFAULT_THEME } from '@/lib/tenant'
import Nav from '@/components/Nav/Nav'
import type { Tenant } from '@/types'

export const metadata: Metadata = {
  title: 'PropCLOUD',
  description: 'Plataforma inmobiliaria',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const domain = headersList.get('x-tenant-domain') ?? 'localhost'

  let tenant: Tenant | null = null
  try {
    tenant = await getTenantByDomain(domain)
  } catch {}

  const theme = tenant?.theme ?? DEFAULT_THEME

  const cssVars = {
    '--primary': theme.primaryColor,
    '--accent': theme.accentColor,
  } as React.CSSProperties

  return (
    <html lang="es" className="h-full">
      <head>
        <link href="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col" style={cssVars}>
        <Nav tenant={tenant} />
        <main className="flex-1">
          {children}
        </main>
      </body>
    </html>
  )
}
