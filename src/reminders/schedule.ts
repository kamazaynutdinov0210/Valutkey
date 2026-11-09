import type { Entry, Rotation } from '../vault/entry'

/**
 * Reminder dates are calendar dates, not "N x 24 hours". Adding hours breaks on the two days a
 * year when clocks change (a day is 23 or 25 hours), so everything here is plain year/month/day
 * arithmetic, which does not depend on the time zone or daylight saving at all. The only place a
 * time zone matters is turning "now" into today's local date.
 */
export interface YMD {
  y: number
  m: number // 1-12
  d: number
}

export const SOON_DAYS = 7
const DAY_MS = 86_400_000

export const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate()

export function addDays(date: YMD, n: number): YMD {
  const t = new Date(Date.UTC(date.y, date.m - 1, date.d + n))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

/** Jan 31 + 1 month = Feb 28 (or 29): the day is clamped to the end of a shorter month. */
export function addMonths(date: YMD, n: number): YMD {
  const total = date.y * 12 + (date.m - 1) + n
  const y = Math.floor(total / 12)
  const m = (((total % 12) + 12) % 12) + 1
  return { y, m, d: Math.min(date.d, daysInMonth(y, m)) }
}

export function addInterval(date: YMD, every: number, unit: Rotation['unit']): YMD {
  if (unit === 'day') return addDays(date, every)
  if (unit === 'week') return addDays(date, 7 * every)
  return addMonths(date, every)
}

/** The local calendar date of a moment in time. */
export function toYMD(ms: number): YMD {
  const t = new Date(ms)
  return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }
}

export const daysBetween = (a: YMD, b: YMD): number =>
  Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / DAY_MS)

export const dueDate = (rotation: Rotation): YMD => addInterval(toYMD(rotation.lastRotatedAt), rotation.every, rotation.unit)

export type DueState = 'overdue' | 'soon' | 'later'
export interface RotationStatus {
  state: DueState
  due: YMD
  daysUntilDue: number // negative when overdue; 0 means due today
}

/** Due today counts as "soon", not overdue: the password still has the whole day. */
export function rotationStatus(rotation: Rotation, nowMs: number, soonDays: number = SOON_DAYS): RotationStatus {
  const due = dueDate(rotation)
  const daysUntilDue = daysBetween(toYMD(nowMs), due)
  const state: DueState = daysUntilDue < 0 ? 'overdue' : daysUntilDue <= soonDays ? 'soon' : 'later'
  return { state, due, daysUntilDue }
}

export interface DueItem {
  entry: Entry
  status: RotationStatus
}

/** Groups entries that have a reminder. Most urgent first inside each group. */
export function dueEntries(entries: Entry[], nowMs: number): { overdue: DueItem[]; soon: DueItem[]; later: DueItem[] } {
  const groups: Record<DueState, DueItem[]> = { overdue: [], soon: [], later: [] }
  for (const entry of entries) {
    if (entry.deletedAt !== undefined || !entry.rotation) continue
    const status = rotationStatus(entry.rotation, nowMs)
    groups[status.state].push({ entry, status })
  }
  const byUrgency = (a: DueItem, b: DueItem) =>
    a.status.daysUntilDue - b.status.daysUntilDue || a.entry.title.localeCompare(b.entry.title, undefined, { sensitivity: 'base' })
  return { overdue: groups.overdue.sort(byUrgency), soon: groups.soon.sort(byUrgency), later: groups.later.sort(byUrgency) }
}

/** The start (local midnight) of the earliest due date, or null if nothing has a reminder. Past dates mean "already due". */
export function nextDueAtMs(entries: Entry[]): number | null {
  let best: number | null = null
  for (const entry of entries) {
    if (entry.deletedAt !== undefined || !entry.rotation) continue
    const d = dueDate(entry.rotation)
    const at = new Date(d.y, d.m - 1, d.d).getTime()
    if (best === null || at < best) best = at
  }
  return best
}

export function dueCount(entries: Entry[], nowMs: number): number {
  const { overdue, soon } = dueEntries(entries, nowMs)
  return overdue.length + soon.length
}

// ---- plain-language text ----

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function describeRotation(rotation: { every: number; unit: Rotation['unit'] }): string {
  return rotation.every === 1 ? `every ${rotation.unit}` : `every ${plural(rotation.every, rotation.unit)}`
}

export function formatYMD(date: YMD): string {
  return new Date(Date.UTC(date.y, date.m - 1, date.d)).toLocaleDateString(undefined, { dateStyle: 'medium', timeZone: 'UTC' })
}

export function describeDue(status: RotationStatus): string {
  const n = status.daysUntilDue
  if (n < 0) return `Overdue by ${plural(-n, 'day')}`
  if (n === 0) return 'Due today'
  if (n === 1) return 'Due tomorrow'
  return status.state === 'soon' ? `Due in ${n} days` : `Due on ${formatYMD(status.due)}`
}
