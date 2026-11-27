import * as Sentry from '@sentry/nextjs'

/**
 * Structured logger for server code (API routes, services, sitemap) that also reports to Sentry.
 *
 * - Every line goes to the console: one JSON object per line in production (Vercel → Logs,
 *   with the Sentry trace id), a readable `[level] message {fields}` line in development.
 * - info, warn and error lines are sent to Sentry Logs, linked to the request's trace.
 * - error lines also create a Sentry issue, with the stack trace when `fields.error` is an Error.
 * - `LOG_LEVEL` (debug | info | warn | error) sets the minimum level. Defaults to `info` in
 *   production and `debug` elsewhere.
 * - Secrets and shopper contact details are redacted by key name, so passing a whole object
 *   never leaks a token, phone number or address into the logs.
 *
 * Usage:
 *   const log = logger.child({ route: 'checkout' })
 *   log.info('Order created', { orderId, total })
 *   log.error('Checkout failed', { error })
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogFields = Record<string, unknown>

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

const REDACTED_KEY = /token|secret|password|authorization|cookie|api[-_]?key|signature|^email$|^phone$|address/i

function minimumLevel(): number {
  const configured = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined
  if (configured && configured in LEVELS) return LEVELS[configured]
  return process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug
}

/** Errors (and Supabase's plain-object errors) as loggable fields; JSON.stringify drops Error properties. */
export function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    const extra = error as Error & { code?: unknown; status?: unknown; cause?: unknown }
    return {
      name: error.name,
      message: error.message,
      ...(extra.code !== undefined && { code: extra.code }),
      ...(extra.status !== undefined && { status: extra.status }),
      ...(extra.cause !== undefined && { cause: serializeError(extra.cause) }),
      stack: error.stack,
    }
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const { message, code, details, hint } = error as Record<string, unknown>
    return { message, code, details, hint }
  }
  return error
}

function clean(value: unknown, depth = 0): unknown {
  if (value instanceof Error || (value && typeof value === 'object' && 'message' in value && 'code' in value)) {
    return serializeError(value)
  }
  if (depth > 4 || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(item => clean(item, depth + 1))
  const out: LogFields = {}
  for (const [key, item] of Object.entries(value)) {
    out[key] = REDACTED_KEY.test(key) ? '[redacted]' : clean(item, depth + 1)
  }
  return out
}

type Attribute = string | number | boolean

/** Sentry Logs attributes must be flat strings, numbers or booleans. */
function toAttributes(data: LogFields): Record<string, Attribute> {
  const out: Record<string, Attribute> = {}
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value
    } else if (key === 'error' && typeof value === 'object') {
      const { message, code, name } = value as Record<string, unknown>
      if (message !== undefined) out.error_message = String(message)
      if (code !== undefined) out.error_code = String(code)
      if (name !== undefined) out.error_name = String(name)
    } else {
      try { out[key] = JSON.stringify(value).slice(0, 2000) } catch { /* not serializable; skip */ }
    }
  }
  return out
}

function reportToSentry(level: LogLevel, message: string, fields: LogFields, data: LogFields) {
  try {
    if (level === 'debug') return
    Sentry.logger[level](message, toAttributes(data))
    if (level !== 'error') return

    const { error: _error, ...extra } = data
    const raw = fields.error
    if (raw instanceof Error) {
      Sentry.captureException(raw, { extra: { log_message: message, ...extra } })
    } else if (raw && typeof raw === 'object' && 'message' in raw) {
      // Supabase errors are plain objects; wrap them so the issue gets a readable title.
      const info = serializeError(raw) as Record<string, unknown>
      Sentry.captureException(new Error(`${message}: ${String(info.message)}`), { extra: { ...extra, error: info } })
    } else {
      Sentry.captureMessage(message, { level: 'error', extra: data })
    }
  } catch {
    // Reporting must never break the request that is logging.
  }
}

function currentTraceId(): string | undefined {
  try {
    const span = Sentry.getActiveSpan()
    return span ? Sentry.spanToJSON(span).trace_id : undefined
  } catch {
    return undefined
  }
}

function write(level: LogLevel, message: string, fields: LogFields) {
  if (LEVELS[level] < minimumLevel()) return
  const data = clean(fields) as LogFields
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  reportToSentry(level, message, fields, data)

  if (process.env.NODE_ENV === 'production') {
    const base = { time: new Date().toISOString(), level, message, traceId: currentTraceId() }
    let line: string
    try {
      line = JSON.stringify({ ...base, ...data })
    } catch {
      line = JSON.stringify({ ...base, note: 'fields could not be serialized' })
    }
    sink(line)
    return
  }
  if (Object.keys(data).length > 0) sink(`[${level}] ${message}`, data)
  else sink(`[${level}] ${message}`)
}

export type Logger = {
  debug: (message: string, fields?: LogFields) => void
  info: (message: string, fields?: LogFields) => void
  warn: (message: string, fields?: LogFields) => void
  error: (message: string, fields?: LogFields) => void
  /** A logger that adds `bound` to every line, e.g. `{ route: 'checkout' }`. */
  child: (bound: LogFields) => Logger
}

function createLogger(bound: LogFields = {}): Logger {
  return {
    debug: (message, fields) => write('debug', message, { ...bound, ...fields }),
    info: (message, fields) => write('info', message, { ...bound, ...fields }),
    warn: (message, fields) => write('warn', message, { ...bound, ...fields }),
    error: (message, fields) => write('error', message, { ...bound, ...fields }),
    child: extra => createLogger({ ...bound, ...extra }),
  }
}

export const logger = createLogger()
