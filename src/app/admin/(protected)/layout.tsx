import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getTenantByDomain } from '@/lib/tenant'
import AdminShell from './AdminShell'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { title: 'Noduus Admin' }
  // El título sigue al mismo tenant que muestra el layout: el del dominio.
  const host = (await headers()).get('x-tenant-domain') ?? ''
  const domainTenant = host && !host.includes('localhost')
    ? await getTenantByDomain(host)
    : null
  let tenantName = domainTenant?.name
  if (!tenantName) {
    const { data: adminRecord } = await supabase
      .from('tenant_admins')
      .select('tenants(name)')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tenantName = (adminRecord as any)?.tenants?.name
  }
  return {
    title: tenantName ? `Noduus Admin — ${tenantName}` : 'Noduus Admin',
    robots: { index: false, follow: false, noarchive: true, nosnippet: true },
  }
}

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()

  // Verify token with Supabase server (more secure than getSession)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  // El tenant lo manda el dominio, no la cuenta: en forsale-re.com se entra a
  // REMAX Central y en sunrisecr.com a Sunrise. Sin esto, la pertenencia sola
  // decide, así que la misma cuenta mostraba su tenant en cualquier dominio; y
  // un usuario con dos membresías rompía el .single() y quedaba afuera de todos.
  const host = (await headers()).get('x-tenant-domain') ?? ''
  // En noduus.com no hay tenant, y en localhost getTenantByDomain devuelve el
  // primero de la tabla — ninguno de los dos sirve para decidir acceso.
  const domainTenant = host && !host.includes('localhost')
    ? await getTenantByDomain(host)
    : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tenant: any = null
  let role: 'admin' | 'agent' = 'admin'

  if (domainTenant) {
    // Acotado al tenant del dominio: pertenecer a otro no da acceso a este.
    const { data: adminRecord } = await supabase
      .from('tenant_admins').select('role')
      .eq('user_id', user.id).eq('tenant_id', domainTenant.id).maybeSingle()

    if (adminRecord) {
      tenant = domainTenant
    } else {
      const { data: agentRecord } = await supabase
        .from('users').select('role')
        .eq('auth_id', user.id).eq('tenant_id', domainTenant.id).maybeSingle()
      if (!agentRecord) redirect('/admin/login?error=wrong_tenant')
      tenant = domainTenant
      role = 'agent'
    }
  } else {
    // Dominio de plataforma o desarrollo local: se resuelve por pertenencia.
    // RLS "Admins read own" policy lets the authenticated user read their own record
    // "Public read tenants" policy lets the join work without service role
    const { data: adminRecord } = await supabase
      .from('tenant_admins')
      .select('tenant_id, role, tenants(id, name, slug, logo_url, theme, proptools_apps, crm_apps)')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tenant = (adminRecord as any)?.tenants

    // No es admin → ¿es agente (usuario Noduus)?
    if (!adminRecord) {
      const { data: agentRecord } = await supabase
        .from('users')
        .select('tenant_id, role, tenants(id, name, slug, logo_url, theme, proptools_apps, crm_apps)')
        .eq('auth_id', user.id)
        .limit(1)
        .maybeSingle()
      if (!agentRecord) redirect('/admin/login?error=no_tenant')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tenant = (agentRecord as any).tenants
      role = 'agent'
    }
  }

  return (
    <AdminShell tenant={tenant} userEmail={user.email ?? ''} role={role}>
      {children}
    </AdminShell>
  )
}
