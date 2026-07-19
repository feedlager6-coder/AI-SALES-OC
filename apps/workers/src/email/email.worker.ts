/**
 * Email sending worker.
 * Processes SEND_EMAIL jobs from the email queue.
 *
 * Flow per job:
 * 1. Load enrollment + sequence step from DB
 * 2. Check sent_today counter in Redis (RISK-001: atomic INCR, not DB column)
 * 3. Call email sending plugin (Mailgun/Brevo)
 * 4. Record EmailSend in DB
 * 5. Update enrollment currentStep
 * 6. Schedule next step (or mark enrollment completed)
 */
import { Worker, type ConnectionOptions } from 'bullmq'
import { createLogger } from '@ai-sales-os/logger'
import {
  getRedisConnection,
  getEmailQueue,
  QUEUES,
  JOBS,
  makeJobId,
  type SendEmailPayload,
  type ScheduleSequenceStepPayload,
} from '@ai-sales-os/queue'
import {
  getDb,
  emailSends,
  emailAccounts,
  sequenceEnrollments,
  sequences,
  contacts,
} from '@ai-sales-os/db'
import { eq, and } from 'drizzle-orm'
import { registry } from '@ai-sales-os/plugins'
import type { IEmailSendingPlugin } from '@ai-sales-os/plugins'

const logger = createLogger({ name: 'workers:email' })

const REDIS_SENT_TODAY_PREFIX = 'sent_today'
const MAX_DAILY_LIMIT_BUFFER = 5 // Safety buffer below hard limit

// ─── Sent-today counter (RISK-001) ────────────────────────────────────────────

async function checkAndIncrementSentToday(
  emailAccountId: string,
  dailyLimit: number,
): Promise<boolean> {
  const redis = getRedisConnection()
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const key = `${REDIS_SENT_TODAY_PREFIX}:${emailAccountId}:${today}`

  // INCR is atomic — safe under concurrency
  const newCount = await redis.incr(key)

  // Set TTL on first write (expire at end of day + buffer)
  if (newCount === 1) {
    await redis.expire(key, 86400 + 3600) // 25h to be safe
  }

  if (newCount > dailyLimit - MAX_DAILY_LIMIT_BUFFER) {
    // Decrement back — we're over limit
    await redis.decr(key)
    return false
  }

  return true
}

// ─── Sequence step type ───────────────────────────────────────────────────────

