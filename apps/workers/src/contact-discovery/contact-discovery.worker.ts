/**
 * ContactDiscoveryWorker — processes DISCOVER_CONTACTS jobs from contact-discovery-queue.
 *
 * For each company in the payload, runs a condensed contact waterfall
 * (Dadata → Hunter → Snov → Pattern → Generic) and writes results to
 * companies.contacts in DB.
 *
 * This handles companies 11–50 from search results (top-10 are processed
 * synchronously in SearchOrchestratorImpl before the HTTP response is sent).
 */
import { Worker, type ConnectionOptions } from 'bullmq'
import { eq } from 'drizzle-orm'
import { createLogger } from '@ai-sales-os/logger'
import { getRedisConnection, QUEUES, JOBS } from '@ai-sales-os/queue'
import type { ContactDiscoveryPayload } from '@ai-sales-os/queue'
import { getDb, companies } from '@ai-sales-os/db'
import { DadataPlugin, HunterPlugin, SnovPlugin, PatternEmailFinderPlugin } from '@ai-sales-os/plugins'

const logger = createLogger({ name: 'workers:contact-discovery' })

// ─── Inline type (mirrors ContactCandidate from search/types.ts) ──────────────
// Defined inline to avoid cross-app imports; must stay in sync with the API type.

interface ContactCandidate {
  name: string | null
  role: string | null
  email: string
  emailVerified: boolean
  phone: string | null
  source: 'dadata' | 'website' | 'hhru' | 'hunter' | 'snov' | 'pattern' | 'generic'
  confidence: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDomain(website: string | null | undefined): string | null {
  if (!website) return null
  try {
    const url = website.startsWith('http') ? website : `https://${website}`
    const hostname = new URL(url).hostname
    return hostname.replace(/^www\./, '') || null
  } catch {
    const cleaned = website
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      ?.trim()
    return cleaned?.length ? cleaned : null
  }
}

const ROLE_CONFIDENCE_MAP: Array<{ patterns: RegExp[]; confidence: number }> = [
  { patterns: [/генеральный директор/i, /ceo/i, /chief executive/i], confidence: 90 },
  { patterns: [/коммерческий директор/i, /commercial director/i], confidence: 85 },
  { patterns: [/директор/i, /director/i, /руководитель/i], confidence: 80 },
  { patterns: [/менеджер по продажам/i, /sales manager/i], confidence: 60 },
  { patterns: [/hr/i, /рекрутер/i], confidence: 30 },
]

function roleConfidence(role: string | null): number | null {
  if (!role) return null
  for (const entry of ROLE_CONFIDENCE_MAP) {
    if (entry.patterns.some((p) => p.test(role))) return entry.confidence
  }
  return null
}

function effectiveConfidence(c: ContactCandidate): number {
  const roleCf = roleConfidence(c.role)
  if (roleCf !== null) return c.emailVerified ? Math.min(100, roleCf + 15) : roleCf
  return c.emailVerified ? Math.min(100, c.confidence + 10) : c.confidence
}

function rankCandidates(candidates: ContactCandidate[]): ContactCandidate[] {
  const seen = new Map<string, ContactCandidate>()
  for (const c of candidates) {
    const key = c.email.toLowerCase().trim()
    const existing = seen.get(key)
    if (!existing || effectiveConfidence(c) > effectiveConfidence(existing)) {
      seen.set(key, c)
    }
  }
  return [...seen.values()]
    .map((c) => ({ candidate: c, eff: effectiveConfidence(c) }))
    .sort((a, b) => b.eff - a.eff)
    .slice(0, 3)
    .map(({ candidate, eff }) => ({ ...candidate, confidence: eff }))
}

// ─── Contact discovery waterfall ──────────────────────────────────────────────

async function discoverContacts(
  company: { id: string; name: string; inn: string | null; website: string | null },
  workspaceId: string,
): Promise<ContactCandidate[]> {
  const dadata = new DadataPlugin()
  const hunter = new HunterPlugin()
  const snov = new SnovPlugin()
  const pattern = new PatternEmailFinderPlugin()

  const candidates: ContactCandidate[] = []

  // Step 1: Dadata — director name
  try {
    const params: { workspaceId: string; inn?: string; companyName: string } = {
      workspaceId: 'system',
      companyName: company.name,
    }
    if (company.inn) params.inn = company.inn
    const result = await dadata.getCompanyData(params)
    if (result?.directorName && result.status !== 'liquidated') {
      candidates.push({
        name: result.directorName,
        role: 'Генеральный директор',
        email: '',
        emailVerified: false,
        phone: null,
        source: 'dadata',
        confidence: 70,
      })
    }
  } catch {
    // Continue to next step
  }

  const domain = extractDomain(company.website)
  const hasHighQuality = candidates.some(
    (c) => c.confidence >= 80 && c.emailVerified && c.email,
  )

  if (!hasHighQuality && domain) {
    // Step 4: Hunter — domain search with email verification
    if (await hunter.isConfigured(workspaceId)) {
      try {
        const result = await hunter.findEmail({ workspaceId, domain })
        const allEmails =
          result.allEmails ??
          (result.email ? [{ email: result.email, confidence: result.confidence }] : [])
        for (const entry of allEmails) {
          const verified = result.verificationStatus === 'valid'
          const name = [entry.firstName, entry.lastName].filter(Boolean).join(' ') || null
          candidates.push({
            name: name ?? null,
            role: entry.title ?? null,
            email: entry.email,
            emailVerified: verified,
            phone: null,
            source: 'hunter',
            confidence: verified ? 75 : 40,
          })
        }
      } catch {
        // Continue
      }
    }

    // Step 5: Snov — fallback to Hunter's DB
    if (await snov.isConfigured(workspaceId)) {
      try {
        const result = await snov.findEmail({ workspaceId, domain })
        const allEmails =
          result.allEmails ??
          (result.email ? [{ email: result.email, confidence: result.confidence }] : [])
        for (const entry of allEmails) {
          const verified = result.verificationStatus === 'valid'
          const name = [entry.firstName, entry.lastName].filter(Boolean).join(' ') || null
          candidates.push({
            name: name ?? null,
            role: entry.title ?? null,
            email: entry.email,
            emailVerified: verified,
            phone: null,
            source: 'snov',
            confidence: verified ? 65 : 45,
          })
        }
      } catch {
        // Continue
      }
    }

    // Step 6: Pattern — generate firstname@domain for known directors
    for (const c of candidates.filter((cc) => cc.source === 'dadata' && !cc.email)) {
      const parts = (c.name ?? '').trim().split(/\s+/)
      const [lastName, firstName] = parts
      if (firstName) {
        try {
          const result = await pattern.findEmail({
            workspaceId: 'system',
            domain,
            firstName,
            lastName,
          })
          if (result.email) {
            candidates.push({
              name: c.name,
              role: c.role,
              email: result.email,
              emailVerified: false,
              phone: null,
              source: 'pattern',
              confidence: 30,
            })
          }
        } catch {
          // Continue
        }
      }
    }
  }

  // Step 7: Generic fallback — if still no email found
  const hasEmail = candidates.some((c) => c.email)
  if (!hasEmail && domain) {
    for (const prefix of ['info', 'sales', 'hello'] as const) {
      candidates.push({
        name: null,
        role: null,
        email: `${prefix}@${domain}`,
        emailVerified: false,
        phone: null,
        source: 'generic',
        confidence: 20,
      })
    }
  }

  // Filter out empty-email dadata entries (director name found but no email generated)
  const validCandidates = candidates.filter((c) => c.email.length > 0)
  return rankCandidates(validCandidates)
}

// ─── Worker factory ───────────────────────────────────────────────────────────

export function startContactDiscoveryWorker() {
  const connection = getRedisConnection() as unknown as ConnectionOptions

  const worker = new Worker<ContactDiscoveryPayload>(
    QUEUES.CONTACT_DISCOVERY,
    async (job) => {
      if (job.name !== JOBS.DISCOVER_CONTACTS) {
        logger.warn({ event: 'contact_discovery.unknown_job', jobName: job.name })
        return null
      }

      const { companyIds, huntId, workspaceId } = job.data
      logger.info({
        event: 'contact_discovery.start',
        huntId,
        workspaceId,
        count: companyIds.length,
        jobId: job.id,
      })

      const db = getDb()

      for (const companyId of companyIds) {
        try {
          const company = await db.query.companies.findFirst({
            where: eq(companies.id, companyId),
            columns: {
              id: true,
              name: true,
              inn: true,
              website: true,
              domain: true,
            },
          })

          if (!company) {
            logger.warn({ event: 'contact_discovery.company_not_found', companyId })
            continue
          }

          const discovered = await discoverContacts(
            {
              id: company.id,
              name: company.name,
              inn: company.inn ?? null,
              website: company.website ?? company.domain ?? null,
            },
            workspaceId,
          )

          if (discovered.length > 0) {
            await db
              .update(companies)
              .set({
                contacts: discovered as unknown as (typeof companies.$inferSelect)['contacts'],
                updatedAt: new Date(),
              })
              .where(eq(companies.id, companyId))

            logger.info({
              event: 'contact_discovery.saved',
              companyId,
              contacts: discovered.length,
            })
          }
        } catch (err) {
          logger.error({
            event: 'contact_discovery.company_error',
            companyId,
            error: err instanceof Error ? err.message : String(err),
          })
          // Continue with remaining companies
        }
      }

      logger.info({
        event: 'contact_discovery.done',
        huntId,
        processed: companyIds.length,
      })

      return null
    },
    {
      connection,
      concurrency: 3,
    },
  )

  worker.on('failed', (job, err) => {
    logger.error({
      event: 'contact_discovery.job_failed',
      jobId: job?.id,
      error: err.message,
    })
  })

  return worker
}
