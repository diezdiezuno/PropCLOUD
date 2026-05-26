import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import { serviceClient } from '@/lib/superadmin'
import SuperAdminShell from './SuperAdminShell'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/superadmin/login')

  const { data } = await serviceClient()
    .from('super_admins')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!data) redirect('/superadmin/login?error=unauthorized')

  return (
    <SuperAdminShell userEmail={user.email ?? ''}>
      {children}
    </SuperAdminShell>
  )
}
