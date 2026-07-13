/**
 * Base application error with HTTP status codes and structured error codes.
 * All domain errors should extend this class.
 */
export class AppError extends Error {
  readonly statusCode: number
  readonly code: string
  readonly isOperational: boolean

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
  ) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.code = code
    this.isOperational = isOperational
    Error.captureStackTrace(this, this.constructor)
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
      },
    }
  }
}

// ─── HTTP 4xx ────────────────────────────────────────────────────────────────

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST') {
    super(message, 400, code)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(message, 401, code)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(message, 403, code)
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', code = 'NOT_FOUND') {
    super(`${resource} not found`, 404, code)
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', code = 'CONFLICT') {
    super(message, 409, code)
  }
}

export class UnprocessableError extends AppError {
  constructor(message = 'Unprocessable entity', code = 'UNPROCESSABLE') {
    super(message, 422, code)
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests', code = 'RATE_LIMITED') {
    super(message, 429, code)
  }
}

// ─── HTTP 5xx ────────────────────────────────────────────────────────────────

export class InternalError extends AppError {
  constructor(message = 'Internal server error', code = 'INTERNAL_ERROR') {
    super(message, 500, code, false)
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable', code = 'SERVICE_UNAVAILABLE') {
    super(message, 503, code)
  }
}

// ─── Domain Errors ────────────────────────────────────────────────────────────

export class WorkspaceNotFoundError extends NotFoundError {
  constructor() {
    super('Workspace', 'WORKSPACE_NOT_FOUND')
  }
}

export class CompanyNotFoundError extends NotFoundError {
  constructor() {
    super('Company', 'COMPANY_NOT_FOUND')
  }
}

export class ContactNotFoundError extends NotFoundError {
  constructor() {
    super('Contact', 'CONTACT_NOT_FOUND')
  }
}

export class CompanyDuplicateError extends ConflictError {
  constructor(field: 'inn' | 'domain') {
    super(
      `Company with this ${field.toUpperCase()} already exists in workspace`,
      'COMPANY_DUPLICATE',
    )
  }
}

export class ContactOptedOutError extends ForbiddenError {
  constructor() {
    super('Contact has opted out of communications', 'CONTACT_OPTED_OUT')
  }
}

export class PluginNotConfiguredError extends AppError {
  constructor(pluginName: string) {
    super(`Plugin '${pluginName}' is not configured for this workspace`, 503, 'PLUGIN_NOT_CONFIGURED')
  }
}

export class PluginCircuitOpenError extends AppError {
  constructor(pluginName: string) {
    super(`Plugin '${pluginName}' circuit breaker is open`, 503, 'PLUGIN_CIRCUIT_OPEN')
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError
}

export function isOperationalError(err: unknown): boolean {
  if (isAppError(err)) return err.isOperational
  return false
}
