import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  // Empty string → relative URLs → Next.js rewrites /api/* → localhost:3001.
  // Must use ?? (not ||) so an empty NEXT_PUBLIC_API_URL stays empty and
  // requests stay same-origin through the Next.js proxy.
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '',
})

// Re-export named helpers with explicit types to avoid non-portable inferred types
export const signIn = authClient.signIn
export const signUp = authClient.signUp
export const signOut = authClient.signOut
export const useSession: typeof authClient.useSession = authClient.useSession
export const getSession = authClient.getSession
