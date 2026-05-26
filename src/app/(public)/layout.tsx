import { headers } from 'next/headers'
import { getTenantByDomain, DEFAULT_THEME } from '@/lib/tenant'
import Nav from '@/components/Nav/Nav'
import type { Tenant } from '@/types'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
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
    <div style={cssVars} className="flex flex-col min-h-screen">
      <Nav tenant={tenant} />
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
