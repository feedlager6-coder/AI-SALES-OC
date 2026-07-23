/**
 * Hunt routes — тонкий HTTP-слой для Discover Flow.
 *
 * POST   /api/v1/hunts            — создать Hunt (draft)
 * GET    /api/v1/hunts/:id        — получить Hunt по ID
 * PATCH  /api/v1/hunts/:id/status — изменить статус Hunt
 * POST   /api/v1/hunts/:id/search — запустить Discover Flow, вернуть SearchResult
 *
 * Архитектура вызовов:
 *
 *   Frontend (Discover page)
 *    ↓ POST /api/v1/hunts/:id/search
 *   Route handler (этот файл) ← только валидация + HTTP-ответ
 *    ↓ discoverApplicationService.execute({ huntId, workspaceId })
 *   DiscoverApplicationService  ← вся бизнес-логика
 *    ↓
 *   HuntService → SearchOrchestrator → RankingEngine
 *    ↓
 *   SearchResult JSON → Frontend
 *
 * Правило: route handler не содержит бизнес-логики.
 * Всё, что связано с Hunt lifecycle и поиском, живёт в
 * DiscoverApplicationService (apps/api/src/application/discover/).
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { huntService } from '../services/hunt.service.js'
import { workspaceContextPlugin } from '../plugins/workspace-context.js'
import {
  discoverApplicationService,
  HuntNotFoundError,
  SearchFailedError,
} from '../application/discover/index.js'
import { createLogger } from '@ai-sales-os/logger'

const logger = createLogger({ name: 'api:hunts-route' })

// ─── Validation schemas ───────────────────────────────────────────────────────

const IntentJsonSchema = z.object({
  industry:         z.string().nullable().default(null),
  region:           z.string().nullable().default(null),
  companySize:      z.string().nullable().default(null),
  clarifyingAnswer: z.string().nullable().default(null),
})

const CreateHuntBodySchema = z.object({
  rawQuery:   z.string().min(1).max(1000),
  intentJson: IntentJsonSchema.optional().default({}),
})

const UpdateStatusBodySchema = z.object({
  status: z.enum(['draft', 'confirmed', 'searching', 'completed', 'failed']),
})

// ─── Routes ───────────────────────────────────────────────────────────────────

export const huntsRoutes: FastifyPluginAsync = async (app) => {
  await app.register(workspaceContextPlugin)

  /**
   * POST /api/v1/hunts
   * Create a new Hunt in 'draft' status from the user's confirmed intent.
   */
  app.post('/', async (request, reply) => {
    const { rawQuery, intentJson } = CreateHuntBodySchema.parse(request.body)
    const { workspaceId, userId } = request

    const hunt = await huntService.createHunt({
      workspaceId,
      userId,
      rawQuery,
      intentJson: {
        industry:         intentJson.industry,
        region:           intentJson.region,
        companySize:      intentJson.companySize,
        clarifyingAnswer: intentJson.clarifyingAnswer,
      },
    })

    return reply.status(201).send({ data: hunt })
  })

  /**
   * GET /api/v1/hunts/:id
   * Fetch a Hunt by ID. Returns 404 if not found in this workspace.
   */
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { workspaceId } = request

    const hunt = await huntService.getHunt(id, workspaceId)
    if (!hunt) {
      return reply.status(404).send({
        error: { code: 'HUNT_NOT_FOUND', message: 'Hunt not found', statusCode: 404 },
      })
    }

    return reply.status(200).send({ data: hunt })
  })

  /**
   * PATCH /api/v1/hunts/:id/status
   * Advance a Hunt to the next status.
   */
  app.patch('/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { status } = UpdateStatusBodySchema.parse(request.body)
    const { workspaceId } = request

    const hunt = await huntService.updateStatus(id, workspaceId, status)
    return reply.status(200).send({ data: hunt })
  })

  /**
   * POST /api/v1/hunts/:id/search
   *
   * Запускает Discover Flow и возвращает ранжированные результаты.
   *
   * Route handler отвечает только за:
   *   • валидацию параметров запроса
   *   • делегирование в DiscoverApplicationService
   *   • маппинг доменных ошибок в HTTP-коды
   *
   * Бизнес-логика (Hunt lifecycle, SearchOrchestrator, RankingEngine)
   * живёт в DiscoverApplicationService — не здесь.
   */
  app.post('/:id/search', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { workspaceId } = request

    try {
      const { result } = await discoverApplicationService.execute({ huntId: id, workspaceId })
      return reply.status(200).send({ data: result })
    } catch (err: unknown) {
      if (err instanceof HuntNotFoundError) {
        return reply.status(404).send({
          error: { code: 'HUNT_NOT_FOUND', message: 'Hunt not found', statusCode: 404 },
        })
      }
      if (err instanceof SearchFailedError) {
        logger.error({ event: 'hunt.search.failed', huntId: id, error: err.message })
        return reply.status(502).send({
          error: { code: 'SEARCH_FAILED', message: 'Search failed — all providers returned errors.', statusCode: 502 },
        })
      }
      throw err
    }
  })
}
