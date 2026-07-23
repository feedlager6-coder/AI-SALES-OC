/**
 * CompanyRegistry — workspace-level persistent deduplication.
 *
 * Checks whether a company already exists in the workspace's company DB,
 * and enriches search results with existsInWorkspace + workspaceStatus.
 *
 * Lookup priority:
 *   1. INN (exact, workspace-scoped)
 *   2. OGRN (exact, workspace-scoped)
 *   3. Domain (exact, workspace-scoped)
 */

import { eq, and, isNull } from 'drizzle-orm'
import { getDb, companies } from '@ai-sales-os/db'
import { createLogger } from '@ai-sales-os/logger'
import type { WorkspaceStatus } from './types.js'

const logger = createLogger({ name: 'api:company-registry' })

export interface WorkspacePresence {
  existsInWorkspace: boolean
  workspaceStatus:   WorkspaceStatus
}

// ── DB status → WorkspaceStatus mapping ──────────────────────────────────────

function toWorkspaceStatus(dbStatus: string): WorkspaceStatus {
  switch (dbStatus) {
    case 'new':
    case 'enriching':
    case 'enriched':
    case 'qualified':
    case 'low_quality':
      return 'new'
    case 'contacted':
    case 'replied':
      return 'contacted'
    case 'meeting':
    case 'proposal':
    case 'negotiation':
      return 'in_pipeline'
    case 'won':
    case 'closed_lost':
    case 'paused_30d':
    case 'opted_out':
      return 'closed'
    default:
      return 'new'
  }
}

export class CompanyRegistry {
  async findByInn(
    workspaceId: string,
    inn: string,
  ): Promise<{ id: string; status: string } | null> {
    const db = getDb()
    const [row] = await db
      .select({ id: companies.id, status: companies.status })
      .from(companies)
      .where(
        and(
          eq(companies.workspaceId, workspaceId),
          eq(companies.inn, inn),
          isNull(companies.deletedAt),
        ),
      )
      .limit(1)
    return row ?? null
  }

  async findByDomain(
    workspaceId: string,
    domain: string,
  ): Promise<{ id: string; status: string } | null> {
    const db = getDb()
    const [row] = await db
      .select({ id: companies.id, status: companies.status })
      .from(companies)
      .where(
        and(
          eq(companies.workspaceId, workspaceId),
          eq(companies.domain, domain),
          isNull(companies.deletedAt),
        ),
      )
      .limit(1)
    return row ?? null
  }

  /**
   * Check presence for a batch of companies in one workspace.
   * Returns a Map from company result id → WorkspacePresence.
   *
   * Uses per-company INN or domain lookup (N queries but small N for a search result set).
   */
  async checkPresence(
    workspaceId: string,
    companyKeys: Array<{ id: string; inn?: string | null; domain?: string | null }>,
  ): Promise<Map<string, WorkspacePresence>> {
    const result = new Map<string, WorkspacePresence>()

    await Promise.all(
      companyKeys.map(async ({ id, inn, domain }) => {
        try {
          let found: { id: string; status: string } | null = null

          const normalizedInn = inn?.trim().replace(/\s+/g, '') ?? null
          if (normalizedInn && /^\d{10,12}$/.test(normalizedInn)) {
            found = await this.findByInn(workspaceId, normalizedInn)
          }

          if (!found && domain) {
            const normalizedDomain = domain
              .replace(/^https?:\/\//i, '')
              .replace(/^www\./i, '')
              .replace(/\/.*$/, '')
              .toLowerCase()
            if (normalizedDomain) {
              found = await this.findByDomain(workspaceId, normalizedDomain)
            }
          }

          result.set(id, {
            existsInWorkspace: found !== null,
            workspaceStatus:   found ? toWorkspaceStatus(found.status) : 'new',
          })
        } catch (err: unknown) {
          logger.warn({
            event:     'company_registry.lookup_error',
            companyId: id,
            error:     err instanceof Error ? err.message : String(err),
          })
          result.set(id, { existsInWorkspace: false, workspaceStatus: 'new' })
        }
      }),
    )

    return result
  }
}
