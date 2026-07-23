/**
 * CompanyPersister — async persistence of search results to the companies table.
 *
 * Called after ranking, without awaiting (fire-and-forget).
 * Does NOT block the HTTP response.
 *
 * Upsert key: (workspace_id, inn) if INN present, else (workspace_id, domain).
 * Updates: signals, contacts, field_provenance, aliases, icp_score.
 * Does not overwrite: status, custom_fields, tags, deleted_at.
 */

import { eq, and, isNull } from 'drizzle-orm'
import { getDb, companies } from '@ai-sales-os/db'
import { createLogger } from '@ai-sales-os/logger'
import type { RankedCompany } from '../types.js'

const logger = createLogger({ name: 'api:company-persister' })

export class CompanyPersister {
  /**
   * Upsert ranked companies to the companies table.
   *
   * Called after ranking is complete. Do NOT await this — fire and forget.
   * The orchestrator calls `void companyPersister.persist(...)`.
   */
  async persist(
    huntId: string,
    workspaceId: string,
    rankedCompanies: RankedCompany[],
  ): Promise<void> {
    const db = getDb()

    let upserted = 0
    let failed   = 0

    for (const company of rankedCompanies) {
      try {
        const normalizedInn    = this.normalizeInn(company.inn)
        const normalizedDomain = this.normalizeDomain(company.website)

        // Determine if company already exists
        let existingId: string | null = null

        if (normalizedInn) {
          const [existing] = await db
            .select({ id: companies.id })
            .from(companies)
            .where(
              and(
                eq(companies.workspaceId, workspaceId),
                eq(companies.inn, normalizedInn),
                isNull(companies.deletedAt),
              ),
            )
            .limit(1)
          existingId = existing?.id ?? null
        }

        if (!existingId && normalizedDomain) {
          const [existing] = await db
            .select({ id: companies.id })
            .from(companies)
            .where(
              and(
                eq(companies.workspaceId, workspaceId),
                eq(companies.domain, normalizedDomain),
                isNull(companies.deletedAt),
              ),
            )
            .limit(1)
          existingId = existing?.id ?? null
        }

        const signalsForDb   = company.signalsV4.map((s) => ({
          ...s,
          eventDate:   s.eventDate?.toISOString() ?? null,
          detectedAt:  s.detectedAt.toISOString(),
        }))
        const contactsForDb  = company.contacts
        const provenanceForDb = company.sources
        const aliasesForDb   = company.aliases

        if (existingId) {
          // Update existing company with fresh V4 data
          await db
            .update(companies)
            .set({
              signals:       signalsForDb,
              contacts:      contactsForDb,
              fieldProvenance: provenanceForDb,
              aliases:       aliasesForDb,
              icpScore:      Math.round(company.icpScore),
              updatedAt:     new Date(),
            })
            .where(
              and(
                eq(companies.id, existingId),
                eq(companies.workspaceId, workspaceId),
              ),
            )
        } else {
          // Insert new company
          await db
            .insert(companies)
            .values({
              workspaceId,
              name:            company.name,
              inn:             normalizedInn ?? undefined,
              domain:          normalizedDomain ?? undefined,
              industry:        company.industry || undefined,
              region:          company.region || undefined,
              website:         company.website || undefined,
              icpScore:        Math.round(company.icpScore),
              signals:         signalsForDb,
              contacts:        contactsForDb,
              fieldProvenance: provenanceForDb,
              aliases:         aliasesForDb,
              source:          '2gis',
              sourceId:        company.id,
              status:          'new',
            })
            .onConflictDoNothing()
        }

        upserted++
      } catch (err: unknown) {
        failed++
        logger.error({
          event:     'company_persister.upsert_error',
          huntId,
          companyId: company.id,
          error:     err instanceof Error ? err.message : String(err),
        })
      }
    }

    logger.info({
      event:    'company_persister.complete',
      huntId,
      upserted,
      failed,
      total:    rankedCompanies.length,
    })
  }

  private normalizeInn(inn: string | null | undefined): string | null {
    if (!inn) return null
    const cleaned = inn.trim().replace(/\s+/g, '')
    return /^\d{10,12}$/.test(cleaned) ? cleaned : null
  }

  private normalizeDomain(website: string | null | undefined): string | null {
    if (!website?.trim()) return null
    const domain = website
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/.*$/, '')
      .toLowerCase()
      .trim()
    return domain || null
  }
}
