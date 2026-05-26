import { NextRequest, NextResponse } from 'next/server'
import { verifySuperAdmin, serviceClient } from '@/lib/superadmin'
import { addDomain, getDomainStatus, verifyDomain, removeDomain } from '@/lib/vercel-api'

/** GET — current Vercel status for both apex and www */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verifySuperAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const { data: tenant } = await serviceClient()
    .from('tenants').select('domain').eq('id', id).single()
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [apex, www] = await Promise.all([
    getDomainStatus(tenant.domain),
    getDomainStatus(`www.${tenant.domain}`),
  ])
  return NextResponse.json({ domain: tenant.domain, apex, www })
}

/** POST — add both apex and www to Vercel */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verifySuperAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const { data: tenant } = await serviceClient()
    .from('tenants').select('domain').eq('id', id).single()
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [apex, www] = await Promise.all([
    addDomain(tenant.domain),
    addDomain(`www.${tenant.domain}`),
  ])

  // Log raw responses to help diagnose issues
  console.log('[domain] apex response:', JSON.stringify(apex))
  console.log('[domain] www response:', JSON.stringify(www))

  return NextResponse.json({ domain: tenant.domain, apex, www })
}

/** PUT — re-verify both apex and www */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verifySuperAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const { data: tenant } = await serviceClient()
    .from('tenants').select('domain').eq('id', id).single()
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [apex, www] = await Promise.all([
    verifyDomain(tenant.domain),
    verifyDomain(`www.${tenant.domain}`),
  ])
  return NextResponse.json({ domain: tenant.domain, apex, www })
}

/** DELETE — remove domain from Vercel */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verifySuperAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const { domain } = await request.json()
  if (!domain) return NextResponse.json({ error: 'domain required' }, { status: 400 })

  const ok = await removeDomain(domain)
  return NextResponse.json({ ok })
}
