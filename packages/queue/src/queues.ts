import { Queue, type ConnectionOptions } from 'bullmq'
import { getRedisConnection } from './connection.js'
import { QUEUES } from './jobs.js'
import type {
  EnrichCompanyPayload,
  SendEmailPayload,
  GenerateEmailPayload,
  ClassifyReplyPayload,
  NotifySdrPayload,
  Search2GISPayload,
  SearchHHRuPayload,
  ContactDiscoveryPayload,
} from './jobs.js'

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000, // 2s, 4s, 8s
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 500 },
}

function createQueue<T>(name: string): Queue<T> {
  // Cast to ConnectionOptions to avoid dual ioredis version conflict
  const connection = getRedisConnection() as unknown as ConnectionOptions
  return new Queue<T>(name, {
    connection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  })
}

// Lazy singletons — created on first access
let _enrichmentQueue: Queue<EnrichCompanyPayload> | null = null
let _emailQueue: Queue<SendEmailPayload> | null = null
let _aiQueue: Queue<GenerateEmailPayload | ClassifyReplyPayload> | null = null
let _notificationQueue: Queue<NotifySdrPayload> | null = null
let _scrapingQueue: Queue<Search2GISPayload | SearchHHRuPayload> | null = null
let _contactDiscoveryQueue: Queue<ContactDiscoveryPayload> | null = null

export function getEnrichmentQueue(): Queue<EnrichCompanyPayload> {
  _enrichmentQueue ??= createQueue<EnrichCompanyPayload>(QUEUES.ENRICHMENT)
  return _enrichmentQueue
}

export function getEmailQueue(): Queue<SendEmailPayload> {
  _emailQueue ??= createQueue<SendEmailPayload>(QUEUES.EMAIL)
  return _emailQueue
}

export function getAiQueue(): Queue<GenerateEmailPayload | ClassifyReplyPayload> {
  _aiQueue ??= createQueue<GenerateEmailPayload | ClassifyReplyPayload>(QUEUES.AI)
  return _aiQueue
}

export function getNotificationQueue(): Queue<NotifySdrPayload> {
  _notificationQueue ??= createQueue<NotifySdrPayload>(QUEUES.NOTIFICATION)
  return _notificationQueue
}

export function getScrapingQueue(): Queue<Search2GISPayload | SearchHHRuPayload> {
  _scrapingQueue ??= createQueue<Search2GISPayload | SearchHHRuPayload>(QUEUES.SCRAPING)
  return _scrapingQueue
}

export function getContactDiscoveryQueue(): Queue<ContactDiscoveryPayload> {
  _contactDiscoveryQueue ??= createQueue<ContactDiscoveryPayload>(QUEUES.CONTACT_DISCOVERY)
  return _contactDiscoveryQueue
}

export async function closeAllQueues(): Promise<void> {
  await Promise.all([
    _enrichmentQueue?.close(),
    _emailQueue?.close(),
    _aiQueue?.close(),
    _notificationQueue?.close(),
    _scrapingQueue?.close(),
    _contactDiscoveryQueue?.close(),
  ])
}
