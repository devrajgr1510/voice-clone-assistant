// The backend sends timestamps as naive UTC (e.g. "2026-09-11T14:23:01.123456"
// with no trailing "Z" or offset). Left alone, `new Date(...)` treats a
// timezone-less string as LOCAL time, not UTC — so every historical
// timestamp (Call History, Alerts, Recordings...) would show shifted by
// your UTC offset compared to the live clock in the top bar, which uses
// `new Date()` directly and is always correct. Every call site that renders
// a server timestamp should go through these helpers instead of calling
// `new Date(...)` directly, so the two always agree.

export function parseServerDate(value) {
  if (!value) return null
  const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/.test(value)
  const d = new Date(hasTimezone ? value : `${value}Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatTime(value, opts) {
  const d = parseServerDate(value)
  return d ? d.toLocaleTimeString(undefined, opts) : '—'
}

export function formatDate(value, opts) {
  const d = parseServerDate(value)
  return d ? d.toLocaleDateString(undefined, opts) : '—'
}

export function formatDateTime(value, opts) {
  const d = parseServerDate(value)
  return d ? d.toLocaleString(undefined, opts) : '—'
}
