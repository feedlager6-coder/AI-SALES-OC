/**
 * Email provider webhooks.
 * Receives delivery events from Mailgun (and future providers).
 * Does NOT require workspace auth — validated by provider signature.
 *
 * POST /api/webhooks/mailgun
 */
import type { FastifyPluginAsync } from 'fastify'
import { getDb, emailSends, sequenceEnrollments, companies, type EmailSend } from '@ai-sales-os/db'
import { eq } from 'drizzle-orm'
import { createLogger } from '@ai-sales-os/logger'
import { registry } from '@ai-sales-os/plugins'
import type { IEmailSendingPlugin } from '@ai-sales-os/plugins'

const logger = createLogger({ name: 'api:webhooks' })

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
      logger.warn({ event: 'webhook.parse_failed', error: err instanceof Error ? err.message : String(err) })
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
    }

    if (Object.keys(updates).length > 0) {
      await db.update(emailSends).set(updates).where(eq(emailSends.id, send.id))
    }

    // Update enrollment status for terminal events
    if (send.enrollmentId) {
      if (event === 'bounced' && metadata?.bounceType === 'hard') {
        await db
          .update(sequenceEnrollments)
          .set({ status: 'bounced' })
          .where(eq(sequenceEnrollments.id, send.enrollmentId))

        // Mark company as opted-out on hard bounce
        if (send.contactId) {
          // Look up company via enrollment
          const enrollment = await db.query.sequenceEnrollments.findFirst({
            where: eq(sequenceEnrollments.id, send.enrollmentId),
          })
          if (enrollment?.companyId) {
            await db
              .update(companies)
              .set({ status: 'opted_out', updatedAt: new Date() })
              .where(eq(companies.id, enrollment.companyId))
          }
        }
      }

      if (event === 'unsubscribed') {
        await db
          .update(sequenceEnrollments)
          .set({ status: 'unsubscribed' })
          .where(eq(sequenceEnrollments.id, send.enrollmentId))
      }
    }

    logger.info({ event: 'webhook.processed', webhookEvent: event, sendId: send.id })
    return reply.status(200).send({ ok: true })
  })
}
