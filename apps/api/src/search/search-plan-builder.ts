/**
 * SearchPlanBuilder — maps a search intent to a tiered provider execution plan.
 *
 * Tier 1: Directory providers — 2GIS, HH.ru (run immediately, in parallel)
 * Tier 2: Registry providers — Dadata, Госзакупки, ФССП (run concurrently with Tier 1)
 * Tier 3: Async providers — website scraping (run after HTTP response)
 *
 * The plan is used by SearchOrchestratorV4 to schedule provider calls
 * and to build SearchPlanSummary for the response.
 */

import type { SearchPlan } from './types.js'
import type { SearchHunt } from './search-provider.js'

// ── Industry → 2GIS rubric mapping (extend as needed) ─────────────────────────

const INDUSTRY_TO_2GIS_RUBRICS: Record<string, string[]> = {
  транспорт:      ['Транспортные компании', 'Грузоперевозки', 'Логистика'],
  логистика:      ['Логистика', 'Грузоперевозки', 'Транспортные компании'],
  строительство:  ['Строительные компании', 'Строительство'],
  производство:   ['Производственные предприятия', 'Завод', 'Производство'],
  торговля:       ['Торговые компании', 'Оптовая торговля'],
  it:             ['IT-компании', 'Разработка ПО', 'Информационные технологии'],
  медицина:       ['Медицинские центры', 'Клиники'],
  образование:    ['Образование', 'Учебные центры'],
  финансы:        ['Финансовые компании', 'Банки', 'Страхование'],
  ресторан:       ['Рестораны', 'Кафе', 'Общественное питание'],
  недвижимость:   ['Недвижимость', 'Агентства недвижимости'],
}

function getRubricsForIndustry(industry: string | null): string[] {
  if (!industry) return []
  const key = industry.trim().toLowerCase()
  for (const [k, rubrics] of Object.entries(INDUSTRY_TO_2GIS_RUBRICS)) {
    if (key.includes(k) || k.includes(key)) return rubrics
  }
  // Return the industry itself as rubric if no mapping found
  return [industry]
}

export class SearchPlanBuilder {
  /**
   * Build a SearchPlan from a SearchHunt.
   * Provider IDs match the providerId registered in ProviderRegistry.
   */
  build(hunt: SearchHunt): SearchPlan {
    const intent   = hunt.intentJson
    const rubrics  = getRubricsForIndustry(intent.industry)
    const region   = intent.region ?? ''

    const tier1Query: Record<string, unknown> = {
      query:   intent.industry ?? hunt.rawQuery,
      region,
      rubrics,
    }

    return {
      tier1: [
        {
          providerId: 'mock',
          tier:       1,
          query:      tier1Query,
        },
        {
          providerId: '2gis',
          tier:       1,
          query:      tier1Query,
        },
      ],

      tier2: [
        // Dadata and Госзакупки will be added in Pass 4
        // Placeholders for plan summary only
      ],

      tier3: [
        // Website scraping — added in Pass 5
      ],
    }
  }
}
