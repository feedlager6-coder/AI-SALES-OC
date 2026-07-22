/**
 * MessageGenerator — contract every message-generation adapter must satisfy.
 *
 * Implementations (current and future):
 *   MockMessageGenerator   — template-based, no network, instant
 *   AIMessageGenerator     — calls LLM API (OpenAI / Anthropic) per company
 *
 * To swap in AI:
 *   1. Create a class that implements MessageGenerator.
 *   2. Pass it wherever MockMessageGenerator is constructed.
 *   3. Zero UI changes required.
 */

import type { MockCompany } from '@/lib/search/types'
import type { DraftMessage } from './types'

export interface MessageGenerator {
  generate(company: MockCompany): DraftMessage
}
