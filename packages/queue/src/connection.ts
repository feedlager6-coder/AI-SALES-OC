import { Redis } from 'ioredis'
import { createLogger } from '@ai-sales-os/logger'

const logger = createLogger({ name: 'queue:redis' })

let _redis: Redis | null = null

/**
 * Returns a singleton Redis client configured for BullMQ.
 * BullMQ requires ioredis — do NOT use the redis package.
 */
export function getRedisConnection(): Redis {
  if (_redis) return _redis

  const url = process.env.REDIS_URL ?? 'redis://localhost:6379'

  _redis = new Redis(url, {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,   // Required for BullMQ
    lazyConnect: true,
  })

  _redis.on('error', (err: Error) => {
    logger.error({ event: 'redis.error', error: err.message })
  })

  _redis.on('connect', () => {
    logger.info({ event: 'redis.connected' })
  })

  return _redis
}

export async function closeRedisConnection(): Promise<void> {
  if (_redis) {
    await _redis.quit()
    _redis = null
  }
}
