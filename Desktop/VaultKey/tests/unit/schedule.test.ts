import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../../src/generator'
import {
  addDays,
  addInterval,
  addMonths,
  daysBetween,
  daysInMonth,
  describeDue,
  describeRotation,
  dueCount,
  dueDate,
  dueEntries,
  rotationStatus,
  toYMD,
  type YMD,
} from '../../src/reminders/schedule'
import type { Entry } from '../../src/vault/entry'

const ymd = (y: number, m: number, d: number): YMD => ({ y, m, d })
/** A moment in the machine's local time, whatever its time zone is. */
const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime()

describe('month lengths', () => {
  it('knows leap years, including the century rules', () => {
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2028, 2)).toBe(29)
    expect(daysInMonth(2100, 2)).toBe(28)
    expect(daysInMonth(2000, 2)).toBe(29)
    expect([daysInMonth(2026, 1), daysInMonth(2026, 4), daysInMonth(2026, 12)]).toEqual([31, 30, 31])
  })
})

describe('adding months', () => {
  it('clamps to the end of a shorter month', () => {
    expect(addMonths(ymd(2026, 1, 31), 1)).toEqual(ymd(2026, 2, 28))
    expect(addMonths(ymd(2028, 1, 31), 1)).toEqual(ymd(2028, 2, 29))
    expect(addMonths(ymd(2026, 8, 31), 1)).toEqual(ymd(2026, 9, 30))
    expect(addMonths(ymd(2026, 3, 31), 1)).toEqual(ymd(2026, 4, 30))
  })
  it('rolls over the year', () => {
    expect(addMonths(ymd(2026, 12, 15), 2)).toEqual(ymd(2027, 2, 15))
    expect(addMonths(ymd(2026, 1, 31), 12)).toEqual(ymd(2027, 1, 31))
    expect(addMonths(ymd(2026, 11, 30), 3)).toEqual(ymd(2027, 2, 28))
  })
  it('handles leap-day anniversaries and long spans', () => {
    expect(addMonths(ymd(2028, 2, 29), 12)).toEqual(ymd(2029, 2, 28))
    expect(addMonths(ymd(2028, 2, 29), 48)).toEqual(ymd(2032, 2, 29))
    expect(addMonths(ymd(2026, 5, 10), 120)).toEqual(ymd(2036, 5, 10))
    expect(addMonths(ymd(2026, 5, 10), 0)).toEqual(ymd(2026, 5, 10))
  })
  it('counts from the original date, so a 31st does not drift down to the 28th', () => {
    expect(addMonths(ymd(2026, 1, 31), 2)).toEqual(ymd(2026, 3, 31))
  })
})

describe('adding days and weeks', () => {
  it('crosses month and year ends and the leap day', () => {
    expect(addDays(ymd(2026, 2, 28), 1)).toEqual(ymd(2026, 3, 1))
    expect(addDays(ymd(2028, 2, 28), 1)).toEqual(ymd(2028, 2, 29))
    expect(addDays(ymd(2026, 12, 31), 1)).toEqual(ymd(2027, 1, 1))
    expect(addDays(ymd(2026, 3, 1), -1)).toEqual(ymd(2026, 2, 28))
    expect(addDays(ymd(2026, 1, 1), 365)).toEqual(ymd(2027, 1, 1))
  })
  it('turns weeks into 7 days each', () => {
    expect(addInterval(ymd(2026, 1, 1), 2, 'week')).toEqual(ymd(2026, 1, 15))
    expect(addInterval(ymd(2026, 1, 1), 10, 'day')).toEqual(ymd(2026, 1, 11))
    expect(addInterval(ymd(2026, 1, 1), 3, 'month')).toEqual(ymd(2026, 4, 1))
  })
})

describe('days between', () => {
  it('counts calendar days, not hours', () => {
    expect(daysBetween(ymd(2026, 3, 1), ymd(2026, 4, 1))).toBe(31)
    expect(daysBetween(ymd(2026, 12, 25), ymd(2027, 1, 5))).toBe(11)
    expect(daysBetween(ymd(2026, 5, 5), ymd(2026, 5, 5))).toBe(0)
    expect(daysBetween(ymd(2026, 5, 5), ymd(2026, 5, 2))).toBe(-3)
  })
})

