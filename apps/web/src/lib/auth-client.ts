import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
})

// Re-export named helpers with explicit types to avoid non-portable inferred types
export const signIn = authClient.signIn
export const signUp = authClient.signUp
export const signOut = authClient.signOut
export const useSession: typeof authClient.useSession = authClient.useSession
export const getSession = authClient.getSession
