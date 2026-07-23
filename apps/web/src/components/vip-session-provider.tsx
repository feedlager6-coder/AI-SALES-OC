'use client'

/**
 * VipSessionProvider — fetches the VIP session from /api/vip-login (GET)
 * and makes it available via useVipSession().
 *
 * When the user is logged in via the VIP account, this context provides a
 * mock user object so the sidebar and other UI components can display name/email
 * without requiring the API server or PostgreSQL to be running.
 *
 * The provider is mounted in the root Providers component. It does nothing
 * when no VIP cookie is present (normal Better Auth users are unaffected).
 */

import { createContext, useContext, useEffect, useState } from 'react'
import type { VIP_USER } from '@/lib/vip-session'

type VipUser = typeof VIP_USER | null

const VipSessionContext = createContext<VipUser>(null)

export function VipSessionProvider({ children }: { children: React.ReactNode }) {
  const [vipUser, setVipUser] = useState<VipUser>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/vip-login', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user: VipUser } | null) => {
        if (!cancelled && data?.user) setVipUser(data.user)
      })
      .catch(() => {/* no VIP session */})
    return () => { cancelled = true }
  }, [])

  return (
    <VipSessionContext.Provider value={vipUser}>
      {children}
    </VipSessionContext.Provider>
  )
}

/** Returns the VIP user if the current session is VIP, otherwise null. */
export function useVipSession(): VipUser {
  return useContext(VipSessionContext)
}
