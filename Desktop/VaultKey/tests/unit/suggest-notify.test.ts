import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../../src/generator'
import type { FillFn } from '../../src/generator/random'
import { dayKey, dueMessage, shouldNotify } from '../../src/reminders/notify'
import { suggestPassword } from '../../src/reminders/suggest'
import type { Entry } from '../../src/vault/entry'

const entry = (over: Partial<Entry> = {}): Entry => ({
  id: 'e',
  title: 'Bank',
  username: '',
  url: '',
  password: 'old-password',
  notes: '',
  tags: [],
  createdAt: 1,
  updatedAt: 1,
  generator: defaultSettings('password'),
  history: [],
  ...over,
})

describe('suggestPassword', () => {
  it("uses the entry's own saved settings", () => {
    const long = entry({ generator: { ...(defaultSettings('password') as Extract<ReturnType<typeof defaultSettings>, { mode: 'password' }>), length: 32 } })
    expect(suggestPassword(long).value).toHaveLength(32)
    const words = entry({ generator: { ...(defaultSettings('passphrase') as Extract<ReturnType<typeof defaultSettings>, { mode: 'passphrase' }>), words: 5, separator: '.' } })
    expect(suggestPassword(words).value.split('.')).toHaveLength(5)
  })

  it('is a different password each time', () => {
    expect(suggestPassword(entry()).value).not.toBe(suggestPassword(entry()).value)
  })

  it('tries again if it happens to match the current password', () => {
    // 8 lowercase letters. The first 8 draws give "aaaaaaaa", the next 8 give "bbbbbbbb".
    let calls = 0
    const fill: FillFn = (buffer) => {
      buffer[0] = Math.floor(calls++ / 8)
    }
    const settings = { ...(defaultSettings('password') as Extract<ReturnType<typeof defaultSettings>, { mode: 'password' }>), length: 8, upper: false, digits: false, symbols: false }
    expect(suggestPassword(entry({ password: 'aaaaaaaa', generator: settings }), fill).value).toBe('bbbbbbbb')
  })
})

describe('shouldNotify', () => {
  const base = { enabled: true, permission: 'granted' as const, count: 2, lastDay: null, today: '2026-06-15' }
  it('notifies when asked for, allowed, something is due, and not yet today', () => {
    expect(shouldNotify(base)).toBe(true)
    expect(shouldNotify({ ...base, lastDay: '2026-06-14' })).toBe(true)
  })
  it('stays quiet otherwise', () => {
    expect(shouldNotify({ ...base, enabled: false })).toBe(false)
    expect(shouldNotify({ ...base, permission: 'denied' })).toBe(false)
    expect(shouldNotify({ ...base, permission: 'default' })).toBe(false)
    expect(shouldNotify({ ...base, permission: 'unsupported' })).toBe(false)
    expect(shouldNotify({ ...base, count: 0 })).toBe(false)
    expect(shouldNotify({ ...base, lastDay: '2026-06-15' })).toBe(false)
  })
})

describe('notification text', () => {
  it('counts without naming anything', () => {
    expect(dueMessage(1)).toBe('1 password is due for a change.')
    expect(dueMessage(3)).toBe('3 passwords are due for a change.')
  })
  it('formats day keys', () => {
    expect(dayKey({ y: 2026, m: 3, d: 8 })).toBe('2026-03-08')
    expect(dayKey({ y: 2026, m: 12, d: 31 })).toBe('2026-12-31')
  })
})
