/**
 * useSenderProfile — React hook for reading and saving the sender profile.
 *
 * Uses the senderProfileService singleton so the storage strategy is
 * completely transparent to UI components.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { senderProfileService } from './index'
import type { SenderProfile } from './types'

interface UseSenderProfileResult {
  /** The saved profile, or null while loading / if not yet set */
  profile: SenderProfile | null
  /** True during the initial localStorage read */
  isLoading: boolean
  /** True while a save is in progress */
  isSaving: boolean
  /** Saves the profile and updates local state */
  save: (profile: SenderProfile) => Promise<void>
  /** Clears the stored profile */
  clear: () => Promise<void>
}

export function useSenderProfile(): UseSenderProfileResult {
  const [profile, setProfile] = useState<SenderProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    senderProfileService.getProfile().then((p) => {
      if (!cancelled) {
        setProfile(p)
        setIsLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  const save = useCallback(async (next: SenderProfile) => {
    setIsSaving(true)
    try {
      await senderProfileService.saveProfile(next)
      setProfile(next)
    } finally {
      setIsSaving(false)
    }
  }, [])

  const clear = useCallback(async () => {
    await senderProfileService.clearProfile()
    setProfile(null)
  }, [])

  return { profile, isLoading, isSaving, save, clear }
}
