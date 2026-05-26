// TEMPORARY endpoint — delete after use
// Sets a password for a user directly via service role (no email needed)
// Usage: GET /api/setup-password?secret=propcloud-setup&email=you@email.com&password=yourpassword

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SETUP_SECRET = 'propcloud-setup'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secret   = searchParams.get('secret')
  const email    = searchParams.get('email')
  const password = searchParams.get('password')

  if (secret !== SETUP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!email || !password) {
    return NextResponse.json({ error: 'email and password required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'password must be at least 8 chars' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Find user by email
  const { data: { users }, error: listErr } = await admin.auth.admin.listUsers()
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })

  const user = users.find(u => u.email === email)
  if (!user) return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 })

  // Set password directly — no email sent
  const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, { password })
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, message: `Password set for ${email}. DELETE this endpoint now.` })
}
