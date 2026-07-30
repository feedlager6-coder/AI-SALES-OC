import { Worker, type ConnectionOptions } from 'bullmq'
import { createLogger } from '@ai-sales-os/logger'
import { getRedisConnection, QUEUES } from '@ai-sales-os/queue'
import type { EnrichCompanyPayload } from '@ai-sales-os/queue'
import { getDb, companies, enrichmentJobs } from '@ai-sales-os/db'
import { eq } from 'drizzle-orm'
import { registry } from '@ai-sales-os/plugins'
import type { ICompanyDataPlugin } from '@ai-sales-os/plugins'

const logger = createLogger({ name: 'workers:enrichment' })

export function startEnrichmentWorker() {
  const connection = getRedisConnection() as unknown as ConnectionOptions

  const worker = new Worker<EnrichCompanyPayload>(
    QUEUES.ENRICHMENT,
    async (job) => {
      const { workspaceId, companyId } = job.data
      logger.info({ event: 'enrich.start', companyId, workspaceId, jobId: job.id })

      const db = getDb()

      // Mark as in_progress
      await db
        .update(companies)
        .set({ enrichmentStatus: 'in_progress', updatedAt: new Date() })
        .where(eq(companies.id, companyId))

      // Create enrichment job record
      const [enrichmentJob] = await db
        .insert(enrichmentJobs)
        .values({
          workspaceId,
          companyId,
          status: 'in_progress',
          startedAt: new Date(),
        })
        .returning()

      const company = await db.query.companies.findFirst({
        where: eq(companies.id, companyId),
      })

      if (!company) {
        logger.warn({ event: 'enrich.company_not_found', companyId })
        return
      }

      const providersTried: Array<{ provider: string; status: string; fieldsFound: string[] }> = []

      // Try company data providers (ЕГРЮЛ, Dadata, etc.)
      const dataProviders = registry.getByCategory<ICompanyDataPlugin>('company_data')
      let enrichmentData: Record<string, unknown> = {}

      for (const provider of dataProviders) {
        if (!(await provider.isConfigured(workspaceId))) continue

        try {
          // Build params — omit optional keys if undefined (exactOptionalPropertyTypes)
          const params: { workspaceId: string; inn?: string; companyName: string } = {
            workspaceId,
            companyName: company.name,
          }
          if (company.inn) params.inn = company.inn

          const result = await provider.getCompanyData(params)

          if (result) {
            const fieldsFound = Object.keys(result).filter(
              (k) => result[k as keyof typeof result] !== undefined,
            )
            providersTried.push({ provider: provider.name, status: 'ok', fieldsFound })
            enrichmentData = { ...enrichmentData, ...result }

            // Update company with enrichment data
            await db
              .update(companies)
              .set({
                ...(result.legalName ? { legalName: result.legalName } : {}),
                ...(result.okvedCode ? { okvedCode: result.okvedCode } : {}),
                ...(result.address ? { address: result.address } : {}),
                ...(result.employeesCount ? { employeesCount: result.employeesCount } : {}),
                ...(result.revenueRub ? { revenueRub: result.revenueRub } : {}),
                updatedAt: new Date(),
              })
              .where(eq(companies.id, companyId))

            break // First successful provider wins for company data
          }
        } catch (err) {
          providersTried.push({
            provider: provider.name,
            status: 'error',
            fieldsFound: [],
          })
          logger.warn({
            event: 'enrich.provider_error',
            provider: provider.name,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      // Mark enrichment complete
      const enrichmentSources = providersTried
        .filter((p) => p.status === 'ok' && p.fieldsFound.length > 0)
        .map((p) => ({ source: p.provider, fields: p.fieldsFound, at: new Date().toISOString() }))

      await db
        .update(companies)
        .set({
          enrichmentStatus: 'done',
          enrichedAt: new Date(),
          enrichmentSources,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, companyId))

      await db
        .update(enrichmentJobs)
        .set({
          status: 'done',
          providersTried,
          results: enrichmentData,
          completedAt: new Date(),
        })
        .where(eq(enrichmentJobs.id, enrichmentJob.id))

      logger.info({ event: 'enrich.done', companyId, providers: providersTried.length })
    },
    {
      connection,
      concurrency: 5,
    },
  )

  worker.on('failed', (job, err) => {
    logger.error({
      event: 'enrich.job_failed',
      jobId: job?.id,
      error: err.message,
    })
  })

  return worker
}
