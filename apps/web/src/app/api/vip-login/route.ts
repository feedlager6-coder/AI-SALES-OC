/**
 * VIP Login API route — Next.js server route (no API server or DB required).
 *
 * POST  /api/vip-login  { email, password } → sets vip-session cookie
 * GET   /api/vip-login                      → returns VIP user if cookie valid, else 401
 * DELETE /api/vip-login                     → clears cookie (logout)
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  VIP_EMAIL,
  VIP_PASSWORD,
  VIP_COOKIE_NAME,
  VIP_TOKEN,
  VIP_USER,
} from '@/lib/vip-session'

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  // 30-day expiry — long enough not to be annoying
  maxAge: 60 * 60 * 24 * 30,
}

// ── POST: sign in ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string }
  try {
    body = (await req.json()) as { email?: string; password?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password

  if (
    email !== VIP_EMAIL.toLowerCase() ||
    password !== VIP_PASSWORD
  ) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true, user: VIP_USER })
  res.cookies.set(VIP_COOKIE_NAME, VIP_TOKEN, COOKIE_OPTIONS)
  return res
}

// ── GET: check current session ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const token = req.cookies.get(VIP_COOKIE_NAME)?.value
  if (token !== VIP_TOKEN) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
  return NextResponse.json({ user: VIP_USER })
}

// ── DELETE: sign out ──────────────────────────────────────────────────────────
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(VIP_COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 })
  return res
}
