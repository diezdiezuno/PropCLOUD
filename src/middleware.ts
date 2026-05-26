import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  // Strip port for local dev
  const domain = host.split(':')[0]

  const response = NextResponse.next()
  response.headers.set('x-tenant-domain', domain)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
