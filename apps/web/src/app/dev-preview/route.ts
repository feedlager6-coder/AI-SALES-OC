/**
 * DEV-ONLY: Authenticate the test user and redirect to any dashboard page.
 * Used to get session cookies into the headless screenshot browser.
 * Never ships in production.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  const to = req.nextUrl.searchParams.get('to') ?? '/dashboard'

  try {
    const resp = await fetch('http://localhost:3001/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5000' },
      body: JSON.stringify({ email: 'test@example.com', password: 'testpass123' }),
    })

    const redirect = NextResponse.redirect(new URL(to, req.url))

    // Forward all Set-Cookie headers from Better Auth to the browser
    const cookies = resp.headers.getSetCookie()
    cookies.forEach((cookie) => {
      // Strip 'Secure' flag so cookie works over http://127.0.0.1
      const cleaned = cookie.replace(/;\s*Secure/gi, '')
      redirect.headers.append('Set-Cookie', cleaned)
    })
    return redirect
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
