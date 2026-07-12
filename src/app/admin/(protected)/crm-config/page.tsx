'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import TaxonomyManager from '@/components/crm/TaxonomyManager'
import PageHeader from '@/components/admin/PageHeader'

export default function CrmConfigPage() {
  const [tenantId, setTenantId] = useState('')
  const [isAdmin,  setIsAdmin]  = useState(false)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await sb.from('tenant_admins').select('tenant_id, role').eq('user_id', user.id).single()
      if (data) { setTenantId(data.tenant_id); setIsAdmin(data.role === 'admin') }
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>

  return (
    <div style={{ maxWidth: 640 }}>
      <PageHeader title={<>Configuración CRM</>} subtitle={<>Tipos de contacto y fuentes / canales usados en clientes.</>} />
      <div style={{ background: '#fff', borderRadius: 12, padding: '22px 24px', border: '1px solid #ebebeb' }}>
        {tenantId && <TaxonomyManager tenantId={tenantId} canEdit={isAdmin} />}
      </div>
    </div>
  )
}
