/**
 * Lead Sources API — trigger 2ГИС / HH.ru search jobs and poll their status.
 *
 * POST /api/lead-sources/search  — enqueue a scraping job
 * GET  /api/lead-sources/jobs/:jobId — poll job status
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getScrapingQueue, JOBS, makeJobId } from '@ai-sales-os/queue'
import { workspaceContextPlugin } from '../plugins/workspace-context.js'
import { createLogger } from '@ai-sales-os/logger'

const logger = createLogger({ name: 'api:lead-sources' })

const SearchSchema = z.object({
  source: z.enum(['2gis', 'hhru']),
  city: z.string().min(1).max(100),
  industry: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  limit: z.number().int().min(1).max(200).default(50),
})

export const leadSourcesRoutes: FastifyPluginAsync = async (app) => {
  await app.register(workspaceContextPlugin)

  /** POST /api/lead-sources/search — dispatch a search job */
  app.post('/search', async (request, reply) => {
    const body = SearchSchema.parse(request.body)
    const { workspaceId } = request

    const queue = getScrapingQueue()
    const jobName = body.source === '2gis' ? JOBS.SEARCH_2GIS : JOBS.SEARCH_HHRU

    const jobId = makeJobId(
      jobName,
      workspaceId,
      body.source,
      body.city,
      body.industry ?? '',
      Date.now().toString(),
    )

    let job
    if (body.source === '2gis') {
      job = await queue.add(
        jobName,
        {
          workspaceId,
          rubrics: body.keywords.length > 0 ? body.keywords : [body.industry ?? 'компания'],
          city: body.city,
          limit: body.limit,
        },
        { jobId },
      )
    } else {
      job = await queue.add(
        jobName,
        {
          workspaceId,
          industries: body.keywords.length > 0 ? body.keywords : [body.industry ?? ''],
          area: body.city,
          limit: body.limit,
        },
        { jobId },
      )
    }

    logger.info({
      event: 'lead_source.search.dispatched',
      workspaceId,
      source: body.source,
      jobId: job.id,
      city: body.city,
    })

    return reply.status(202).send({
      data: {
        jobId: job.id,
        source: body.source,
        status: 'queued',
        city: body.city,
      },
    })
  })

  /** GET /api/lead-sources/jobs/:jobId — poll job status (workspace-scoped) */
  app.get('/jobs/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string }
    const { workspaceId } = request

    const queue = getScrapingQueue()
    const job = await queue.getJob(jobId)

    if (!job) {
      return reply.status(404).send({
        error: { code: 'JOB_NOT_FOUND', message: 'Job not found', statusCode: 404 },
      })
    }

    // Authorization: verify this job belongs to the requesting workspace.
    // All scraping job payloads embed workspaceId — reject if it doesn't match.
    const jobData = job.data as { workspaceId?: string }
    if (jobData.workspaceId !== workspaceId) {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Job does not belong to this workspace', statusCode: 403 },
      })
    }

    const state = await job.getState()
    const progress = job.progress

    logger.debug({
      event: 'lead_source.job.polled',
      workspaceId,
      jobId,
      state,
    })

    return reply.send({
      data: {
        jobId: job.id,
        state,
        progress,
        result: state === 'completed' ? (job.returnvalue as unknown) : undefined,
        failedReason: state === 'failed' ? job.failedReason : undefined,
        processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : undefined,
        finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
      },
    })
  })

  /** GET /api/lead-sources/providers — list available providers */
  app.get('/providers', async (_request, reply) => {
    return reply.send({
      data: [
        {
          id: '2gis',
          name: '2ГИС',
          description: 'Поиск по справочнику 2ГИС. Подходит для поиска транспортных компаний, складов, дистрибьюторов.',
          requiresApiKey: true,
          fields: ['city', 'industry', 'keywords'],
        },
        {
          id: 'hhru',
          name: 'HH.ru',
          description: 'Поиск работодателей по HeadHunter. Сигнал роста: компании с активными вакансиями.',
          requiresApiKey: false,
          fields: ['city', 'industry', 'keywords'],
        },
      ],
    })
  })
}
