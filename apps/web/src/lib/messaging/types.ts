/**
 * Messaging layer types — contract between the draft UI and any message
 * generation implementation (mock templates or real AI).
 *
 * To plug in AI: replace MockMessageGenerator with a class that calls
 * your LLM endpoint and still returns Promise<DraftMessage>. No UI changes.
 */

export interface DraftMessage {
  /** Email subject line */
  subject: string
  /** Full message body, plain text */
  body: string
  /** Wall-clock time the draft was generated (for display / auditing) */
  generatedAt: Date
}
