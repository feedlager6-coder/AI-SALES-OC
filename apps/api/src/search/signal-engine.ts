/**
 * SignalEngine — extracts V4 Signal objects from raw SearchCompany data.
 *
 * Signal sources handled here (Pass 2):
 *   • 2GIS: new_business if company recently registered (foundedYear < 1 yr)
 *   • 2GIS: growing if description mentions growth keywords
 *   • Legacy CompanySignal array → mapped to V4 Signal
 *
 * Pass 3–4 will add: HH.ru vacancies → hiring, Dadata → leadership_change,
 * Госзакупки → contract_won / contract_active, ФССП → financial_risk.
 */

import { createLogger } from '@ai-sales-os/logger'
import type { SearchCompany, Signal, SignalType } from './types.js'
import { SIGNAL_WEIGHTS, SOURCE_CONFIDENCE } from './types.js'

const logger = createLogger({ name: 'api:signal-engine' })

// Keywords that suggest growth in company descriptions
const GROWTH_KEYWORDS = [
  'расширяем', 'расширение', 'рост', 'растём', 'открываем', 'новый офис',
  'новые проекты', 'развиваем', 'развитие', 'масштабирование', 'увеличение',
]

const HIRING_KEYWORDS = [
  'ищем', 'вакансия', 'требуется', 'нанимаем', 'набираем', 'трудоустройство',
]

// Legacy signal type → V4 SignalType mapping
const LEGACY_SIGNAL_MAP: Record<string, SignalType> = {
  growing:      'growing',
  expanding:    'expanding',
  hiring:       'hiring',
  funding:      'funding',
  new_business: 'new_business',
  news_event:   'news_event',
  client_fit:   'client_fit',
  contract_won:     'contract_won',
  contract_active:  'contract_active',
  leadership_change: 'leadership_change',
}

export class SignalEngine {
  /**
   * Extract V4 Signal[] from a raw SearchCompany.
   * Always returns an array (empty if no signals detected).
   */
  extractSignals(company: SearchCompany, detectedAt: Date = new Date()): Signal[] {
    const signals: Signal[] = []

    try {
      // ── 1. Map legacy CompanySignal[] to V4 Signal ─────────────────────────
      if (Array.isArray(company.signals)) {
        for (const legacy of company.signals) {
          const v4Type = LEGACY_SIGNAL_MAP[legacy.type]
          if (!v4Type) continue

          signals.push({
            type:        v4Type,
            label:       legacy.label,
            source:      '2gis', // legacy signals come from 2GIS or mock
            eventDate:   null,   // legacy has no event date
            detectedAt,
            weight:      SIGNAL_WEIGHTS[v4Type],
            confidence:  SOURCE_CONFIDENCE['2gis'],
            metadata:    null,
          })
        }
      }

      // ── 2. New business signal — recently founded ───────────────────────────
      if (company.foundedYear !== undefined && company.foundedYear !== null) {
        const currentYear = detectedAt.getFullYear()
        const yearsOld    = currentYear - company.foundedYear

        if (yearsOld <= 1) {
          // Founded within the last year — strong new_business signal
          const alreadyHas = signals.some((s) => s.type === 'new_business')
          if (!alreadyHas) {
            const foundedDate = new Date(company.foundedYear, 0, 1) // Jan 1 of founded year
            signals.push({
              type:       'new_business',
              label:      `Компания основана в ${company.foundedYear} — новый игрок на рынке`,
              source:     '2gis',
              eventDate:  foundedDate,
              detectedAt,
              weight:     SIGNAL_WEIGHTS['new_business'],
              confidence: SOURCE_CONFIDENCE['2gis'],
              metadata:   { foundedYear: company.foundedYear, yearsOld },
            })
          }
        }
      }

      // ── 3. Growth signals from description keywords ─────────────────────────
      if (company.description && company.description.trim().length > 0) {
        const desc = company.description.toLowerCase()

        const hasGrowthKeyword = GROWTH_KEYWORDS.some((kw) => desc.includes(kw))
        if (hasGrowthKeyword) {
          const alreadyHas = signals.some((s) => s.type === 'growing')
          if (!alreadyHas) {
            signals.push({
              type:       'growing',
              label:      'Признаки роста в описании компании',
              source:     '2gis',
              eventDate:  null,
              detectedAt,
              weight:     SIGNAL_WEIGHTS['growing'],
              confidence: 40, // low confidence — keyword match
              metadata:   null,
            })
          }
        }

        const hasHiringKeyword = HIRING_KEYWORDS.some((kw) => desc.includes(kw))
        if (hasHiringKeyword) {
          const alreadyHas = signals.some((s) => s.type === 'hiring')
          if (!alreadyHas) {
            signals.push({
              type:       'hiring',
              label:      'Компания упоминает найм в описании',
              source:     '2gis',
              eventDate:  null,
              detectedAt,
              weight:     SIGNAL_WEIGHTS['hiring'],
              confidence: 35, // low confidence — keyword match
              metadata:   null,
            })
          }
        }
      }
    } catch (err: unknown) {
      logger.warn({
        event:     'signal_engine.extraction_error',
        companyId: company.id,
        error:     err instanceof Error ? err.message : String(err),
      })
    }

    return signals
  }
}
