import { z } from 'zod'

// ─── Schema ───────────────────────────────────────────────────────────────────

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  PORT: z.coerce.number().int().positive().default(3001),

  // Database
  DATABASE_URL: z
    .string()
    .url()
    .refine((url) => url.startsWith('postgres'), {
      message: 'DATABASE_URL must be a PostgreSQL connection string',
    }),

  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),

  // Encryption key for API keys at rest (AES-256 = 32 bytes = 64 hex chars)
  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)')
    .regex(/^[0-9a-fA-F]+$/, 'ENCRYPTION_KEY must be a hex string'),

  // External APIs (optional)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_DOMAIN: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
  TWOGIS_API_KEY: z.string().optional(),
  HUNTER_API_KEY: z.string().optional(),
  SNOV_API_KEY: z.string().optional(),
  DADATA_API_KEY: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),

  // MinIO / S3
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_BUCKET: z.string().default('ai-sales-os'),
  MINIO_USE_SSL: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

  // Frontend
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3001'),
})

export type Env = z.infer<typeof envSchema>

// ─── Validation ───────────────────────────────────────────────────────────────

let _env: Env | null = null

/**
 * Parse and validate environment variables.
 * Throws with detailed Zod error messages on invalid config.
 * Memoized — safe to call multiple times.
 */
export function getEnv(): Env {
  if (_env) return _env

  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const formatted = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n')
    throw new Error(`❌ Invalid environment configuration:\n${formatted}`)
  }

  _env = result.data
  return _env
}

/** Reset memoized env (useful for tests) */
export function resetEnv(): void {
  _env = null
}
