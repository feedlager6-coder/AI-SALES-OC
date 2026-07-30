/**
 * Scraping worker — processes SEARCH_2GIS and SEARCH_HHRU jobs.
 * Calls the appropriate lead source plugin, then upserts companies into the DB.
 */
import { Worker, type ConnectionOptions } from 'bullmq'
import { createLogger } from '@ai-sales-os/logger'
import { getRedisConnection, QUEUES, JOBS } from '@ai-sales-os/queue'
import type { Search2GISPayload, SearchHHRuPayload } from '@ai-sales-os/queue'
import { getDb, companies } from '@ai-sales-os/db'
import { eq, and } from 'drizzle-orm'
import { registry } from '@ai-sales-os/plugins'
import type { ILeadSourcePlugin, LeadSearchParams } from '@ai-sales-os/plugins'
import type { CompanyStatus } from '@ai-sales-os/types'
import { computeIcpScore, icpScoreToStatus } from '../shared/icp-scoring.js'

const logger = createLogger({ name: 'workers:scraping' })

export interface ScrapingJobResult {
  source: string
  companiesFound: number
  companiesImported: number
  companiesSkipped: number
}

export function startScrapingWorker() {
  const connection = getRedisConnection() as unknown as ConnectionOptions

  const worker = new Worker<Search2GISPayload | SearchHHRuPayload>(
    QUEUES.SCRAPING,
    async (job) => {
      const isHHRu = job.name === JOBS.SEARCH_HHRU
      const source = isHHRu ? 'hhru' : '2gis'
      const pluginName = source
      const data = job.data

      logger.info({
        event: 'scraping.start',
        jobId: job.id,
        source,
        workspaceId: data.workspaceId,
      })

      const plugin = registry.get<ILeadSourcePlugin>(pluginName)

      if (!(await plugin.isConfigured(data.workspaceId))) {
        const msg = `Lead source plugin "${source}" is not configured — required API key is missing`
        logger.error({
          event: 'scraping.plugin_not_configured',
          source,
          workspaceId: data.workspaceId,
        })
        // Throw so BullMQ marks the job as failed with a clear reason shown in the UI
        throw new Error(msg)
      }

      // Build search params
      const searchParams: LeadSearchParams = { workspaceId: data.workspaceId }

      if (isHHRu) {
        const hhPayload = data as SearchHHRuPayload
        if (hhPayload.industries?.length) searchParams.industry = hhPayload.industries
        if (hhPayload.area) searchParams.city = [hhPayload.area]
        if (hhPayload.limit) searchParams.limit = hhPayload.limit
      } else {
        const gisPayload = data as Search2GISPayload
        if (gisPayload.rubrics?.length) searchParams.keywords = gisPayload.rubrics
        if (gisPayload.city) searchParams.city = [gisPayload.city]
        if (gisPayload.limit) searchParams.limit = gisPayload.limit
      }

      const result = await plugin.search(searchParams)

      logger.info({
        event: 'scraping.results',
        source,
        workspaceId: data.workspaceId,
        count: result.companies.length,
        totalEstimate: result.totalEstimate,
      })

      const db = getDb()
      let imported = 0
      let skipped = 0

      // Update progress
      await job.updateProgress(10)

      const batchSize = 10
      for (let i = 0; i < result.companies.length; i += batchSize) {
        const batch = result.companies.slice(i, i + batchSize)

        for (const raw of batch) {
          try {
            // Deduplicate by INN (if available) or sourceId
            let existing = null

            if (raw.inn) {
              existing = await db.query.companies.findFirst({
                where: and(
                  eq(companies.workspaceId, data.workspaceId),
                  eq(companies.inn, raw.inn),
                ),
                columns: { id: true },
              })
            }

            if (existing) {
              skipped++
              continue
            }

            // Compute ICP score
            const icpScore = computeIcpScore({
              industry: raw.industry ?? null,
              city: raw.city ?? null,
              employeesCount: raw.employeesCount ?? null,
            })
            const status = icpScoreToStatus(icpScore) as CompanyStatus

            const newCompany: {
              workspaceId: string
              name: string
              source: '2gis' | 'hhru'
              icpScore: number
              status: CompanyStatus
              enrichmentStatus: 'pending'
              inn?: string
              city?: string
              industry?: string
              website?: string
              employeesCount?: string
              phones?: string[]
            } = {
              workspaceId: data.workspaceId,
              name: raw.name,
              source: source as '2gis' | 'hhru',
              icpScore,
              status,
              enrichmentStatus: 'pending',
            }

            // Only set optional fields if they have values
            if (raw.inn) newCompany.inn = raw.inn
            if (raw.city) newCompany.city = raw.city
            if (raw.industry) newCompany.industry = raw.industry
            if (raw.website) newCompany.website = raw.website
            if (raw.employeesCount) newCompany.employeesCount = raw.employeesCount
            if (raw.phone) newCompany.phones = [raw.phone]

            await db.insert(companies).values(newCompany)
            imported++
          } catch (err) {
            logger.warn({
              event: 'scraping.company_insert_error',
              name: raw.name,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        }

        // Update progress
        const pct = Math.round(10 + (i / result.companies.length) * 90)
        await job.updateProgress(pct)
      }

      await job.updateProgress(100)

      const jobResult: ScrapingJobResult = {
        source,
        companiesFound: result.companies.length,
        companiesImported: imported,
        companiesSkipped: skipped,
      }

      logger.info({
        event: 'scraping.done',
        jobId: job.id,
        workspaceId: data.workspaceId,
        companiesFound: jobResult.companiesFound,
        companiesImported: jobResult.companiesImported,
        companiesSkipped: jobResult.companiesSkipped,
      })

      return jobResult
    },
    {
      connection,
      concurrency: 2, // Max 2 simultaneous scraping jobs
    },
  )

  worker.on('failed', (job, err) => {
    logger.error({
      event: 'scraping.job_failed',
      jobId: job?.id,
      error: err.message,
    })
  })

  return worker
}
