/**
 * All dates and times on the site are shown in India time (IST, Asia/Kolkata), whatever the
 * time zone of the viewer's device or the server.
 */
export const IST = 'Asia/Kolkata'

/**
 * Parses a database time. orders.created_at is a "timestamp without time zone" stored in UTC
 * and arrives without an offset (e.g. "2026-11-24T10:30:00"); read that as UTC, not local time.
 */
export function toDate(value: string | number | Date): Date {
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`)
}

/** Date and/or time in IST, e.g. formatIST(x, { dateStyle: 'medium', timeStyle: 'short' }). */
export function formatIST(value: string | number | Date, options: Intl.DateTimeFormatOptions): string {
  return toDate(value).toLocaleString('en-IN', { ...options, timeZone: IST })
}

/** "24 Nov 2026" in IST. */
export const formatDateIST = (value: string | number | Date, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  formatIST(value, options)

/** "24 Nov 2026, 4:00 pm" in IST. */
export const formatDateTimeIST = (value: string | number | Date) =>
  formatIST(value, { dateStyle: 'medium', timeStyle: 'short' })
