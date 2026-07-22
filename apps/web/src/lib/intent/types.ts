/**
 * Parsed representation of a user's natural-language search intent.
 *
 * This type is the contract between the UI layer and any Intent Interpreter
 * implementation. Swap parseIntentMock() for a real LLM-based parser and the
 * InteractiveIntentCard component will work without any changes.
 */
export interface ParsedIntent {
  /** Detected industry / business category, e.g. "Строительство" */
  industry: string | null
  /** Detected geographic region, e.g. "Москва" */
  region: string | null
  /** Detected company size range, e.g. "20–100 сотрудников" */
  companySize: string | null
  /**
   * One optional clarifying question the system wants to ask the user.
   * The real Intent Interpreter may omit this when the intent is unambiguous.
   * Maximum 1 question is enforced by design (see NORTH_STAR.md).
   */
  clarifyingQuestion: ClarifyingQuestion | null
}

export interface ClarifyingQuestion {
  /** Human-readable question text shown to the user */
  text: string
  /** Short answer options (2 items, max 3) */
  options: ReadonlyArray<{ label: string; value: string }>
}

/**
 * Result after the user has reviewed and (optionally) answered the clarifying
 * question. This is what gets passed downstream to the actual search layer.
 */
export interface ConfirmedIntent {
  parsed: ParsedIntent
  /** Raw original query, preserved for the real interpreter */
  rawQuery: string
  /** Selected clarifying answer value, or null if question was skipped */
  clarifyingAnswer: string | null
}
