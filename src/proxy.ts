import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  // Strip port for local dev
  const domain = host.split(':')[0]

  // Forward as a REQUEST header so server components can read it via headers()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-tenant-domain', domain)

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