interface SequenceStep {
  stepNumber: number
  type: 'email' | 'wait'
  subject?: string
  bodyHtml?: string
  bodyText?: string
  delayDays?: number
  delayHours?: number
  stopOnReply?: boolean
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export function startEmailWorker() {
  const connection = getRedisConnection() as unknown as ConnectionOptions

  const worker = new Worker<SendEmailPayload | ScheduleSequenceStepPayload>(
    QUEUES.EMAIL,
    async (job) => {
      // Handle SCHEDULE_SEQUENCE_STEP — dispatches the next SEND_EMAIL job
      if (job.name === JOBS.SCHEDULE_SEQUENCE_STEP) {
        const payload = job.data as ScheduleSequenceStepPayload
        await scheduleNextStep(payload)
        return
      }

      // Handle SEND_EMAIL
      if (job.name === JOBS.SEND_EMAIL) {
        const payload = job.data as SendEmailPayload
        await sendEmail(payload)
        return
      }

      logger.warn({ event: 'email.unknown_job', jobName: job.name })
    },
    {
      connection,
      concurrency: 10,
    },
  )

  worker.on('failed', (job, err) => {
    logger.error({
      event: 'email.job_failed',
      jobId: job?.id,
      jobName: job?.name,
      error: err.message,
    })
  })

  return worker
}

// ─── Send email implementation ────────────────────────────────────────────────

async function sendEmail(payload: SendEmailPayload): Promise<void> {
  const { workspaceId, enrollmentId, stepNumber, contactId, emailAccountId, scheduledAt } = payload

  logger.info({ event: 'email.send_start', enrollmentId, stepNumber, workspaceId })

  const db = getDb()

  // Load enrollment
  const enrollment = await db.query.sequenceEnrollments.findFirst({
    where: and(
      eq(sequenceEnrollments.id, enrollmentId),
      eq(sequenceEnrollments.workspaceId, workspaceId),
    ),
  })

  if (!enrollment) {
    logger.warn({ event: 'email.enrollment_not_found', enrollmentId })
    return
  }

  // Skip if enrollment is no longer active
  if (enrollment.status !== 'active') {
    logger.info({ event: 'email.enrollment_inactive', enrollmentId, status: enrollment.status })
    return
  }

  // Load sequence
  if (!enrollment.sequenceId) {
    logger.warn({ event: 'email.no_sequence', enrollmentId })
    return
  }

  const sequence = await db.query.sequences.findFirst({
    where: eq(sequences.id, enrollment.sequenceId),
  })

  if (!sequence) {
    logger.warn({ event: 'email.sequence_not_found', sequenceId: enrollment.sequenceId })
    return
  }

  const steps = sequence.steps as SequenceStep[]
  const step = steps.find((s) => s.stepNumber === stepNumber)

  if (!step) {
    logger.warn({ event: 'email.step_not_found', stepNumber, sequenceId: sequence.id })
    return
  }

  if (step.type === 'wait') {
    // Pure wait step — just advance to next
    await scheduleNextStep({ workspaceId, enrollmentId, nextStep: stepNumber + 1, scheduledAt })
    return
  }

  // Load email account
  const account = await db.query.emailAccounts.findFirst({
    where: and(
      eq(emailAccounts.id, emailAccountId),
      eq(emailAccounts.workspaceId, workspaceId),
    ),
  })

  if (!account || !account.isActive) {
    logger.warn({ event: 'email.account_inactive', emailAccountId })
    return
  }

  // Check daily limit (RISK-001: Redis INCR)
  const withinLimit = await checkAndIncrementSentToday(emailAccountId, account.dailyLimit)
  if (!withinLimit) {
    logger.warn({
      event: 'email.daily_limit_reached',
      emailAccountId,
      dailyLimit: account.dailyLimit,
    })
    // Re-queue for next day (24h delay)
    const queue = getEmailQueue()
    await queue.add(JOBS.SEND_EMAIL, payload, {
      delay: 24 * 60 * 60 * 1000,
      jobId: makeJobId(JOBS.SEND_EMAIL, enrollmentId, String(stepNumber), 'retry-next-day'),
    })
    return
  }

  // Load contact info
  const contact = contactId
    ? await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) })
    : null

  // Build send params
  const toEmail = contact?.email ?? ''
  if (!toEmail) {
    logger.warn({ event: 'email.no_recipient_email', enrollmentId, contactId })
    // Mark enrollment as stopped (no contact email)
    await db
      .update(sequenceEnrollments)
      .set({ status: 'stopped' })
      .where(eq(sequenceEnrollments.id, enrollmentId))
    return
  }

  const toName = contact?.fullName ?? contact?.firstName ?? undefined
  const subject = step.subject ?? '(no subject)'
  const bodyHtml = step.bodyHtml ?? '<p>(empty)</p>'
  const bodyText = step.bodyText

  // Create EmailSend record (status: queued)
  const [sendRecord] = await db
    .insert(emailSends)
    .values({
      workspaceId,
      enrollmentId,
      contactId: contactId ?? null,
      stepNumber,
      subject,
      bodyHtml,
      ...(bodyText ? { bodyText } : {}),
      fromEmail: account.email,
      toEmail,
      provider: account.provider,
      status: 'queued',
    })
    .returning()

  // Get email sending plugin
  const emailPlugin = registry
    .getByCategory<IEmailSendingPlugin>('email_sending')
    .find((p) => p.name === account.provider)

  if (!emailPlugin) {
    logger.error({ event: 'email.no_plugin', provider: account.provider })
    await db
      .update(emailSends)
      .set({ status: 'bounced' })
      .where(eq(emailSends.id, sendRecord.id))
    return
  }

  const isConfigured = await emailPlugin.isConfigured(workspaceId)
  if (!isConfigured) {
    logger.error({ event: 'email.plugin_not_configured', provider: account.provider })
    return
  }

  try {
    const fromName = account.displayName ?? account.email
    const result = await emailPlugin.send({
      from: { email: account.email, name: fromName },
      to: { email: toEmail, ...(toName ? { name: toName } : {}) },
      subject,
      htmlBody: bodyHtml,
      ...(bodyText ? { textBody: bodyText } : {}),
      tags: ['ai-sales-os', `enrollment:${enrollmentId}`, `step:${stepNumber}`],
      trackingEnabled: true,
    })

    // Update EmailSend with provider message ID
    await db
      .update(emailSends)
      .set({
        providerId: result.messageId || null,
        status: result.status === 'rejected' ? 'bounced' : 'sent',
        sentAt: new Date(),
      })
      .where(eq(emailSends.id, sendRecord.id))

    // Advance enrollment step counter
    await db
      .update(sequenceEnrollments)
      .set({ currentStep: stepNumber })
      .where(eq(sequenceEnrollments.id, enrollmentId))

    logger.info({
      event: 'email.sent',
      enrollmentId,
      stepNumber,
      messageId: result.messageId,
      to: toEmail,
    })

    // Schedule next step
    await scheduleNextStep({ workspaceId, enrollmentId, nextStep: stepNumber + 1, scheduledAt })

  } catch (err) {
    logger.error({
      event: 'email.send_error',
      enrollmentId,
      stepNumber,
      error: err instanceof Error ? err.message : String(err),
    })

    await db
      .update(emailSends)
      .set({ status: 'bounced' })
      .where(eq(emailSends.id, sendRecord.id))

    throw err // Let BullMQ handle retry with exponential backoff
  }
}

