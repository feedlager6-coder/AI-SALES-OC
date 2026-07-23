/**
 * LocalStorageRepository — persists SenderProfile in the browser's localStorage.
 *
 * This implementation requires no backend. It is the default for Sprint 1.
 * To swap in a real API: implement SenderProfileRepository against your endpoint
 * and replace the export in `index.ts`. Nothing else changes.
 */

import type { SenderProfileRepository } from './repository'
import type { SenderProfile } from './types'

const STORAGE_KEY = 'ai-sales-os:sender-profile:v1'

export class LocalStorageRepository implements SenderProfileRepository {
  async load(): Promise<SenderProfile | null> {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      return JSON.parse(raw) as SenderProfile
    } catch {
      // Corrupt data — treat as if nothing is saved
      return null
    }
  }

  async save(profile: SenderProfile): Promise<void> {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  }

  async clear(): Promise<void> {
    if (typeof window === 'undefined') return
    localStorage.removeItem(STORAGE_KEY)
  }
}
