import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { VIP_COOKIE_NAME, VIP_TOKEN } from '@/lib/vip-session'

const PUBLIC_PATHS = ['/login', '/register', '/api/auth', '/api/vip-login', '/dev-preview']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // DEV-ONLY: allow bypass with ?_dev=1 for screenshot tooling
  if (
    process.env.NODE_ENV !== 'production' &&
    request.nextUrl.searchParams.get('_dev') === '1'
  ) {
    return NextResponse.next()
  }

  // VIP session — hardcoded dev account, no DB required
  const vipToken = request.cookies.get(VIP_COOKIE_NAME)?.value
  if (vipToken === VIP_TOKEN) {
    return NextResponse.next()
  }

  // Real Better Auth session cookie
  const sessionToken =
    request.cookies.get('better-auth.session_token')?.value ??
    request.cookies.get('__Secure-better-auth.session_token')?.value

  if (!sessionToken && !pathname.startsWith('/api')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
