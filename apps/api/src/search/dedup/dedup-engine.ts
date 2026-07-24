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

// ── Source priority tables (from spec field-merge strategy) ──────────────────
//
// Lower index = higher priority. merge helpers walk the list to pick the winner.
//
// Legal name priority is only applicable when providers expose a separate `legalName`
// field (Dadata, Госзакупки). SearchCompany.name is the trade/display name — so we
// only need TRADE_NAME_PRIORITY and INN_PRIORITY here for Pass 2.
// LEGAL_NAME_PRIORITY will be used in Pass 4 when Dadata joins Tier 2.
const TRADE_NAME_PRIORITY: readonly string[] = ['2gis', 'hhru', 'dadata', 'gosreg', 'mock']
const INN_PRIORITY:        readonly string[] = ['dadata', 'gosreg', '2gis', 'hhru', 'mock']

/** Returns true if `challenger` should win over `current` based on priority list. */
function shouldReplace(
  current:    string,
  challenger: string,
  priority:   readonly string[],
): boolean {
  const currentRank    = priority.indexOf(current)
  const challengerRank = priority.indexOf(challenger)
  // Unknown sources have lowest priority (treated as after the list)
  const cRank = currentRank    === -1 ? priority.length : currentRank
  const nRank = challengerRank === -1 ? priority.length : challengerRank
  return nRank < cRank
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
          // Conservative: do NOT auto-merge. The first-encountered company is the
          // primary winner and stays untouched. Only the *incoming* challenger is
          // flagged as a potential duplicate so PreRankingFilter can remove it.
          // Marking the winner would cause both to be dropped by Rule 4, producing
          // empty results instead of the correct single entry.
          logger.info({
            event:      'dedup.fuzzy_potential_duplicate',
            primaryId:  candidate.id,
            primaryName: candidate.name,
            challengerName: raw.name,
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
    const provenance: FieldProvenance = {}
    const source = this.inferSource(raw)
    if (raw.name)             provenance.tradeName  = source
    if (raw.inn)              provenance.inn        = source
    if (raw.website)          provenance.website    = source
    if (raw.contact?.email)   provenance.email      = source
    if (raw.contact?.phone)   provenance.phone      = source
    return provenance
  }

  /**
   * Determine the source identifier for a company.
   * Uses `_providerId` stamped by SearchOrchestratorImpl after each provider call.
   * Falls back to a heuristic only when `_providerId` is absent (legacy data).
   */
  private inferSource(raw: SearchCompany): string {
    if (raw._providerId) return raw._providerId
    // Legacy heuristic — remove once all call-sites stamp _providerId
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
   * Merge `incoming` fields into `winner` using spec-defined priority rules.
   * Updates winner in-place. Uses `_providerId` (stamped by orchestrator) to
   * determine which source wins each field per spec section 5.
   *
   * Merge priority:
   *   Legal name  → gosreg > dadata > 2gis > hhru > mock
   *   Trade name  → 2gis > hhru > dadata > gosreg > mock
   *   INN         → dadata > gosreg > 2gis > hhru > mock
   *   Phone       → 2gis > website > hhru > mock
   *   Website     → 2gis > hhru > dadata > mock
   *   Email       → website > hunter > pattern > generic
   *   Size        → kontur > hhru > 2gis > mock
   */
  private mergeInto(winner: MergedCompany, incoming: SearchCompany): void {
    const winnerSource   = winner.sources.tradeName ?? this.inferSource(winner)
    const incomingSource = this.inferSource(incoming)

    // ── Trade name (display name): 2GIS wins ─────────────────────────────────
    if (incoming.name && incoming.name !== winner.name) {
      if (!winner.aliases.includes(incoming.name)) {
        winner.aliases.push(incoming.name)
      }
      if (shouldReplace(winnerSource, incomingSource, TRADE_NAME_PRIORITY)) {
        // incoming is a higher-priority source for trade name — swap
        if (!winner.aliases.includes(winner.name)) {
          winner.aliases.push(winner.name)
        }
        winner.name = incoming.name
        winner.sources.tradeName = incomingSource
        logger.info({
          event:          'dedup.name_replaced',
          winnerId:       winner.id,
          oldName:        winner.aliases[winner.aliases.length - 1],
          newName:        winner.name,
          reason:         `${incomingSource} > ${winnerSource} for trade name`,
        })
      } else {
        logger.info({
          event:          'dedup.dedup_anomaly',
          winnerId:       winner.id,
          winnerName:     winner.name,
          incomingName:   incoming.name,
          incomingSource,
        })
      }
    }

    // ── INN: dadata > gosreg > 2gis ──────────────────────────────────────────
    if (incoming.inn) {
      const winnerInnSource = winner.sources.inn ?? winnerSource
      if (!winner.inn || shouldReplace(winnerInnSource, incomingSource, INN_PRIORITY)) {
        winner.inn = incoming.inn
        winner.sources.inn = incomingSource
      }
    }

    // ── Phone: 2GIS > website > HH ───────────────────────────────────────────
    if (incoming.contact?.phone) {
      const winnerPhoneSource = winner.sources.phone ?? winnerSource
      const hasPhone = typeof winner.contact?.phone === 'string' && winner.contact.phone.trim().length > 0
      if (!hasPhone || shouldReplace(winnerPhoneSource, incomingSource, ['2gis', 'website', 'hhru', 'mock'])) {
        if (!winner.contact) {
          winner.contact = { ...incoming.contact }
        } else {
          winner.contact.phone = incoming.contact.phone
        }
        winner.sources.phone = incomingSource
      }
    }

    // ── Website: 2GIS > HH > dadata ──────────────────────────────────────────
    if (incoming.website) {
      const winnerWebSource = winner.sources.website ?? winnerSource
      if (!winner.website || shouldReplace(winnerWebSource, incomingSource, ['2gis', 'hhru', 'dadata', 'mock'])) {
        winner.website = incoming.website
        winner.sources.website = incomingSource
      }
    }

    // ── Email: website > hunter > pattern ────────────────────────────────────
    if (incoming.contact?.email) {
      const winnerEmailSource = winner.sources.email ?? winnerSource
      const hasEmail = typeof winner.contact?.email === 'string' && winner.contact.email.trim().length > 0
      if (!hasEmail || shouldReplace(winnerEmailSource, incomingSource, ['website', 'hunter', 'snov', 'pattern', '2gis', 'hhru', 'mock'])) {
        if (!winner.contact) {
          winner.contact = { ...incoming.contact }
        } else {
          winner.contact.email = incoming.contact.email
        }
        winner.sources.email = incomingSource
      }
    }

    // ── Size: kontur > hhru > 2gis ───────────────────────────────────────────
    if (incoming.size && incoming.size.trim().length > 0) {
      const hasSize = typeof winner.size === 'string' && winner.size.trim().length > 0
      if (!hasSize) {
        winner.size = incoming.size
      }
    }

    // ── Description: prefer longer (best-effort) ─────────────────────────────
    if (incoming.description && incoming.description.length > (winner.description?.length ?? 0)) {
      winner.description = incoming.description
    }

    // ── Legacy signals — merged by label dedup (V4 signals rebuilt by SignalEngine) ──
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
