/**
 * AI worker — Sprint 1.6.
 * Processes GENERATE_EMAIL and CLASSIFY_REPLY jobs from the AI queue.
 *
 * Both handlers delegate to shared ai-helpers which own the OpenAI logic
 * and keyword-based fallbacks.
 */
import { Worker, type ConnectionOptions } from 'bullmq'
import { and, eq, sql } from 'drizzle-orm'
import { getDb, sequenceEnrollments, aiLogs, sequences, campaigns, emailSends } from '@ai-sales-os/db'
import { createLogger } from '@ai-sales-os/logger'
import { getRedisConnection, QUEUES, JOBS } from '@ai-sales-os/queue'
import type { GenerateEmailPayload, ClassifyReplyPayload } from '@ai-sales-os/queue'
import { generatePersonalisedEmail, classifyReplyText } from '../shared/ai-helpers.js'

const logger = createLogger({ name: 'workers:ai' })

// ─── Campaign stats helper ─────────────────────────────────────────────────────

/**
 * Atomically increment a campaign stats counter for an enrollment.
 * Resolves enrollmentId → sequenceId → campaignId.
 */
async function incrementCampaignStat(
  enrollmentId: string,
  field: 'sent' | 'opened' | 'replied',
): Promise<void> {
  const db = getDb()
  const enrollment = await db.query.sequenceEnrollments.findFirst({
    where: eq(sequenceEnrollments.id, enrollmentId),
    columns: { sequenceId: true },
  })
  if (!enrollment?.sequenceId) return

  const sequence = await db.query.sequences.findFirst({
    where: eq(sequences.id, enrollment.sequenceId),
    columns: { campaignId: true },
  })
  if (!sequence?.campaignId) return

  await db
    .update(campaigns)
    .set({
      stats: sql`jsonb_set(
        stats,
        ${sql.raw(`'{${field}}'`)},
        to_jsonb(COALESCE((stats->>'${field}')::int, 0) + 1)
      )`,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, sequence.campaignId))
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export function startAiWorker() {
  const connection = getRedisConnection() as unknown as ConnectionOptions

  const worker = new Worker<GenerateEmailPayload | ClassifyReplyPayload>(
    QUEUES.AI,
    async (job) => {
      // ── Generate Email ──────────────────────────────────────────────────────
      if (job.name === JOBS.GENERATE_EMAIL) {
        const payload = job.data as GenerateEmailPayload
        logger.info({ event: 'ai.generate_start', enrollmentId: payload.enrollmentId })

        const generated = await generatePersonalisedEmail(
          payload.companyId,
          payload.templateSubject,
          payload.templateBody,
          payload.enrollmentId,
        )

        const db = getDb()
        const model = generated.usedAI ? 'gpt-4o-mini' : 'template-fallback'

        await db.insert(aiLogs).values({
          workspaceId: payload.workspaceId,
          agent: 'writer',
          model,
          provider: generated.usedAI ? 'openai' : 'none',
          entityType: 'enrollment',
          entityId: payload.enrollmentId,
          outputPreview: generated.subject.slice(0, 300),
        })

        logger.info({
          event: 'ai.generate_done',
          enrollmentId: payload.enrollmentId,
          subject: generated.subject,
          usedAI: generated.usedAI,
        })

        return generated
      }

      // ── Classify Reply ──────────────────────────────────────────────────────
      if (job.name === JOBS.CLASSIFY_REPLY) {
        const payload = job.data as ClassifyReplyPayload
        logger.info({ event: 'ai.classify_start', enrollmentId: payload.enrollmentId })

        const { classification, usedAI } = await classifyReplyText(
          payload.replyText,
          payload.replyFrom,
          payload.enrollmentId,
        )

        const db = getDb()

        // Update enrollment with classification
        // Stop sequence on definitive positive/negative replies
        const shouldStopSequence =
          classification === 'interested' ||
          classification === 'not_interested'

        await db
          .update(sequenceEnrollments)
          .set({
            replyClassification: classification,
            replyAt: new Date(),
            ...(shouldStopSequence ? { status: 'replied' } : {}),
          })
          .where(
            and(
              eq(sequenceEnrollments.id, payload.enrollmentId),
              eq(sequenceEnrollments.workspaceId, payload.workspaceId),
            ),
          )

        // Set repliedAt on the email send record so workspace stats (replyRate)
        // can accurately count replies via emailSends.repliedAt
        if (payload.emailSendId) {
          await db
            .update(emailSends)
            .set({ repliedAt: new Date() })
            .where(
              and(
                eq(emailSends.id, payload.emailSendId),
                eq(emailSends.workspaceId, payload.workspaceId),
              ),
            )
        }

        // Increment campaign replied counter
        await incrementCampaignStat(payload.enrollmentId, 'replied')

        // Log to AI audit trail
        await db.insert(aiLogs).values({
          workspaceId: payload.workspaceId,
          agent: 'classifier',
          model: usedAI ? 'gpt-4o-mini' : 'keyword-fallback',
          provider: usedAI ? 'openai' : 'none',
          entityType: 'enrollment',
          entityId: payload.enrollmentId,
          outputPreview: classification,
        })

        logger.info({
          event: 'ai.classify_done',
          enrollmentId: payload.enrollmentId,
          classification,
          usedAI,
          stopped: shouldStopSequence,
        })

        return { classification }
      }

      // Unknown job type — log and skip
      logger.warn({ event: 'ai.unknown_job', jobName: job.name })
      return null
    },
    {
      connection,
      concurrency: 3,
    },
  )

  worker.on('failed', (job, err) => {
    logger.error({ event: 'ai.job_failed', jobId: job?.id, error: err.message })
  })

  return worker
}
