/**
 * Plugin registration entry point.
 * Call registerAllPlugins() once at application startup (before handling requests).
 *
 * Each plugin checks whether it's enabled via environment variables.
 * Per-workspace API keys are resolved at runtime via getWorkspaceApiKey().
 */
import { registry } from './plugin-registry.js'

// ── Stub implementations (to be replaced with real ones in subsequent sprints) ──

import { CSVImportPlugin } from '../implementations/lead-sources/csv-import.js'
import { PatternEmailFinderPlugin } from '../implementations/enrichment/pattern-email-finder.js'
import { EgrulPlugin } from '../implementations/enrichment/egrul.js'

export function registerAllPlugins(): void {
  // ── Lead Sources ──────────────────────────────────────────────────────────
  registry.register({ plugin: new CSVImportPlugin(), category: 'lead_source', priority: 99, enabled: true })

  // ── Email Finders (waterfall order) ───────────────────────────────────────
  registry.register({ plugin: new PatternEmailFinderPlugin(), category: 'email_finder', priority: 99, enabled: true })

  // ── Company Data ──────────────────────────────────────────────────────────
  registry.register({ plugin: new EgrulPlugin(), category: 'company_data', priority: 99, enabled: true })

  // NOTE: Real provider implementations (2GIS, Hunter, Mailgun, OpenAI, etc.)
  // will be added in Sprint 1.3 (Enrichment) and Sprint 1.4 (Email Outreach).
  // Placeholders are registered above to keep the registry non-empty.
}
