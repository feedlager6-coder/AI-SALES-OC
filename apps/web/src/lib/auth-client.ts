import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  // Always use relative URLs so auth requests go through Next.js rewrite proxy
  // (/api/:path* → INTERNAL_API_URL/api/:path*).  This guarantees the session
  // cookie is set on the web domain — not the API domain — so Next.js middleware
  // can read it.  If baseURL were set to NEXT_PUBLIC_API_URL (the API's public
  // URL), the browser would receive a cookie scoped to the API domain and
  // middleware would never see it, silently breaking login in production.
  baseURL: '',
})

// Re-export named helpers with explicit types to avoid non-portable inferred types
export const signIn = authClient.signIn
export const signUp = authClient.signUp
export const signOut = authClient.signOut
export const useSession: typeof authClient.useSession = authClient.useSession
export const getSession = authClient.getSession
