/**
 * Sender Profile — public API for the sender-profile module.
 *
 * The singleton `senderProfileService` is what all consumers should import.
 * To swap LocalStorage for a backend API:
 *   1. Create an `ApiRepository implements SenderProfileRepository` that calls
 *      your `/api/sender-profile` endpoints.
 *   2. Replace `new LocalStorageRepository()` here with `new ApiRepository()`.
 *   3. Done — no UI, hook, or AI-service changes required.
 */

export type { SenderProfile, Tone, Language } from './types'
export { EMPTY_SENDER_PROFILE } from './types'
export type { SenderProfileRepository } from './repository'
export type { SenderProfileService } from './service'
export { useSenderProfile } from './use-sender-profile'

import { LocalStorageRepository } from './local-storage-repository'
import { DefaultSenderProfileService } from './service'

const repository = new LocalStorageRepository()

/** Singleton service — import this anywhere you need the sender profile. */
export const senderProfileService = new DefaultSenderProfileService(repository)