describe('time zones and daylight saving', () => {
  it('reads the local calendar date of a moment', () => {
    expect(toYMD(local(2026, 3, 8, 0, 0))).toEqual(ymd(2026, 3, 8))
    expect(toYMD(local(2026, 3, 8, 12))).toEqual(ymd(2026, 3, 8))
    expect(toYMD(local(2026, 3, 8, 23, 59))).toEqual(ymd(2026, 3, 8))
  })
  it('keeps the calendar date across a clock change (a day can be 23 or 25 hours long)', () => {
    // US spring-forward 2026-03-08, fall-back 2026-11-01. Adding 24h per day would be off by one here.
    const spring = { every: 1, unit: 'day' as const, lastRotatedAt: local(2026, 3, 7, 23, 30) }
    expect(dueDate(spring)).toEqual(ymd(2026, 3, 8))
    const twoDays = { every: 2, unit: 'day' as const, lastRotatedAt: local(2026, 3, 7, 12) }
    expect(dueDate(twoDays)).toEqual(ymd(2026, 3, 9))
    const fall = { every: 2, unit: 'day' as const, lastRotatedAt: local(2026, 10, 31, 12) }
    expect(dueDate(fall)).toEqual(ymd(2026, 11, 2))
    const week = { every: 1, unit: 'week' as const, lastRotatedAt: local(2026, 3, 3, 8) }
    expect(dueDate(week)).toEqual(ymd(2026, 3, 10))
  })
})

describe('due status', () => {
  const weekly = { every: 1, unit: 'week' as const, lastRotatedAt: local(2026, 1, 1, 9) } // due Jan 8
  it('is "soon" for the whole due day and overdue from the next midnight', () => {
    expect(rotationStatus(weekly, local(2026, 1, 8, 0, 0))).toEqual({ state: 'soon', due: ymd(2026, 1, 8), daysUntilDue: 0 })
    expect(rotationStatus(weekly, local(2026, 1, 8, 23, 59)).state).toBe('soon')
    const next = rotationStatus(weekly, local(2026, 1, 9, 0, 0))
    expect([next.state, next.daysUntilDue]).toEqual(['overdue', -1])
  })
  it('is "soon" up to 7 days ahead, "later" beyond', () => {
    expect(rotationStatus(weekly, local(2026, 1, 1, 9)).state).toBe('soon') // 7 days
    expect(rotationStatus(weekly, local(2025, 12, 31, 9)).state).toBe('later') // 8 days
    expect(rotationStatus(weekly, local(2026, 1, 7, 22)).daysUntilDue).toBe(1)
  })
  it('counts how overdue it is', () => {
    expect(rotationStatus(weekly, local(2026, 2, 1)).daysUntilDue).toBe(-24)
  })
})

describe('dueEntries', () => {
  const entry = (title: string, rotation?: Entry['rotation'], extra: Partial<Entry> = {}): Entry => ({
    id: title,
    title,
    username: '',
    url: '',
    password: 'pw',
    notes: '',
    tags: [],
    createdAt: 1,
    updatedAt: 1,
    generator: defaultSettings('password'),
    history: [],
    ...(rotation ? { rotation } : {}),
    ...extra,
  })
  const now = local(2026, 6, 15)
  const rot = (daysAgo: number, every = 30): Entry['rotation'] => ({ every, unit: 'day', lastRotatedAt: local(2026, 6, 15 - daysAgo, 9) })

  const list = [
    entry('B overdue 2', rot(32)), // due 2 days ago
    entry('A overdue 2', rot(32)),
    entry('Overdue 10', rot(40)),
    entry('Today', rot(30)),
    entry('In 5 days', rot(25)),
    entry('Later', rot(1)),
    entry('No reminder'),
    entry('Deleted', rot(100), { deletedAt: 5 }),
  ]
  it('groups, sorts most urgent first, and ignores entries without a reminder or deleted ones', () => {
    const { overdue, soon, later } = dueEntries(list, now)
    expect(overdue.map((i) => i.entry.title)).toEqual(['Overdue 10', 'A overdue 2', 'B overdue 2'])
    expect(soon.map((i) => i.entry.title)).toEqual(['Today', 'In 5 days'])
    expect(later.map((i) => i.entry.title)).toEqual(['Later'])
  })
  it('counts overdue plus soon', () => {
    expect(dueCount(list, now)).toBe(5)
    expect(dueCount([], now)).toBe(0)
  })
})

describe('plain-language text', () => {
  it('describes reminders', () => {
    expect(describeRotation({ every: 1, unit: 'month' })).toBe('every month')
    expect(describeRotation({ every: 3, unit: 'month' })).toBe('every 3 months')
    expect(describeRotation({ every: 2, unit: 'week' })).toBe('every 2 weeks')
    expect(describeRotation({ every: 1, unit: 'day' })).toBe('every day')
  })
  it('describes how due something is', () => {
    const at = (daysUntilDue: number, state: 'overdue' | 'soon' | 'later') => describeDue({ state, due: ymd(2026, 6, 20), daysUntilDue })
    expect(at(-1, 'overdue')).toBe('Overdue by 1 day')
    expect(at(-5, 'overdue')).toBe('Overdue by 5 days')
    expect(at(0, 'soon')).toBe('Due today')
    expect(at(1, 'soon')).toBe('Due tomorrow')
    expect(at(4, 'soon')).toBe('Due in 4 days')
    expect(at(40, 'later').startsWith('Due on ')).toBe(true)
  })
})
