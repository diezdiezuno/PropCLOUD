import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { EmailOtpType } from '@supabase/supabase-js'

// Aterrizaje de los enlaces de recuperación y magic link.
//
// Existe para sacar supabase.co de los correos: antes el enlace apuntaba a
// neuzltjlezogxmhbceco.supabase.co/auth/v1/verify y recién de ahí rebotaba al
// sitio. Ahora las plantillas arman el enlace contra el dominio del propio
// tenant con {{ .TokenHash }}, y acá se valida con verifyOtp.
//
// Efecto lateral bienvenido: esto no es PKCE, así que no hay code_verifier
// guardado en el navegador. El enlace funciona aunque se abra en el teléfono
// habiéndolo pedido en la computadora, que era la causa más común de
// "no me deja entrar".
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type      = searchParams.get('type') as EmailOtpType | null
  const next      = searchParams.get('next') ?? '/admin/dashboard'

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/admin/login?error=auth`)
  }

  const cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookies) { cookiesToSet.push(...cookies) },
      },
    }
  )

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })

  if (error) {
    console.error('[auth/confirm] verifyOtp:', error.message)
    return NextResponse.redirect(`${origin}/admin/login?error=auth`)
  }

  const response = NextResponse.redirect(`${origin}${next}`)
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  return response
}
