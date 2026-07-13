import { createLogger } from '@ai-sales-os/logger'
import { registry } from './registry/plugin-registry.js'
import { isCircuitOpen, recordSuccess, recordFailure } from './circuit-breaker.js'
import type { IEmailFinderPlugin, EmailFinderParams } from './interfaces/index.js'

const logger = createLogger({ name: 'waterfall' })

const MIN_CONFIDENCE_THRESHOLD = 0.3

/**
 * Tries email-finder plugins in priority order, stopping at the first success.
 * Respects circuit breakers and per-workspace configuration.
 */
export async function waterfallEmailFind(
  params: EmailFinderParams,
): Promise<{ email: string; source: string; confidence: number } | null> {
  const finders = registry.getByCategory<IEmailFinderPlugin>('email_finder')

  for (const finder of finders) {
    // Skip if circuit is open
    if (isCircuitOpen(finder.name)) {
      logger.debug({ event: 'waterfall.circuit_skip', provider: finder.name })
      continue
    }

    // Skip if not configured for this workspace
    if (!(await finder.isConfigured(params.workspaceId))) {
      continue
    }

    try {
      const result = await finder.findEmail(params)

      if (result.email && result.confidence >= MIN_CONFIDENCE_THRESHOLD) {
        recordSuccess(finder.name)
        logger.info({
          event: 'email.found',
          provider: finder.name,
          confidence: result.confidence,
          workspaceId: params.workspaceId,
        })
        return {
          email: result.email,
          source: finder.name,
          confidence: result.confidence,
        }
      }
    } catch (error) {
      recordFailure(finder.name)
      logger.warn({
        event: 'email_finder.error',
        provider: finder.name,
        error: (error as Error).message,
        workspaceId: params.workspaceId,
      })
      // Continue to next provider
    }
  }

  return null
}
