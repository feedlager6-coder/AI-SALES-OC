/**
 * DiscoverApplicationService — единственная точка входа для Discover Flow.
 *
 * V4 pipeline:
 *   UI (Discover page)
 *    ↓ POST /api/v1/hunts/:id/search
 *   Route handler (hunts.ts)  ← только валидация + HTTP
 *    ↓ execute({ huntId, workspaceId })
 *   DiscoverApplicationService          ← ВСЯ бизнес-логика здесь
 *    ↓ getHunt / updateStatus
 *   HuntService                         ← персистентность Hunt
 *    ↓ search(hunt, workspaceId)
 *   SearchOrchestratorImpl V4           ← тир1+2 параллельно → dedup → сигналы → ранжирование
 *    ↓
 *   DiscoverResult (SearchResultV4) → Route → HTTP 200
 */

import { eq, and } from 'drizzle-orm'
import { getDb, hunts } from '@ai-sales-os/db'
import { createLogger } from '@ai-sales-os/logger'
import type { HuntService } from '../../services/hunt.service.js'
import type { SearchOrchestrator } from '../../search/search-orchestrator.js'
import type { SearchResultV4, SignalType } from '../../search/types.js'

const logger = createLogger({ name: 'application:discover' })

// ─── Input / Output ───────────────────────────────────────────────────────────

export interface DiscoverExecuteInput {
  huntId:      string
  workspaceId: string
}

export interface DiscoverResult {
  /** Стабильный идентификатор запущенного Hunt. */
  huntId: string
  /** Ранжированные V4 результаты поиска. */
  result: SearchResultV4
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
    private readonly huntService:        HuntService,
    private readonly searchOrchestrator: SearchOrchestrator,
  ) {}

  /**
   * Выполняет полный Discover Flow V4 для существующего Hunt.
   *
   * Шаги:
   *   1. Загрузить Hunt и проверить принадлежность workspace.
   *   2. Перевести статус в 'searching'.
   *   3. Запустить SearchOrchestratorImpl V4.
   *   4. Сохранить SearchPlanSummary в hunts.search_plan_summary.
   *   5. Перевести статус в 'completed' (или 'failed' при ошибке).
   *   6. Вернуть DiscoverResult.
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

    // Сформировать SearchHunt из DB-строки
    const rawIntent = (huntRow.intentJson ?? {}) as Record<string, unknown>

    // signals_wanted / exclude_signals — optional arrays stored in intentJson by the
    // LLM intent interpreter. Validate shape before passing downstream.
    const rawWanted  = rawIntent['signals_wanted']
    const rawExclude = rawIntent['exclude_signals']
    // Cast to SignalType[] — values were written by the LLM intent parser which uses
    // the same SignalType union. Validated at runtime by the ICP calculator (unknown
    // types simply produce no match).
    const signalsWanted  = Array.isArray(rawWanted)  ? (rawWanted  as SignalType[]) : undefined
    const excludeSignals = Array.isArray(rawExclude) ? (rawExclude as SignalType[]) : undefined

    const searchHunt = {
      id:       huntRow.id,
      rawQuery: huntRow.rawQuery,
      intentJson: {
        industry:         typeof rawIntent['industry']         === 'string' ? rawIntent['industry']         : null,
        region:           typeof rawIntent['region']           === 'string' ? rawIntent['region']           : null,
        companySize:      typeof rawIntent['companySize']      === 'string' ? rawIntent['companySize']      : null,
        clarifyingAnswer: typeof rawIntent['clarifyingAnswer'] === 'string' ? rawIntent['clarifyingAnswer'] : null,
        // Propagate user signal preferences so ICPScoreCalculator can apply boosts/penalties
        ...(signalsWanted  && signalsWanted.length  > 0 ? { signals_wanted:  signalsWanted  } : {}),
        ...(excludeSignals && excludeSignals.length > 0 ? { exclude_signals: excludeSignals } : {}),
      },
    }

    // ── Шаг 3: SearchOrchestrator V4 ─────────────────────────────────────────
    let searchResult: SearchResultV4
    try {
      searchResult = await this.searchOrchestrator.search(searchHunt, workspaceId)
    } catch (err: unknown) {
      logger.error({
        event:  'discover.search.failed',
        huntId,
        error:  err instanceof Error ? err.message : String(err),
      })

      await this.huntService.updateStatus(huntId, workspaceId, 'failed').catch(() => undefined)
      throw new SearchFailedError(err)
    }

    // ── Шаг 4: Сохранить SearchPlanSummary в hunt ─────────────────────────────
    try {
      const db = getDb()
      await db
        .update(hunts)
        .set({ searchPlanSummary: searchResult.plan, updatedAt: new Date() })
        .where(and(eq(hunts.id, huntId), eq(hunts.workspaceId, workspaceId)))
    } catch (err: unknown) {
      // Non-critical — plan summary is informational, don't block response
      logger.warn({
        event:  'discover.plan_summary_save_failed',
        huntId,
        error:  err instanceof Error ? err.message : String(err),
      })
    }

    // ── Шаг 5: Перевести в 'completed' ───────────────────────────────────────
    await this.huntService.updateStatus(huntId, workspaceId, 'completed')

    logger.info({
      event:      'discover.completed',
      huntId,
      totalFound: searchResult.totalFound,
      processingMs: searchResult.plan.processingMs,
    })

    // ── Шаг 6: Вернуть результат ──────────────────────────────────────────────
    return { huntId, result: searchResult }
  }
}
