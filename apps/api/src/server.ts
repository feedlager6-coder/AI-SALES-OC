import { createLogger } from '@ai-sales-os/logger'
import { getEnv } from '@ai-sales-os/config'
import { closeDb } from '@ai-sales-os/db'
import { closeRedisConnection } from '@ai-sales-os/queue'
import { registerAllPlugins } from '@ai-sales-os/plugins'
import { buildApp } from './app.js'

const logger = createLogger({ name: 'api:server' })

async function main() {
  const env = getEnv()

  // Register plugin implementations before accepting requests
  registerAllPlugins()

  const app = await buildApp()

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ event: 'server.shutdown', signal })
    await app.close()
    await closeDb()
    await closeRedisConnection()
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
    logger.info({ event: 'server.started', port: env.PORT, env: env.NODE_ENV })
  } catch (err) {
    logger.error({ event: 'server.fatal', error: (err as Error).message })
    process.exit(1)
  }
}

main()
