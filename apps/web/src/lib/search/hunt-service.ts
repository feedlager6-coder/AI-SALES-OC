/**
 * HuntService — единственная точка входа для поиска в UI.
 *
 * Принимает список SearchProvider через конструктор (dependency injection).
 * Запускает все провайдеры параллельно и объединяет результаты.
 *
 * Сегодня: один MockSearchProvider.
 * Завтра: добавить TwoGISProvider, HHProvider и т.д. — UI не меняется.
 *
 * Порядок объединения: результаты идут в том же порядке, что и providers[].
 * Дубликаты по id удаляются (первый провайдер имеет приоритет).
 */

import type { SearchProvider } from './search-provider'
import type { SearchParams, SearchResult } from './types'
import { MockSearchProvider } from './mock-search-provider'

export class HuntService {
  constructor(private readonly providers: SearchProvider[]) {
    if (providers.length === 0) {
      throw new Error('HuntService requires at least one SearchProvider')
    }
  }

  async search(params: SearchParams): Promise<SearchResult> {
    // Run all providers in parallel — failure-tolerant: one provider crashing
    // does not block results from the others.
    const settlements = await Promise.allSettled(
      this.providers.map((provider) => provider.search(params)),
    )

    // Log failures; collect successful results in provider order.
    const successfulResults = settlements.flatMap((settlement, i) => {
      if (settlement.status === 'rejected') {
        console.error(
          `[HuntService] Provider "${this.providers[i]!.name}" failed:`,
          settlement.reason,
        )
        return []
      }
      return [settlement.value]
    })

    if (successfulResults.length === 0) {
      throw new Error('All search providers failed. Please try again.')
    }

    // Merge and deduplicate by company id (first occurrence wins).
    const seen = new Set<string>()
    const companies = successfulResults
      .flatMap((r) => r.companies)
      .filter((company) => {
        if (seen.has(company.id)) return false
        seen.add(company.id)
        return true
      })

    return {
      companies,
      totalFound: companies.length,
      query: params,
    }
  }
}

// ─── Default singleton ────────────────────────────────────────────────────────
//
// To swap providers for the whole app, change this one line.
// To override per-component (e.g. in tests), instantiate HuntService directly.
//
export const huntService = new HuntService([new MockSearchProvider()])
