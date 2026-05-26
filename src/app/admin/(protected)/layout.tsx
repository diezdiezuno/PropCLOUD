import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase'
import AdminShell from './AdminShell'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  // Check session via cookie-aware server client
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/admin/login')
  }

  // Get the tenant this user administers (service role bypasses RLS)
  const { data: adminRecord } = await serviceClient
    .from('tenant_admins')
    .select('tenant_id, role, tenants(id, name, slug, logo_url, theme)')
    .eq('user_id', session.user.id)
    .single()

  if (!adminRecord) {
    redirect('/admin/login?error=no_tenant')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenant = (adminRecord as any).tenants

  return (
    <AdminShell tenant={tenant} userEmail={session.user.email ?? ''}>
      {children}
    </AdminShell>
  )
}
