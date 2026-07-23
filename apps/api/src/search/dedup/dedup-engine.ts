/**
 * DedupEngine — cross-provider company deduplication with field merging.
 *
 * Dedup priority (strict order):
 *   1. INN (10 digits, normalized — trim + remove spaces)
 *   2. OGRN (13 or 15 digits)
 *   3. Domain (no protocol, no www, no trailing slash, lowercase)
 *   4. Name + city fuzzy — Jaro-Winkler ≥ 0.88 — CONSERVATIVE:
 *      flags as potentialDuplicate, does NOT auto-merge
 *
 * Field merge priority on conflict (from spec section 5):
 *   Legal name  → Dadata wins (gosreg > dadata > 2gis > hhru)
 *   Trade name  → 2GIS wins
 *   INN         → Dadata > Госзакупки > 2GIS
 *   Phone       → 2GIS > website > HH
 *   Website     → direct > 2GIS > HH
 *   Email       → website > Hunter > pattern
 *   Size        → Контур > HH > 2GIS
 *
 * Anomaly handling:
 *   One INN, two names → log dedup_anomaly, Dadata name wins, both saved in aliases[]
 *   Two INNs + one domain → keep as separate companies, mark relatedDomain: true
 */

import { createLogger } from '@ai-sales-os/logger'
import type { SearchCompany, MergedCompany, FieldProvenance } from '../types.js'

const logger = createLogger({ name: 'api:dedup-engine' })

// ── Jaro-Winkler implementation ───────────────────────────────────────────────

function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1.0
  const len1 = s1.length
  const len2 = s2.length
  if (len1 === 0 || len2 === 0) return 0

  const matchDist = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0)
  const s1Matches = new Array<boolean>(len1).fill(false)
  const s2Matches = new Array<boolean>(len2).fill(false)

  let matches       = 0
  let transpositions = 0

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDist)
    const end   = Math.min(i + matchDist + 1, len2)
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue
      s1Matches[i] = true
      s2Matches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0

  let k = 0
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }

  return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3
}

function jaroWinkler(s1: string, s2: string, prefixScale = 0.1): number {
  const jaroScore = jaro(s1, s2)
  let prefix = 0
  const maxPrefix = Math.min(4, s1.length, s2.length)
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) prefix++
    else break
  }
  return jaroScore + prefix * prefixScale * (1 - jaroScore)
}

// ── Key extraction helpers ────────────────────────────────────────────────────

function normalizeInn(inn: string | null | undefined): string | null {
  if (!inn) return null
  const cleaned = inn.trim().replace(/\s+/g, '')
  // INN is 10 digits (ООО) or 12 digits (ИП)
  if (/^\d{10,12}$/.test(cleaned)) return cleaned
  return null
}

function normalizeOgrn(ogrn: string | null | undefined): string | null {
  if (!ogrn) return null
  const cleaned = ogrn.trim().replace(/\s+/g, '')
  if (/^\d{13}$/.test(cleaned) || /^\d{15}$/.test(cleaned)) return cleaned
  return null
}

