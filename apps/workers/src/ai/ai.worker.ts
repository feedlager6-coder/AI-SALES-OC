import { Worker, type ConnectionOptions } from 'bullmq'
import { createLogger } from '@ai-sales-os/logger'
import { getRedisConnection, QUEUES, JOBS } from '@ai-sales-os/queue'
import type { GenerateEmailPayload, ClassifyReplyPayload } from '@ai-sales-os/queue'

const logger = createLogger({ name: 'workers:ai' })

export function startAiWorker() {
  const connection = getRedisConnection() as unknown as ConnectionOptions

  const worker = new Worker<GenerateEmailPayload | ClassifyReplyPayload>(
    QUEUES.AI,
    async (job) => {
      if (job.name === JOBS.GENERATE_EMAIL) {
        const payload = job.data as GenerateEmailPayload
        logger.info({ event: 'ai.generate_start', enrollmentId: payload.enrollmentId })
        // TODO Sprint 1.6: implement Writer Agent via Vercel AI SDK
      }

      if (job.name === JOBS.CLASSIFY_REPLY) {
        const payload = job.data as ClassifyReplyPayload
        logger.info({ event: 'ai.classify_start', enrollmentId: payload.enrollmentId })
        // TODO Sprint 1.6: implement Reply Classifier Agent
      }
    },
    {
      connection,
      concurrency: 3, // AI calls are expensive, keep concurrency low
    },
  )

  worker.on('failed', (job, err) => {
    logger.error({ event: 'ai.job_failed', jobId: job?.id, error: err.message })
  })

  return worker
}
