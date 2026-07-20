/**
 * Email provider webhooks.
 * Receives delivery events from Mailgun (and future providers).
 * Does NOT require workspace auth — validated by provider signature.
 *
 * POST /api/webhooks/mailgun
 *
 * Sprint 1.6 additions:
 * - "replied" event → dispatch CLASSIFY_REPLY job
 * - Campaign stats update (sent / opened / replied) via atomic jsonb_set
 */
import type { FastifyPluginAsync } from 'fastify'
import {
  getDb,
  emailSends,
  sequenceEnrollments,
  sequences,
  campaigns,
  companies,
  type EmailSend,
} from '@ai-sales-os/db'
import { and, eq, sql } from 'drizzle-orm'
import { createLogger } from '@ai-sales-os/logger'
import { registry } from '@ai-sales-os/plugins'
import type { IEmailSendingPlugin } from '@ai-sales-os/plugins'
import { getAiQueue, JOBS, makeJobId } from '@ai-sales-os/queue'

const logger = createLogger({ name: 'api:webhooks' })

// ─── Campaign stats helper ─────────────────────────────────────────────────────

/**
 * Atomically increment a campaign stats counter.
 * Resolves enrollmentId → sequenceId → campaignId.
 * Silently returns if the chain is broken (no sequence / campaign).
 */
async function incrementCampaignStat(
  enrollmentId: string,
  field: 'sent' | 'opened' | 'replied' | 'clicked',
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

// ─── Routes ───────────────────────────────────────────────────────────────────

export const webhooksRoutes: FastifyPluginAsync = async (app) => {
  /** POST /api/webhooks/mailgun — Mailgun event webhook */
  app.post('/mailgun', async (request, reply) => {
    const bodyStr = typeof request.body === 'string'
      ? request.body
      : JSON.stringify(request.body)

    // Get Mailgun plugin
    const emailPlugin = registry
      .getByCategory<IEmailSendingPlugin>('email_sending')
      .find((p) => p.name === 'mailgun')

    if (!emailPlugin) {
      logger.warn({ event: 'webhook.no_mailgun_plugin' })
      return reply.status(200).send({ ok: true })
    }

    // Validate webhook signature
    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries(request.headers)) {
      if (v !== undefined) {
        headers[k] = Array.isArray(v) ? v.join(', ') : v
      }
    }

    if (!emailPlugin.validateWebhook(headers, bodyStr)) {
      logger.warn({ event: 'webhook.invalid_signature', provider: 'mailgun' })
      return reply.status(200).send({ ok: true }) // Always 200 to avoid Mailgun retries
    }

    let webhookEvent
    try {
      webhookEvent = emailPlugin.parseWebhookEvent(request.body)
    } catch (err) {
      logger.warn({
        event: 'webhook.parse_failed',
        error: err instanceof Error ? err.message : String(err),
      })
      return reply.status(200).send({ ok: true })
    }

    const { messageId, event, timestamp, metadata } = webhookEvent

    if (!messageId) {
      logger.warn({ event: 'webhook.no_message_id', webhookEvent: event })
      return reply.status(200).send({ ok: true })
    }

    logger.info({ event: 'webhook.received', provider: 'mailgun', webhookEvent: event, messageId })

    const db = getDb()

    // Find the email send record
    const send = await db.query.emailSends.findFirst({
      where: eq(emailSends.providerId, messageId),
    })

    if (!send) {
      logger.warn({ event: 'webhook.send_not_found', messageId })
      return reply.status(200).send({ ok: true })
    }

    // Update email send based on event type
    const updates: Partial<EmailSend> = {}

    switch (event) {
      case 'delivered':
        updates.status = 'delivered'
        updates.sentAt = send.sentAt ?? timestamp
        break

      case 'opened':
        if (!send.openedAt) {
          updates.openedAt = timestamp
        }
        break

      case 'clicked':
        if (!send.clickedAt) {
          updates.clickedAt = timestamp
        }
        break

      case 'bounced':
        updates.status = 'bounced'
        if (metadata?.bounceType) {
          updates.bounceType = metadata.bounceType
        }
        break

      case 'complained':
        updates.status = 'complained'
        break

      case 'unsubscribed':
        updates.unsubscribedAt = timestamp
        break

      case 'replied':
        // Set repliedAt so workspace stats (replyRate) can count this reply
        updates.repliedAt = timestamp
        break

      default:
        break
    }

    if (Object.keys(updates).length > 0) {
      await db.update(emailSends).set(updates).where(eq(emailSends.id, send.id))
    }

    // ── Campaign stats instrumentation ──────────────────────────────────────
    if (send.enrollmentId) {
      if (event === 'delivered') {
        await incrementCampaignStat(send.enrollmentId, 'sent')
      }

      if (event === 'opened' && !send.openedAt) {
        // Only count first open per send
        await incrementCampaignStat(send.enrollmentId, 'opened')
      }

      if (event === 'clicked' && !send.clickedAt) {
        // Only count first click per send
        await incrementCampaignStat(send.enrollmentId, 'clicked')
      }
    }

    // ── Terminal enrollment events ────────────────────────────────────────────
    if (send.enrollmentId) {
      if (event === 'bounced' && metadata?.bounceType === 'hard') {
        // Fetch enrollment ONCE so we have companyId for the subsequent company update
        const enrollment = await db.query.sequenceEnrollments.findFirst({
          where: eq(sequenceEnrollments.id, send.enrollmentId),
          columns: { id: true, companyId: true },
        })

        if (enrollment) {
          await db
            .update(sequenceEnrollments)
            .set({ status: 'bounced' })
            .where(eq(sequenceEnrollments.id, enrollment.id))

          // Mark company as opted-out; filter by workspace to prevent cross-workspace mutation
          if (enrollment.companyId) {
            await db
              .update(companies)
              .set({ status: 'opted_out', updatedAt: new Date() })
              .where(
                and(
                  eq(companies.id, enrollment.companyId),
                  eq(companies.workspaceId, send.workspaceId),
                ),
              )
          }
        }
      }

      if (event === 'unsubscribed') {
        await db
          .update(sequenceEnrollments)
          .set({ status: 'unsubscribed' })
          .where(eq(sequenceEnrollments.id, send.enrollmentId))
      }

      // ── Reply event (Sprint 1.6) ───────────────────────────────────────────
      // When Mailgun detects an inbound reply, dispatch CLASSIFY_REPLY job.
      // Mailgun sends event="replied" with the reply body in metadata.
      if (event === 'replied') {
        const replyText = (metadata?.replyText as string | undefined) ??
          (metadata?.stripped?.text as string | undefined) ??
          (metadata?.body as string | undefined) ??
          ''
        const replyFrom = (metadata?.from as string | undefined) ?? send.toEmail

        const aiQueue = getAiQueue()
        const jobId = makeJobId(JOBS.CLASSIFY_REPLY, send.enrollmentId, send.id)

        await aiQueue.add(
          JOBS.CLASSIFY_REPLY,
          {
            workspaceId: send.workspaceId,
            enrollmentId: send.enrollmentId,
            emailSendId: send.id,
            replyText,
            replyFrom,
          },
          {
            jobId,
            // Priority classification: process within 10 seconds
            attempts: 2,
            backoff: { type: 'fixed', delay: 5000 },
          },
        )

        logger.info({
          event: 'webhook.reply_classify_queued',
          enrollmentId: send.enrollmentId,
          sendId: send.id,
        })
      }
    }

    logger.info({ event: 'webhook.processed', webhookEvent: event, sendId: send.id })
    return reply.status(200).send({ ok: true })
  })
}