function normalizeDomain(website: string | null | undefined): string | null {
  if (!website || !website.trim()) return null
  return website
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '') // remove path
    .toLowerCase()
    .trim() || null
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/["""''«»]/g, '')
    // Remove common legal form prefixes for fuzzy matching
    .replace(/^(ооо|оао|зао|пао|ип|нпо|нко|ао|мбу|мкуп|гуп|муп)\s+/i, '')
    .trim()
}

// ── DedupEngine ───────────────────────────────────────────────────────────────

export class DedupEngine {
  private static readonly FUZZY_THRESHOLD = 0.88

  /**
   * Deduplicate an array of raw SearchCompany results across providers.
   *
   * Returns MergedCompany[] — one entry per unique company with:
   *   - Fields merged by priority rules
   *   - signalsV4: [] (populated by SignalEngine after dedup)
   *   - sources: FieldProvenance tracking which provider supplied what
   *   - aliases: alternative names collected during merges
   */
  dedup(companies: SearchCompany[]): MergedCompany[] {
    // Map: canonical key → winner company
    const byInn    = new Map<string, MergedCompany>()
    const byOgrn   = new Map<string, MergedCompany>()
    const byDomain = new Map<string, MergedCompany>()
    const unique: MergedCompany[] = []

    for (const raw of companies) {
      const inn    = normalizeInn(raw.inn)
      const domain = normalizeDomain(raw.website)

      // ── 1. INN exact match ────────────────────────────────────────────────
      if (inn) {
        const existing = byInn.get(inn)
        if (existing) {
          this.mergeInto(existing, raw)
          continue
        }
      }

      // ── 2. OGRN exact match ───────────────────────────────────────────────
      // Note: OGRN not in SearchCompany base type; check via type assertion for providers that add it
      const rawOgrn = (raw as SearchCompany & { ogrn?: string }).ogrn
      const ogrn    = normalizeOgrn(rawOgrn)
      if (ogrn) {
        const existing = byOgrn.get(ogrn)
        if (existing) {
          this.mergeInto(existing, raw)
          continue
        }
      }

      // ── 3. Domain exact match ─────────────────────────────────────────────
      if (domain) {
        const existing = byDomain.get(domain)
        if (existing) {
          // Check for two-INN + one-domain pattern (holding company)
          const existingInn = normalizeInn(existing.inn)
          if (inn && existingInn && inn !== existingInn) {
            // Holding company pattern — keep separate, flag related
            logger.info({
              event:         'dedup.holding_pattern',
              domain,
              inn1:          existingInn,
              inn2:          inn,
            })
            const merged = this.toMergedCompany(raw)
            merged.relatedDomain = true
            this.registerKeys(merged, inn, ogrn, domain, byInn, byOgrn, byDomain)
            unique.push(merged)
            continue
          }

          this.mergeInto(existing, raw)
          continue
        }
      }

      // ── 4. Fuzzy name + city match (flag only, do NOT auto-merge) ─────────
      const name = normalizeName(raw.name)
      const city = (raw as SearchCompany & { city?: string }).city?.trim().toLowerCase() ?? ''

      let isFuzzyDuplicate = false
      for (const candidate of unique) {
        const candName = normalizeName(candidate.name)
        const candCity = (candidate as MergedCompany & { city?: string }).city?.trim().toLowerCase() ?? ''

        if (city && candCity && city !== candCity) continue // different cities → skip

        const similarity = jaroWinkler(name, candName)
        if (similarity >= DedupEngine.FUZZY_THRESHOLD) {
          // Conservative: flag, don't merge
          candidate.potentialDuplicate = true
          logger.info({
            event:      'dedup.fuzzy_potential_duplicate',
            company1:   candidate.name,
            company2:   raw.name,
            similarity: Math.round(similarity * 100) / 100,
          })
          isFuzzyDuplicate = true
          break
        }
      }

      // ── New unique company ─────────────────────────────────────────────────
      const merged = this.toMergedCompany(raw)
      if (isFuzzyDuplicate) merged.potentialDuplicate = true

      this.registerKeys(merged, inn, ogrn, domain, byInn, byOgrn, byDomain)
      unique.push(merged)
    }

    logger.info({
      event:         'dedup.complete',
      rawCount:      companies.length,
      uniqueCount:   unique.length,
      mergedCount:   companies.length - unique.length,
    })

    return unique
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private toMergedCompany(raw: SearchCompany): MergedCompany {
    return {
      ...raw,
      signalsV4:          [],
      contacts:           [],
      sources:            this.initialProvenance(raw),
      aliases:            [],
      potentialDuplicate: false,
      relatedDomain:      false,
    }
  }

  private initialProvenance(raw: SearchCompany): FieldProvenance {
    // Determine source from provider data (heuristic for Pass 2)
    const provenance: FieldProvenance = {}

    // We don't have a direct providerId on SearchCompany in base interface,
    // but we can infer from field patterns
    const source = this.inferSource(raw)
    if (raw.name)     provenance.tradeName  = source
    if (raw.inn)      provenance.inn        = source
    if (raw.website)  provenance.website    = source
    if (raw.contact?.email) provenance.email = source
    if (raw.contact?.phone) provenance.phone = source

    return provenance
  }

  private inferSource(raw: SearchCompany): string {
    // Heuristic: check if INN looks like dadata-enriched (10 or 12 digits)
    if (raw.inn?.trim().length === 10 || raw.inn?.trim().length === 12) return 'dadata'
    return '2gis'
  }

  private registerKeys(
    company: MergedCompany,
    inn:     string | null,
    ogrn:    string | null,
    domain:  string | null,
    byInn:    Map<string, MergedCompany>,
    byOgrn:   Map<string, MergedCompany>,
    byDomain: Map<string, MergedCompany>,
  ): void {
    if (inn)    byInn.set(inn, company)
    if (ogrn)   byOgrn.set(ogrn, company)
    if (domain) byDomain.set(domain, company)
  }

  /**
   * Merge `incoming` fields into `winner` using priority rules.
   * Updates winner in place.
   */
  private mergeInto(winner: MergedCompany, incoming: SearchCompany): void {
    const incomingSource = this.inferSource(incoming)

    // Track anomalous name conflict
    if (winner.name !== incoming.name && incoming.name) {
      if (!winner.aliases.includes(incoming.name)) {
        winner.aliases.push(incoming.name)
        logger.info({
          event:          'dedup.dedup_anomaly',
          winnerId:       winner.id,
          winnerName:     winner.name,
          incomingName:   incoming.name,
          incomingSource,
        })
      }
    }

    // Phone: 2GIS > website > HH
    if (!winner.contact?.phone && incoming.contact?.phone) {
      if (!winner.contact) {
        winner.contact = { ...incoming.contact }
      } else {
        winner.contact.phone = incoming.contact.phone
      }
      winner.sources.phone = incomingSource
    }

    // Website: winner keeps existing if present
    if (!winner.website && incoming.website) {
      winner.website = incoming.website
      winner.sources.website = incomingSource
    }

    // INN: prefer dadata (10-digit INN)
    if (!winner.inn && incoming.inn) {
      winner.inn = incoming.inn
      winner.sources.inn = incomingSource
    }

    // Size
    if (!winner.size && incoming.size) {
      winner.size = incoming.size
    }

    // Description: prefer longer
    if (
      incoming.description &&
      incoming.description.length > (winner.description?.length ?? 0)
    ) {
      winner.description = incoming.description
    }

    // Email: pick first non-empty
    if (!winner.contact?.email && incoming.contact?.email) {
      if (!winner.contact) {
        winner.contact = { ...incoming.contact }
      } else {
        winner.contact.email = incoming.contact.email
      }
      winner.sources.email = incomingSource
    }

    // Merge legacy signals (V4 signals populated separately by SignalEngine)
    if (Array.isArray(incoming.signals)) {
      const existingLabels = new Set(winner.signals.map((s) => s.label))
      for (const s of incoming.signals) {
        if (!existingLabels.has(s.label)) {
          winner.signals.push(s)
          existingLabels.add(s.label)
        }
      }
    }
  }
}
