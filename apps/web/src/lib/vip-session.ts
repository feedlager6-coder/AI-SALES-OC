/**
 * VIP Session — dev-convenience bypass for a single hardcoded account.
 *
 * Allows the owner to log in without a running PostgreSQL database.
 * The rest of the auth system (Better Auth + Drizzle) is completely unchanged.
 *
 * How it works:
 *   1. Login form detects VIP credentials → calls POST /api/vip-login
 *   2. API route sets a signed httpOnly cookie (vip-session)
 *   3. Middleware accepts that cookie just like a real Better Auth token
 *   4. VipSessionProvider reads GET /api/vip-login → injects mock user into React tree
 *   5. useAppSession() returns the VIP user when Better Auth session is absent
 *
 * To disable: remove VipSessionProvider from providers.tsx and the middleware check.
 * To connect real DB: nothing changes — real auth takes priority everywhere.
 */

// ── Credentials (server-side only — never send to client) ─────────────────────
export const VIP_EMAIL = 'Feedlager6@gmail.com'
export const VIP_PASSWORD = '918273645'

// ── Cookie mechanics ──────────────────────────────────────────────────────────
/** Cookie name written by POST /api/vip-login */
export const VIP_COOKIE_NAME = 'vip-session'

/**
 * Fixed token stored in the cookie.
 * Changing this string invalidates all existing VIP sessions (users must re-login).
 * Long enough to be unguessable; short enough to fit in a cookie comfortably.
 */
export const VIP_TOKEN =
  'vip_f8e2b4a3c1d9e7f6b5a4c3d2e1f0a9b8c7d6e5f4a3b2c1d0_feedlager6'

// ── Mock user injected into the React session tree ────────────────────────────
export const VIP_USER = {
  id: 'vip-feedlager6',
  name: 'Feedlager',
  email: 'Feedlager6@gmail.com',
  workspaceName: 'AI Sales OS',
} as const
