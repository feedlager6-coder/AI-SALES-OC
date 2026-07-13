import { Worker, type ConnectionOptions } from 'bullmq'
import { createLogger } from '@ai-sales-os/logger'
import { getRedisConnection, QUEUES } from '@ai-sales-os/queue'
import type { SendEmailPayload } from '@ai-sales-os/queue'

const logger = createLogger({ name: 'workers:email' })

export function startEmailWorker() {
  const connection = getRedisConnection() as unknown as ConnectionOptions

  const worker = new Worker<SendEmailPayload>(
    QUEUES.EMAIL,
    async (job) => {
      const { workspaceId, enrollmentId, stepNumber } = job.data
      logger.info({ event: 'email.send_start', enrollmentId, stepNumber, workspaceId })

      // TODO Sprint 1.4: implement email sending
      // 1. Load enrollment + sequence step
      // 2. Check sent_today counter in Redis (RISK-001: atomic INCR)
      // 3. Call email sending plugin (Mailgun/Brevo)
      // 4. Record EmailSend
      // 5. Schedule next step via email-queue

      logger.info({ event: 'email.send_done', enrollmentId, stepNumber })
    },
    {
      connection,
      concurrency: 10,
    },
  )

  worker.on('failed', (job, err) => {
    logger.error({ event: 'email.job_failed', jobId: job?.id, error: err.message })
  })

  return worker
}
