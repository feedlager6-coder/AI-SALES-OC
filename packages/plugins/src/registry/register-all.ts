/**
 * Plugin registration entry point.
 * Call registerAllPlugins() once at application startup (before handling requests).
 *
 * Each plugin checks whether it's enabled via environment variables.
 * Per-workspace API keys are resolved at runtime via getWorkspaceApiKey().
 */
import { registry } from './plugin-registry.js'

// ── Lead Source plugins ───────────────────────────────────────────────────────
import { CSVImportPlugin } from '../implementations/lead-sources/csv-import.js'
import { TwoGisPlugin } from '../implementations/lead-sources/twogis.provider.js'
import { HHRuPlugin } from '../implementations/lead-sources/hhru.provider.js'

// ── Email Finder plugins (waterfall order) ────────────────────────────────────
import { HunterPlugin } from '../implementations/enrichment/hunter.provider.js'
import { SnovPlugin } from '../implementations/enrichment/snov.provider.js'
import { PatternEmailFinderPlugin } from '../implementations/enrichment/pattern-email-finder.js'

// ── Company Data plugins ──────────────────────────────────────────────────────
import { DadataPlugin } from '../implementations/enrichment/dadata.provider.js'
import { EgrulPlugin } from '../implementations/enrichment/egrul.js'

export function registerAllPlugins(): void {
  // ── Lead Sources ──────────────────────────────────────────────────────────
  // Priority 1: 2ГИС (richest data for Russian B2B)
  registry.register({ plugin: new TwoGisPlugin(), category: 'lead_source', priority: 1, enabled: true })
  // Priority 2: HH.ru (employers with open vacancies — buying signal)
  registry.register({ plugin: new HHRuPlugin(), category: 'lead_source', priority: 2, enabled: true })
  // Priority 99: CSV import (manual, always available)
  registry.register({ plugin: new CSVImportPlugin(), category: 'lead_source', priority: 99, enabled: true })

  // ── Email Finders (waterfall: stop when confidence >= 0.3) ──────────────
  // Priority 1: Hunter.io (highest accuracy, best for domains)
  registry.register({ plugin: new HunterPlugin(), category: 'email_finder', priority: 1, enabled: true })
  // Priority 2: Snov.io (fallback after Hunter)
  registry.register({ plugin: new SnovPlugin(), category: 'email_finder', priority: 2, enabled: true })
  // Priority 99: Pattern-based (last resort, always enabled)
  registry.register({ plugin: new PatternEmailFinderPlugin(), category: 'email_finder', priority: 99, enabled: true })

  // ── Company Data (ЕГРЮЛ enrichment) ─────────────────────────────────────
  // Priority 1: Dadata (paid, most complete — INN → full legal data)
  registry.register({ plugin: new DadataPlugin(), category: 'company_data', priority: 1, enabled: true })
  // Priority 2: ЕГРЮЛ nalog.ru (free, limited data)
  registry.register({ plugin: new EgrulPlugin(), category: 'company_data', priority: 2, enabled: true })
}
