/**
 * MessageGenerationContext — the complete information package passed to any
 * AI message-generation service.
 *
 * Every future AI adapter (OpenAI, Anthropic, template engine) MUST receive
 * this context and MUST NOT reach out to other services to fetch data — all
 * required information is pre-assembled here by the caller.
 *
 * Assembling the context:
 *   const ctx: MessageGenerationContext = {
 *     senderProfile: await senderProfileService.getProfile()!,
 *     company:       selectedCompany,
 *     contact:       selectedContact,
 *     signals:       company.signals,
 *     intent:        confirmedIntent ?? null,
 *   }
 *   const draft = await messageGenerator.generate(ctx)
 *
 * Extending the context:
 *   Add optional fields here. Existing implementations that don't use the new
 *   field will continue to work — they simply ignore it.
 */

import type { SenderProfile } from '@/lib/sender-profile/types'
import type { MockCompany, CompanyContact, CompanySignal } from '@/lib/search/types'
import type { ConfirmedIntent } from '@/lib/intent/types'

export interface MessageGenerationContext {
  /**
   * Who is sending — company identity, tone, language, and signature.
   * Required: AI must always know who it is writing on behalf of.
   */
  senderProfile: SenderProfile

  /**
   * The target company being prospected.
   * Used for company-specific personalisation (industry, size, signals).
   */
  company: MockCompany

  /**
   * The primary contact at the target company.
   * Used to address the message and tailor the opening.
   */
  contact: CompanyContact

  /**
   * Growth / intent signals detected for this company (hiring, expanding, etc.).
   * AI uses these as conversation hooks / reasons to reach out.
   */
  signals: CompanySignal[]

  /**
   * The user's original search intent that produced this company in results.
   * Provides additional context about why this company was found relevant.
   * May be null when a message is generated outside of a Discover flow.
   */
  intent: ConfirmedIntent | null
}
