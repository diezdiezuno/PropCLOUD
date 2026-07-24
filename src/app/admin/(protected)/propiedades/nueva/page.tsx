'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { getMembership } from '@/lib/membership'

// "Nueva propiedad" ya no es un formulario aparte: crea un borrador y abre el
// mismo editor de siempre. Antes había dos formularios distintos que se iban
// desincronizando; ahora hay uno solo.
//
// El borrador nace con agent_id del creador porque la RLS de properties deja
// al agente editar solo las suyas (agent_id = su users.id). Sin eso, un agente
// crearía una propiedad que después no podría tocar. El admin la reasigna desde
// el editor.
export default function NuevaPropiedadPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const creando = useRef(false)   // StrictMode monta dos veces: no crear dos borradores

  useEffect(() => {
    if (creando.current) return
    creando.current = true
    ;(async () => {
      const m = await getMembership()
      if (!m) { setError('No se pudo identificar tu oficina.'); return }

      const sb = createClient()
      // users.id del creador (agent_id apunta a users, no a auth). Puede no
      // existir para un admin que no está en users: entonces queda sin asignar.
      const { data: me } = await sb.from('users').select('id')
        .eq('auth_id', m.userId).eq('tenant_id', m.tenantId).maybeSingle()

      // Si ya hay un borrador en blanco mío, se reusa en vez de crear otro.
      // Antes, cada clic en "Nueva propiedad" que se abandonaba dejaba una
      // propiedad vacía guardada; así queda una sola, y encima invisible
      // (el listado oculta los borradores sin nada cargado).
      const enBlanco = sb.from('properties').select('id')
        .eq('tenant_id', m.tenantId).eq('crm_status', 'draft').eq('active', true)
        .eq('title', '').eq('type', '')
      const { data: previo } = await (me?.id
        ? enBlanco.eq('agent_id', me.id)
        : enBlanco.is('agent_id', null)).limit(1).maybeSingle()
      if (previo) { router.replace(`/admin/propiedades/${previo.id}?tab=1`); return }

      const { data, error } = await sb.from('properties').insert({
        tenant_id:   m.tenantId,
        source:      'manual',
        status:      'inactive',
        crm_status:  'draft',
        type:        '',
        transaction: 'sale',
        price:       0,
        currency:    'USD',
        images:      [],
        title:       '',
        agent_id:    me?.id ?? null,
      }).select('id').single()

      if (error || !data) { setError(error?.message ?? 'No se pudo crear la propiedad.'); return }
      router.replace(`/admin/propiedades/${data.id}?tab=1`)
    })()
  }, [router])

  return (
    <div style={{ padding: 40, color: '#888', fontSize: 14 }}>
      {error
        ? <span style={{ color: '#DC2626' }}>Error: {error}</span>
        : 'Creando propiedad…'}
    </div>
  )
}
