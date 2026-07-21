import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import AdminShell from './AdminShell'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { title: 'Noduus Admin' }
  const { data: adminRecord } = await supabase
    .from('tenant_admins')
    .select('tenants(name)')
    .eq('user_id', user.id)
    .single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenantName = (adminRecord as any)?.tenants?.name
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

  // RLS "Admins read own" policy lets the authenticated user read their own record
  // "Public read tenants" policy lets the join work without service role
  const { data: adminRecord } = await supabase
    .from('tenant_admins')
    .select('tenant_id, role, tenants(id, name, slug, logo_url, theme, proptools_apps)')
    .eq('user_id', user.id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tenant = (adminRecord as any)?.tenants
  let role: 'admin' | 'agent' = 'admin'

  // No es admin → ¿es agente (usuario PropTools)?
  if (!adminRecord) {
    const { data: agentRecord } = await supabase
      .from('users')
      .select('tenant_id, role, tenants(id, name, slug, logo_url, theme, proptools_apps)')
      .eq('auth_id', user.id)
      .single()
    if (!agentRecord) redirect('/admin/login?error=no_tenant')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tenant = (agentRecord as any).tenants
    role = 'agent'
  }

  return (
    <AdminShell tenant={tenant} userEmail={user.email ?? ''} role={role}>
      {children}
    </AdminShell>
  )
}
