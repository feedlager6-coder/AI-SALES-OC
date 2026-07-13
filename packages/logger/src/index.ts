import pino from 'pino'

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface LoggerOptions {
  name?: string
  level?: LogLevel
}

const isDev = process.env.NODE_ENV !== 'production'
const defaultLevel = (process.env.LOG_LEVEL as LogLevel) ?? (isDev ? 'debug' : 'info')

/**
 * Creates a named Pino logger instance.
 * In development: pretty-prints with colors.
 * In production: outputs structured JSON for log aggregation.
 */
export function createLogger(options: LoggerOptions = {}): pino.Logger {
  const { name = 'app', level = defaultLevel } = options

  return pino({
    name,
    level,
    ...(isDev
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
            },
          },
        }
      : {
          // Production: structured JSON
          formatters: {
            level(label: string) {
              return { level: label }
            },
          },
          timestamp: pino.stdTimeFunctions.isoTime,
        }),
  })
}

/** Default application logger */
export const logger = createLogger({ name: 'ai-sales-os' })

export type Logger = pino.Logger
