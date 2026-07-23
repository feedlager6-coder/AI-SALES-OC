/**
 * SenderProfileService — application-level interface for managing the sender profile.
 *
 * Consumers (UI hooks, AI services) depend only on this interface.
 * The storage strategy is fully hidden behind the repository.
 *
 * Future AI services must accept a SenderProfile (via MessageGenerationContext)
 * and should NOT load it directly — the service is the single source of truth.
 */

import type { SenderProfile } from './types'
import type { SenderProfileRepository } from './repository'

export interface SenderProfileService {
  /** Returns the saved profile, or null if the user hasn't filled it in yet. */
  getProfile(): Promise<SenderProfile | null>

  /** Persists the profile. Safe to call on every form save. */
  saveProfile(profile: SenderProfile): Promise<void>

  /** True when a profile has been saved (even if incomplete). */
  hasProfile(): Promise<boolean>

  /** Wipes the stored profile. */
  clearProfile(): Promise<void>
}

// ── Default implementation ────────────────────────────────────────────────────

export class DefaultSenderProfileService implements SenderProfileService {
  constructor(private readonly repo: SenderProfileRepository) {}

  async getProfile(): Promise<SenderProfile | null> {
    return this.repo.load()
  }

  async saveProfile(profile: SenderProfile): Promise<void> {
    await this.repo.save(profile)
  }

  async hasProfile(): Promise<boolean> {
    const profile = await this.repo.load()
    return profile !== null
  }

  async clearProfile(): Promise<void> {
    await this.repo.clear()
  }
}