// ─── Schedule next step ───────────────────────────────────────────────────────

async function scheduleNextStep(payload: ScheduleSequenceStepPayload): Promise<void> {
  const { workspaceId, enrollmentId, nextStep } = payload

  const db = getDb()

  const enrollment = await db.query.sequenceEnrollments.findFirst({
    where: and(
      eq(sequenceEnrollments.id, enrollmentId),
      eq(sequenceEnrollments.workspaceId, workspaceId),
    ),
  })

  if (!enrollment || enrollment.status !== 'active') {
    return
  }

  if (!enrollment.sequenceId) return

  const sequence = await db.query.sequences.findFirst({
    where: eq(sequences.id, enrollment.sequenceId),
  })

  if (!sequence) return

  const steps = sequence.steps as SequenceStep[]
  const nextStepDef = steps.find((s) => s.stepNumber === nextStep)

  if (!nextStepDef) {
    // No more steps — enrollment complete
    await db
      .update(sequenceEnrollments)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(sequenceEnrollments.id, enrollmentId))

    logger.info({ event: 'email.enrollment_completed', enrollmentId })
    return
  }

  // Calculate delay
  let delayMs = 0
  if (nextStepDef.type === 'wait') {
    const days = nextStepDef.delayDays ?? 0
    const hours = nextStepDef.delayHours ?? 0
    delayMs = (days * 24 + hours) * 60 * 60 * 1000

    // After the wait step, schedule the following email step
    const afterWaitStep = steps.find((s) => s.stepNumber === nextStep + 1)
    if (!afterWaitStep) {
      // Wait is the last step — complete enrollment
      await db
        .update(sequenceEnrollments)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(sequenceEnrollments.id, enrollmentId))
      return
    }
  }

  const scheduledAt = new Date(Date.now() + delayMs).toISOString()

  // Load the email account to use — take workspace default (first active account)
  const account = await db.query.emailAccounts.findFirst({
    where: and(
      eq(emailAccounts.workspaceId, workspaceId),
      eq(emailAccounts.isActive, true),
    ),
  })

  if (!account) {
    logger.warn({ event: 'email.no_active_account', workspaceId })
    return
  }

  const queue = getEmailQueue()
  const jobId = makeJobId(JOBS.SEND_EMAIL, enrollmentId, String(nextStep))

  await queue.add(
    JOBS.SEND_EMAIL,
    {
      workspaceId,
      enrollmentId,
      stepNumber: nextStep,
      contactId: enrollment.contactId ?? '',
      emailAccountId: account.id,
      scheduledAt,
    },
    {
      jobId,
      delay: delayMs,
    },
  )

  logger.info({
    event: 'email.next_step_scheduled',
    enrollmentId,
    nextStep,
    delayMs,
    scheduledAt,
  })
}
