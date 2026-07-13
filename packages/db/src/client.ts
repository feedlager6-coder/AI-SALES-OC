import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index.js'

let _client: ReturnType<typeof drizzle<typeof schema>> | null = null
let _sql: ReturnType<typeof postgres> | null = null

/**
 * Returns a singleton Drizzle ORM client.
 * Uses the DATABASE_URL environment variable.
 */
export function getDb() {
  if (_client) return _client

  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL environment variable is not set')

  _sql = postgres(url, {
    max: 10, // connection pool size
    idle_timeout: 30,
    connect_timeout: 10,
    onnotice: () => {}, // suppress NOTICE messages
  })

  _client = drizzle(_sql, { schema, logger: process.env.NODE_ENV === 'development' })
  return _client
}

export type Db = ReturnType<typeof getDb>

/**
 * Closes the database connection pool.
 * Call during graceful shutdown.
 */
export async function closeDb(): Promise<void> {
  if (_sql) {
    await _sql.end()
    _sql = null
    _client = null
  }
}
