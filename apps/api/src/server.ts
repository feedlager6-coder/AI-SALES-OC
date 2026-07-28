import { createLogger } from '@ai-sales-os/logger'
import { getEnv } from '@ai-sales-os/config'
import { getDb, closeDb } from '@ai-sales-os/db'
import { closeRedisConnection } from '@ai-sales-os/queue'
import { registerAllPlugins } from '@ai-sales-os/plugins'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { buildApp } from './app.js'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const logger = createLogger({ name: 'api:server' })

async function main() {
  // The postgres-js migrator + ioredis each add process exit/signal listeners.
  // With 6+ migrations the default limit of 10 is exceeded, causing a spurious
  // MaxListenersExceededWarning. Raise to 30 — still catches real leaks.
  process.setMaxListeners(30)

  const env = getEnv()

  // Resolve the migrations folder.
  //
  // Three execution contexts, all must work:
  //   1. Railway production — node apps/api/production/dist/server.js
  //      __dir = apps/api/production/dist/
  //      migrations were copied there by the build script → dist/migrations/ exists ✓
  //
  //   2. Local compiled — node apps/api/dist/server.js
  //      __dir = apps/api/dist/
  //      migrations were copied there by the build script → dist/migrations/ exists ✓
  //
  //   3. Local dev — tsx watch src/server.ts (the Replit API Server workflow)
  //      __dir = apps/api/src/   →   src/migrations/ does NOT exist
  //      Fall back to the db package source directory which always has them ✓
  const __dir = path.dirname(fileURLToPath(import.meta.url))
  const compiledMigrations = path.join(__dir, 'migrations')
  const sourceMigrations = path.resolve(__dir, '../../../packages/db/src/migrations')
  const migrationsFolder = existsSync(path.join(compiledMigrations, 'meta', '_journal.json'))
    ? compiledMigrations
    : sourceMigrations

  // Run database migrations on every startup.
  // drizzle-orm's migrator is idempotent — applied migrations are recorded in
  // __drizzle_migrations and skipped on subsequent runs.
  try {
    logger.info({ event: 'db.migrate.start', migrationsFolder })
    await migrate(getDb(), { migrationsFolder })
    logger.info({ event: 'db.migrate.done' })
  } catch (err) {
    logger.error({ event: 'db.migrate.failed', error: (err as Error).message })
    process.exit(1)
  }

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
