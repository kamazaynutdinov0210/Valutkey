import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../../src/generator'
import { installKind } from '../../src/pwa/install'
import { BACKGROUND_MESSAGE, localDayKey, shouldBackgroundNotify } from '../../src/pwa/hint'
import { createStore } from '../../src/pwa/store'
import { nextDueAtMs } from '../../src/reminders/schedule'
import type { Entry } from '../../src/vault/entry'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

describe('installKind', () => {
  const base = { standalone: false, hasPrompt: false }
  it('knows when the app is already installed', () => {
    expect(installKind({ ...base, standalone: true, userAgent: IPHONE })).toBe('installed')
    expect(installKind({ ...base, standalone: true, hasPrompt: true, userAgent: WINDOWS })).toBe('installed')
  })
  it('offers the one-tap prompt when the browser provides it', () => {
    expect(installKind({ ...base, hasPrompt: true, userAgent: ANDROID })).toBe('prompt')
    expect(installKind({ ...base, hasPrompt: true, userAgent: WINDOWS })).toBe('prompt')
  })
  it('gives Share-menu steps on iPhone, and on iPad even when it pretends to be a Mac', () => {
    expect(installKind({ ...base, userAgent: IPHONE })).toBe('ios')
    expect(installKind({ ...base, userAgent: MAC, maxTouchPoints: 5 })).toBe('ios')
  })
  it('falls back to generic steps elsewhere, including a real Mac', () => {
    expect(installKind({ ...base, userAgent: MAC, maxTouchPoints: 0 })).toBe('manual')
    expect(installKind({ ...base, userAgent: ANDROID })).toBe('manual')
    expect(installKind({ ...base, userAgent: WINDOWS })).toBe('manual')
  })
})

describe('store', () => {
  it('holds a value and tells subscribers when it changes', () => {
    const store = createStore({ n: 0 })
    let calls = 0
    const off = store.subscribe(() => calls++)
    store.set({ n: 1 })
    expect(store.get()).toEqual({ n: 1 })
    expect(calls).toBe(1)
    off()
    store.set({ n: 2 })
    expect(calls).toBe(1)
    expect(store.get()).toEqual({ n: 2 })
  })
})

describe('closed-app reminder rules', () => {
  const now = new Date(2026, 5, 15, 10, 0).getTime()
  const base = { hint: { nextDueAt: new Date(2026, 5, 15).getTime() }, now, lastDay: null, permission: 'granted' }
  it('notifies once the due date has arrived, at most once a day', () => {
    expect(shouldBackgroundNotify(base)).toBe(true)
    expect(shouldBackgroundNotify({ ...base, hint: { nextDueAt: new Date(2026, 4, 1).getTime() } })).toBe(true) // long overdue
    expect(shouldBackgroundNotify({ ...base, lastDay: '2026-06-14' })).toBe(true)
    expect(shouldBackgroundNotify({ ...base, lastDay: '2026-06-15' })).toBe(false)
  })
  it('stays quiet when nothing is due, nothing is known, or permission is missing', () => {
    expect(shouldBackgroundNotify({ ...base, hint: { nextDueAt: new Date(2026, 5, 16).getTime() } })).toBe(false)
    expect(shouldBackgroundNotify({ ...base, hint: { nextDueAt: null } })).toBe(false)
    expect(shouldBackgroundNotify({ ...base, hint: null })).toBe(false)
    expect(shouldBackgroundNotify({ ...base, permission: 'denied' })).toBe(false)
    expect(shouldBackgroundNotify({ ...base, permission: 'default' })).toBe(false)
  })
  it('formats the local day and never names a password', () => {
    expect(localDayKey(new Date(2026, 2, 8, 23, 59).getTime())).toBe('2026-03-08')
    expect(localDayKey(new Date(2026, 11, 1, 0, 0).getTime())).toBe('2026-12-01')
    expect(BACKGROUND_MESSAGE).toContain('At least one password')
  })
})

describe('nextDueAtMs', () => {
  const entry = (title: string, rotation?: Entry['rotation'], extra: Partial<Entry> = {}): Entry => ({
    id: title, title, username: '', url: '', password: 'pw', notes: '', tags: [], createdAt: 1, updatedAt: 1,
    generator: defaultSettings('password'), history: [], ...(rotation ? { rotation } : {}), ...extra,
  })
  const rot = (y: number, m: number, d: number, every: number): Entry['rotation'] => ({ every, unit: 'day', lastRotatedAt: new Date(y, m - 1, d, 9).getTime() })

  it('is the start of the earliest due day', () => {
    const list = [entry('later', rot(2026, 6, 1, 30)), entry('soonest', rot(2026, 6, 1, 10)), entry('middle', rot(2026, 6, 1, 20))]
    expect(nextDueAtMs(list)).toBe(new Date(2026, 5, 11).getTime())
  })
  it('ignores entries without a reminder and deleted ones, and is null when none are left', () => {
    expect(nextDueAtMs([entry('none'), entry('gone', rot(2026, 1, 1, 1), { deletedAt: 5 })])).toBe(null)
    expect(nextDueAtMs([])).toBe(null)
  })
  it('can be in the past, which means "already due"', () => {
    expect((nextDueAtMs([entry('old', rot(2020, 1, 1, 1))]) ?? 0) < Date.now()).toBe(true)
  })
})
