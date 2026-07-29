import { createLogger } from '@ai-sales-os/logger'
import { getEnv } from '@ai-sales-os/config'
import { closeDb } from '@ai-sales-os/db'
import { closeRedisConnection } from '@ai-sales-os/queue'
import { registerAllPlugins } from '@ai-sales-os/plugins'
import { startEnrichmentWorker } from './enrichment/enrichment.worker.js'
import { startEmailWorker } from './email/email.worker.js'
import { startAiWorker } from './ai/ai.worker.js'
import { startScrapingWorker } from './scraping/scraping.worker.js'
import { startContactDiscoveryWorker } from './contact-discovery/contact-discovery.worker.js'

// Raise the process listener limit at module evaluation time — before any
// BullMQ Worker or ioredis instance registers its own exit/signal listeners.
// With 5 workers × ~4 internal listeners each the default limit of 10 is
// exceeded, which produces a spurious MaxListenersExceededWarning in Node.js.
//
// Note: packages/config now accepts NEXT_PUBLIC_API_URL="" (empty string) so
// Workers startup no longer crashes when the Web service's Railway shared var
// is inherited by this service. Redeploy triggered via this touch.
process.setMaxListeners(50)

const logger = createLogger({ name: 'workers:main' })

async function main() {
  getEnv() // Validate env at startup — crashes fast if a required var is absent

  registerAllPlugins()

  logger.info({ event: 'workers.starting' })

  const workers = [
    startEnrichmentWorker(),
    startEmailWorker(),
    startAiWorker(),
    startScrapingWorker(),
    startContactDiscoveryWorker(),
  ]

  logger.info({ event: 'workers.started', count: workers.length })

  const shutdown = async (signal: string) => {
    logger.info({ event: 'workers.shutdown', signal })

    await Promise.all(workers.map((w) => w.close()))
    await closeDb()
    await closeRedisConnection()

    logger.info({ event: 'workers.stopped' })
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch((err) => {
  logger.error({ event: 'workers.fatal', error: (err as Error).message })
  process.exit(1)
})
