import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import AdminShell from './AdminShell'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { title: 'PropCLOUD Admin' }
  const { data: adminRecord } = await supabase
    .from('tenant_admins')
    .select('tenants(name)')
    .eq('user_id', user.id)
    .single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenantName = (adminRecord as any)?.tenants?.name
  return { title: tenantName ? `PropCLOUD Admin — ${tenantName}` : 'PropCLOUD Admin' }
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
    .select('tenant_id, role, tenants(id, name, slug, logo_url, theme)')
    .eq('user_id', user.id)
    .single()

  if (!adminRecord) redirect('/admin/login?error=no_tenant')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenant = (adminRecord as any).tenants

  return (
    <AdminShell tenant={tenant} userEmail={user.email ?? ''}>
      {children}
    </AdminShell>
  )
}
