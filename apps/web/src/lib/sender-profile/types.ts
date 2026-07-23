/**
 * SenderProfile — who the user is sending on behalf of.
 *
 * This is the foundational entity for all AI-generated messages in the system.
 * Every MessageGenerationContext must carry a SenderProfile so the AI layer
 * can personalise tone, signature, and value propositions correctly.
 *
 * Storage strategy is encapsulated behind SenderProfileRepository:
 *   Current:  LocalStorageRepository (no backend dependency, instant)
 *   Future:   ApiRepository — swap the repository, zero UI changes.
 */

export type Tone = 'formal' | 'professional' | 'friendly'
export type Language = 'ru' | 'en'

export interface SenderProfile {
  // ── Company identity ──────────────────────────────────────────────────────
  /** Full legal or trading name of the sender's company */
  companyName: string
  /** Industry / vertical the company operates in */
  industry: string
  /** Short description of what the company does */
  description: string
  /** Description of the ideal customer the company targets */
  idealCustomers: string
  /** Key differentiators / USPs — used verbatim in AI prompts */
  advantages: string[]
  /** Company website URL */
  website: string

  // ── Sender identity ───────────────────────────────────────────────────────
  /** Full name of the person sending the messages */
  senderName: string
  /** Job title / position of the sender */
  senderPosition: string
  /** Sender's business email */
  email: string
  /** Sender's business phone number */
  phone: string

  // ── Communication preferences ─────────────────────────────────────────────
  /** Plain-text email signature appended to every outgoing message */
  signature: string
  /** Desired communication tone for AI-generated messages */
  tone: Tone
  /** Primary language for AI-generated messages */
  language: Language
}

/** Empty/blank profile — used as form initial state */
export const EMPTY_SENDER_PROFILE: SenderProfile = {
  companyName: '',
  industry: '',
  description: '',
  idealCustomers: '',
  advantages: [],
  website: '',
  senderName: '',
  senderPosition: '',
  email: '',
  phone: '',
  signature: '',
  tone: 'professional',
  language: 'ru',
}
