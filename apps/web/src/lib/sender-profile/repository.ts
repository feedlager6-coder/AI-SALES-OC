/**
 * SenderProfileRepository — storage abstraction for SenderProfile.
 *
 * Implementations:
 *   LocalStorageRepository  — current, zero-backend, instant persistence
 *   ApiRepository           — future, calls /api/sender-profile endpoint
 *
 * To migrate to the backend: implement this interface and swap it in
 * `apps/web/src/lib/sender-profile/index.ts`. The service and all UI
 * components stay unchanged.
 */

import type { SenderProfile } from './types'

export interface SenderProfileRepository {
  /** Returns the stored profile, or null if none has been saved yet. */
  load(): Promise<SenderProfile | null>

  /** Persists the profile. Overwrites any previously stored value. */
  save(profile: SenderProfile): Promise<void>

  /** Removes the stored profile entirely. */
  clear(): Promise<void>
}
