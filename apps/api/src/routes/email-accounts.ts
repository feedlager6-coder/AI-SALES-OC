/**
 * Email Accounts API
 * Manages SMTP/Mailgun sending accounts per workspace.
 * Credentials are stored AES-256-GCM encrypted.
 *
 * GET    /api/email-accounts
 * POST   /api/email-accounts
 * GET    /api/email-accounts/:id
 * PATCH  /api/email-accounts/:id
 * DELETE /api/email-accounts/:id
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, eq, desc } from 'drizzle-orm'
import { getDb, emailAccounts } from '@ai-sales-os/db'
import { workspaceContextPlugin } from '../plugins/workspace-context.js'
import { NotFoundError } from '@ai-sales-os/errors'
import { createLogger } from '@ai-sales-os/logger'
import { getEnv } from '@ai-sales-os/config'
import { createCipheriv, randomBytes } from 'node:crypto'

const logger = createLogger({ name: 'api:email-accounts' })

// ─── Encryption helpers ───────────────────────────────────────────────────────

function encryptCredentials(plaintext: string): string {
  const env = getEnv()
  const key = Buffer.from(env.ENCRYPTION_KEY, 'hex')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: iv(12):tag(16):ciphertext — all hex
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const CredentialsSchema = z.object({
  apiKey: z.string().min(1).optional(),
  domain: z.string().min(1).optional(),
  smtpHost: z.string().min(1).optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().min(1).optional(),
  smtpPassword: z.string().min(1).optional(),
  smtpSecure: z.boolean().optional(),
})

const CreateEmailAccountSchema = z.object({
  email: z.string().email(),
  displayName: z.string().max(255).optional(),
  provider: z.enum(['mailgun', 'brevo', 'ses', 'smtp']),
  credentials: CredentialsSchema,
  dailyLimit: z.number().int().min(1).max(2000).default(50),
})

const UpdateEmailAccountSchema = z.object({
  displayName: z.string().max(255).optional(),
  credentials: CredentialsSchema.optional(),
  dailyLimit: z.number().int().min(1).max(2000).optional(),
  isActive: z.boolean().optional(),
})

export const emailAccountsRoutes: FastifyPluginAsync = async (app) => {
  await app.register(workspaceContextPlugin)

  /** GET /api/email-accounts — list workspace email accounts */
  app.get('/', async (request, reply) => {
    const db = getDb()
    const rows = await db
      .select({
        id: emailAccounts.id,
        email: emailAccounts.email,
        displayName: emailAccounts.displayName,
        provider: emailAccounts.provider,
        dailyLimit: emailAccounts.dailyLimit,
        warmupStatus: emailAccounts.warmupStatus,
        reputationScore: emailAccounts.reputationScore,
        isActive: emailAccounts.isActive,
        createdAt: emailAccounts.createdAt,
      })
      .from(emailAccounts)
      .where(eq(emailAccounts.workspaceId, request.workspaceId))
      .orderBy(desc(emailAccounts.createdAt))

    return reply.send({ data: rows })
  })

  /** POST /api/email-accounts — add an email account */
  app.post('/', async (request, reply) => {
    const body = CreateEmailAccountSchema.parse(request.body)
    const db = getDb()

    // Encrypt credentials
    const encrypted = encryptCredentials(JSON.stringify(body.credentials))

    const [account] = await db
      .insert(emailAccounts)
      .values({
        workspaceId: request.workspaceId,
        email: body.email,
        provider: body.provider,
        credentialsEncrypted: encrypted,
        dailyLimit: body.dailyLimit,
        ...(body.displayName ? { displayName: body.displayName } : {}),
      })
      .returning({
        id: emailAccounts.id,
        email: emailAccounts.email,
        displayName: emailAccounts.displayName,
        provider: emailAccounts.provider,
        dailyLimit: emailAccounts.dailyLimit,
        isActive: emailAccounts.isActive,
        createdAt: emailAccounts.createdAt,
      })

    logger.info({ event: 'email_account.created', accountId: account.id, workspaceId: request.workspaceId })
    return reply.status(201).send({ data: account })
  })

  /** GET /api/email-accounts/:id — single account (no credentials in response) */
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = getDb()

    const account = await db.query.emailAccounts.findFirst({
      where: and(
        eq(emailAccounts.id, id),
        eq(emailAccounts.workspaceId, request.workspaceId),
      ),
      columns: {
        credentialsEncrypted: false,
      },
    })

    if (!account) throw new NotFoundError('Email account not found')
    return reply.send({ data: account })
  })

  /** PATCH /api/email-accounts/:id — update account */
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateEmailAccountSchema.parse(request.body)
    const db = getDb()

    const existing = await db.query.emailAccounts.findFirst({
      where: and(
        eq(emailAccounts.id, id),
        eq(emailAccounts.workspaceId, request.workspaceId),
      ),
    })
    if (!existing) throw new NotFoundError('Email account not found')

    const [updated] = await db
      .update(emailAccounts)
      .set({
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.dailyLimit !== undefined ? { dailyLimit: body.dailyLimit } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.credentials !== undefined
          ? { credentialsEncrypted: encryptCredentials(JSON.stringify(body.credentials)) }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(emailAccounts.id, id))
      .returning({
        id: emailAccounts.id,
        email: emailAccounts.email,
        displayName: emailAccounts.displayName,
        provider: emailAccounts.provider,
        dailyLimit: emailAccounts.dailyLimit,
        isActive: emailAccounts.isActive,
        updatedAt: emailAccounts.updatedAt,
      })

    logger.info({ event: 'email_account.updated', accountId: id, workspaceId: request.workspaceId })
    return reply.send({ data: updated })
  })

  /** DELETE /api/email-accounts/:id — remove account */
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = getDb()

    const existing = await db.query.emailAccounts.findFirst({
      where: and(
        eq(emailAccounts.id, id),
        eq(emailAccounts.workspaceId, request.workspaceId),
      ),
    })
    if (!existing) throw new NotFoundError('Email account not found')

    await db.delete(emailAccounts).where(eq(emailAccounts.id, id))

    logger.info({ event: 'email_account.deleted', accountId: id, workspaceId: request.workspaceId })
    return reply.status(204).send()
  })
}
