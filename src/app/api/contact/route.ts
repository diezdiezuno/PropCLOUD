import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const domain = request.headers.get('x-tenant-domain') ?? 'localhost'
    const body = await request.json()
    const { name, email, phone, message, source } = body

    // Resolve tenant
    let { data: tenant } = await supabase
      .from('tenants').select('id').eq('domain', domain).single()
    if (!tenant) {
      const { data: fallback } = await supabase
        .from('tenants').select('id').limit(1).single()
      tenant = fallback
    }
    if (!tenant) return NextResponse.json({ error: 'no tenant' }, { status: 400 })

    await supabase.from('leads').insert({
      tenant_id: tenant.id,
      property_id: null,
      name: name ?? '',
      email: email ?? null,
      phone: phone ?? null,
      message: message ?? null,
      source: source ?? 'contacto',
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[contact]', err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
