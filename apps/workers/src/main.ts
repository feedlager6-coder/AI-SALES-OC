import { createLogger } from '@ai-sales-os/logger'
import { getEnv } from '@ai-sales-os/config'
import { closeDb } from '@ai-sales-os/db'
import { closeRedisConnection } from '@ai-sales-os/queue'
import { registerAllPlugins } from '@ai-sales-os/plugins'
import { startEnrichmentWorker } from './enrichment/enrichment.worker.js'
import { startEmailWorker } from './email/email.worker.js'
import { startAiWorker } from './ai/ai.worker.js'

const logger = createLogger({ name: 'workers:main' })

async function main() {
  getEnv() // Validate env at startup

  registerAllPlugins()

  logger.info({ event: 'workers.starting' })

  const workers = [
    startEnrichmentWorker(),
    startEmailWorker(),
    startAiWorker(),
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
