import { headers } from 'next/headers'
import { getTenantByDomain, getTenantConfig } from '@/lib/tenant'
import ListarClient from './ListarClient'
import type { Metadata } from 'next'
import type { PageSettings } from '@/types'

export const metadata: Metadata = { title: 'Listá tu propiedad' }

const DEFAULT_FIELDS = ['phone', 'type', 'address', 'price', 'description']

export default async function ListarPage() {
  const h = await headers()
  const domain = h.get('x-tenant-domain') ?? 'localhost'
  const tenant = await getTenantByDomain(domain).catch(() => null)
  const config = tenant ? await getTenantConfig(tenant.id).catch(() => null) : null

  const pageCfg = config?.pages_config?.find(p => p.slug === 'listar')
  const settings: PageSettings = pageCfg?.settings ?? {}

  return (
    <ListarClient
      fields={settings.listar_fields ?? DEFAULT_FIELDS}
      intro={settings.listar_intro ?? ''}
      submissionWhatsapp={settings.submission_whatsapp ?? config?.whatsapp ?? null}
    />
  )
}
