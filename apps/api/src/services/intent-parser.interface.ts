/**
 * IntentParser — contract every intent-parsing adapter must satisfy.
 *
 * Implementations (current and future):
 *   RuleBasedIntentParser  — dictionaries + regex, no network, instant
 *   AIIntentParser         — calls LLM API (OpenAI / Anthropic)
 *
 * To swap in AI:
 *   1. Create a class that implements IntentParser.
 *   2. Pass it to IntentService constructor instead of RuleBasedIntentParser.
 *   3. Zero route or UI changes required.
 */

export interface ClarifyingQuestion {
  text: string
  options: ReadonlyArray<{ label: string; value: string }>
}

export interface ParsedIntentResult {
  industry: string | null
  region: string | null
  companySize: string | null
  clarifyingQuestion: ClarifyingQuestion | null
}

export interface IntentParser {
  parse(query: string): ParsedIntentResult
}
