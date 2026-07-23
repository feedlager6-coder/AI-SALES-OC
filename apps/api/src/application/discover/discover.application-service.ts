/**
 * DiscoverApplicationService — единственная точка входа для Discover Flow.
 *
 * Архитектура вызовов:
 *
 *   UI (Discover page)
 *    ↓ POST /api/v1/hunts/:id/search
 *   Route handler (hunts.ts)  ← только валидация + HTTP
 *    ↓ execute({ huntId, workspaceId })
 *   DiscoverApplicationService          ← ВСЯ бизнес-логика здесь
 *    ↓ getHunt / updateStatus
 *   HuntService                         ← персистентность Hunt
 *    ↓ search(hunt)
 *   SearchOrchestrator                  ← провайдеры → merge → dedup
 *    ↓
 *   RankingEngine                       ← скоринг и сортировка
 *    ↓
 *   DiscoverResult → Route → HTTP 200
 *
 * Будущие этапы добавляются ТОЛЬКО здесь — UI и Routes не меняются:
 *
 *   execute(input)
 *    ↓ (текущие шаги)
 *    ↓ IntentParser          ← Sprint: реальный LLM-парсер
 *    ↓ SearchOrchestrator    ← уже реализовано
 *    ↓ RankingEngine         ← уже реализовано
 *    ↓ EnrichmentPipeline    ← Sprint: Dadata / Hunter / Snov
 *    ↓ Writer                ← Sprint: persist companies to DB
 *    ↓ ActivityQueue         ← Sprint: очередь задач «Сегодня»
 *    ↓ Inbox                 ← Sprint: входящие ответы
 *
 * Принципы:
 *   • Этот класс не знает про HTTP (нет FastifyRequest/Reply).
 *   • HuntService, SearchOrchestrator принимаются через конструктор →
 *     легко тестировать с заглушками.
 *   • Публичный интерфейс (execute signature + DiscoverResult) не меняется
 *     при добавлении новых шагов внутри.
 */

import { createLogger } from '@ai-sales-os/logger'
import type { HuntService } from '../../services/hunt.service.js'
import type { SearchOrchestrator } from '../../search/search-orchestrator.js'
import type { SearchResult } from '../../search/types.js'

const logger = createLogger({ name: 'application:discover' })

// ─── Input / Output ───────────────────────────────────────────────────────────

export interface DiscoverExecuteInput {
  huntId: string
  workspaceId: string
}

export interface DiscoverResult {
  /** Стабильный идентификатор запущенного Hunt. */
  huntId: string
  /** Ранжированные результаты поиска. */
  result: SearchResult
}

// ─── Domain errors (без знания о HTTP) ───────────────────────────────────────

export class HuntNotFoundError extends Error {
  readonly huntId: string
  constructor(huntId: string) {
    super(`Hunt ${huntId} not found`)
    this.name = 'HuntNotFoundError'
    this.huntId = huntId
  }
}

export class SearchFailedError extends Error {
  constructor(cause?: unknown) {
    super('Search failed — all providers returned errors')
    this.name = 'SearchFailedError'
    if (cause instanceof Error) {
      this.cause = cause
    }
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class DiscoverApplicationService {
  constructor(
    private readonly huntService: HuntService,
    private readonly searchOrchestrator: SearchOrchestrator,
  ) {}

  /**
   * Выполняет полный Discover Flow для существующего Hunt.
   *
   * Шаги (текущая реализация):
   *   1. Загрузить Hunt и проверить принадлежность workspace.
   *   2. Перевести статус в 'searching'.
   *   3. Запустить SearchOrchestrator (провайдеры → merge → dedup → rank).
   *   4. Перевести статус в 'completed' (или 'failed' при ошибке).
   *   5. Вернуть DiscoverResult.
   *
   * Ошибки:
   *   HuntNotFoundError  — Hunt не существует или принадлежит другому workspace.
   *   SearchFailedError  — все провайдеры вернули ошибки.
   */
  async execute(input: DiscoverExecuteInput): Promise<DiscoverResult> {
    const { huntId, workspaceId } = input

    // ── Шаг 1: Загрузить и проверить Hunt ────────────────────────────────────
    const huntRow = await this.huntService.getHunt(huntId, workspaceId)
    if (!huntRow) {
      throw new HuntNotFoundError(huntId)
    }

    // ── Шаг 2: Перевести в 'searching' ───────────────────────────────────────
    await this.huntService.updateStatus(huntId, workspaceId, 'searching')

    // Сформировать SearchHunt из DB-строки (intentJson — JSONB, нужна безопасная типизация)
    const rawIntent = (huntRow.intentJson ?? {}) as Record<string, unknown>
    const searchHunt = {
      id: huntRow.id,
      rawQuery: huntRow.rawQuery,
      intentJson: {
        industry:         typeof rawIntent['industry']         === 'string' ? rawIntent['industry']         : null,
        region:           typeof rawIntent['region']           === 'string' ? rawIntent['region']           : null,
        companySize:      typeof rawIntent['companySize']      === 'string' ? rawIntent['companySize']      : null,
        clarifyingAnswer: typeof rawIntent['clarifyingAnswer'] === 'string' ? rawIntent['clarifyingAnswer'] : null,
      },
    }

    // ── Шаг 3: SearchOrchestrator ─────────────────────────────────────────────
    let searchResult: SearchResult
    try {
      searchResult = await this.searchOrchestrator.search(searchHunt)
    } catch (err: unknown) {
      logger.error({
        event: 'discover.search.failed',
        huntId,
        error: err instanceof Error ? err.message : String(err),
      })

      // Шаг 4b: перевести в 'failed' (best-effort, не маскирует исходную ошибку)
      await this.huntService.updateStatus(huntId, workspaceId, 'failed').catch(() => undefined)

      throw new SearchFailedError(err)
    }

    // ── Шаг 4a: Перевести в 'completed' ──────────────────────────────────────
    await this.huntService.updateStatus(huntId, workspaceId, 'completed')

    logger.info({
      event: 'discover.completed',
      huntId,
      totalFound: searchResult.totalFound,
    })

    // ── Шаг 5: Вернуть результат ──────────────────────────────────────────────
    return { huntId, result: searchResult }

    /*
     * ── БУДУЩИЕ ШАГИ (добавлять сюда, UI и Routes не меняются) ──────────────
     *
     * // Шаг 6: EnrichmentPipeline
     * const enriched = await this.enrichmentPipeline.enrich(searchResult.companies)
     *
     * // Шаг 7: Writer — persist companies to DB
     * await this.companyWriter.write(enriched, workspaceId)
     *
     * // Шаг 8: ActivityQueue — поставить задачи «Сегодня»
     * await this.activityQueue.schedule(enriched, workspaceId)
     *
     * // Шаг 9: Inbox — инициализировать входящие для кампаний
     * await this.inboxService.prepare(huntId, workspaceId)
     */
  }
}
