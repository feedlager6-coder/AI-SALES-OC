/**
 * IntentService — единственная точка входа для разбора поискового запроса.
 *
 * Принимает IntentParser через конструктор (dependency injection).
 * Сегодня: RuleBasedIntentParser.
 * Позже: AIIntentParser — без изменения маршрута или UI.
 */

import type { IntentParser, ParsedIntentResult } from './intent-parser.interface.js'
import { RuleBasedIntentParser } from './rule-based-intent-parser.js'

export class IntentService {
  constructor(private readonly parser: IntentParser) {}

  parse(query: string): ParsedIntentResult {
    return this.parser.parse(query)
  }
}

// ─── Default singleton ────────────────────────────────────────────────────────
//
// To swap parsers for the whole app, change the constructor argument here.
// To override in tests, instantiate IntentService directly with a stub parser.
//
export const intentService = new IntentService(new RuleBasedIntentParser())
