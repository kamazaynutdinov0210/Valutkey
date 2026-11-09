import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../../src/generator'
import { describeMerge, emptyStats, mergeEntries, noChanges, type Versioned } from '../../src/sync/merge'
import type { Entry } from '../../src/vault/entry'

let counter = 0
/** One side's copy of an entry. `iv` stands in for "which saved version this is". */
const v = (id: string, over: Partial<Entry> = {}, iv = `iv${++counter}`): Versioned => ({
  entry: {
    id,
    title: id,
    username: '',
    url: '',
    password: 'pw',
    notes: '',
    tags: [],
    createdAt: 1,
    updatedAt: 100,
    generator: defaultSettings('password'),
    history: [],
    ...over,
  },
  record: { id, v: 1, iv, ct: `ct-${iv}` },
})
const gone = (id: string, at: number) => v(id, { title: '', password: '', deletedAt: at, updatedAt: at })
const merge = (l: Versioned[], r: Versioned[], since: number | null = 50) => mergeEntries(l, r, since)
const byId = (items: ReturnType<typeof merge>['items'], id: string) => items.find((i) => i.entry.id === id)

describe('entries that exist on one side only', () => {
  it('sends local-only entries to the file and takes remote-only entries', () => {
    const { items, stats } = merge([v('a')], [v('b')])
    expect(byId(items, 'a')?.origin).toBe('local')
    expect(byId(items, 'b')?.origin).toBe('remote')
    expect([stats.sentToFile, stats.added]).toEqual([1, 1])
  })
  it('keeps a remote delete marker without counting it as something added', () => {
    const { items, stats } = merge([], [gone('x', 120)])
    expect(items).toHaveLength(1)
    expect(stats.added).toBe(0)
  })
})

describe('the same entry on both sides', () => {
  it('is unchanged when both copies are the same saved version', () => {
    const a = v('a', {}, 'same')
    const { stats, items } = merge([a], [v('a', {}, 'same')])
    expect(stats.unchanged).toBe(1)
    expect(noChanges(stats)).toBe(true)
    expect(items[0]?.origin).toBe('local')
  })
  it('takes the newer edit from the file, or keeps the newer local one', () => {
    const newerRemote = merge([v('a', { updatedAt: 100, title: 'old' })], [v('a', { updatedAt: 200, title: 'new' })], 150)
    expect(newerRemote.stats.updated).toBe(1)
    expect(byId(newerRemote.items, 'a')?.origin).toBe('remote')
    const newerLocal = merge([v('a', { updatedAt: 300, title: 'mine' })], [v('a', { updatedAt: 200, title: 'theirs' })], 250)
    expect(newerLocal.stats.sentToFile).toBe(1)
    expect(byId(newerLocal.items, 'a')?.entry.title).toBe('mine')
  })
  it('respects deletes: a newer delete removes, a newer edit survives an older delete', () => {
    const removed = merge([v('a', { updatedAt: 100 })], [gone('a', 200)], 150)
    expect(removed.stats.removed).toBe(1)
    expect(byId(removed.items, 'a')?.entry.deletedAt).toBe(200)

    const resurrected = merge([gone('a', 100)], [v('a', { updatedAt: 200 })], 150)
    expect(resurrected.stats.added).toBe(1)
    expect(byId(resurrected.items, 'a')?.entry.deletedAt).toBe(undefined)

    const localDeleteWins = merge([gone('a', 300)], [v('a', { updatedAt: 200 })], 250)
    expect(byId(localDeleteWins.items, 'a')?.entry.deletedAt).toBe(300)
  })
  it('breaks an exact tie the same way on both devices: a delete wins, then the larger IV', () => {
    const live = v('a', { updatedAt: 100 }, 'iv-b')
    const del = gone('a', 100)
    expect(byId(merge([live], [del], 50).items, 'a')?.entry.deletedAt).toBe(100)
    expect(byId(merge([del], [live], 50).items, 'a')?.entry.deletedAt).toBe(100)

    const x = v('a', { updatedAt: 100, title: 'X' }, 'iv-1')
    const y = v('a', { updatedAt: 100, title: 'Y' }, 'iv-2')
    expect(byId(merge([x], [y], 50).items, 'a')?.entry.title).toBe('Y')
    expect(byId(merge([y], [x], 50).items, 'a')?.entry.title).toBe('Y')
  })
})

describe('conflicts (changed on both devices since the last sync)', () => {
  it('keeps the newest version and keeps the other password in history', () => {
    const local = v('a', { updatedAt: 200, password: 'mine', history: [{ password: 'orig', replacedAt: 150, reason: 'edit' }] })
    const remote = v('a', { updatedAt: 300, password: 'theirs', history: [{ password: 'orig', replacedAt: 250, reason: 'edit' }] })
    const { items, stats } = merge([local], [remote], 100)
    const merged = byId(items, 'a')
    expect(stats.conflicts).toBe(1)
    expect(merged?.origin).toBe('merged')
    expect(merged?.record).toBe(null) // must be encrypted again
    expect(merged?.entry.password).toBe('theirs')
    const history = merged?.entry.history.map((h) => `${h.password}/${h.reason}`).sort()
    expect(history).toEqual(['mine/import', 'orig/edit'])
  })
  it('is not a conflict when only one side changed since the last sync', () => {
    const { stats, items } = merge([v('a', { updatedAt: 100, password: 'old' })], [v('a', { updatedAt: 300, password: 'new' })], 200)
    expect(stats.conflicts).toBe(0)
    expect(byId(items, 'a')?.origin).toBe('remote')
  })
  it('counts a conflict but needs no re-encryption when only non-password fields differ', () => {
    const { items, stats } = merge([v('a', { updatedAt: 200, notes: 'mine' })], [v('a', { updatedAt: 300, notes: 'theirs' })], 100)
    expect(stats.conflicts).toBe(1)
    expect(byId(items, 'a')?.origin).toBe('remote')
  })
  it('history never contains the current password, has no duplicates, and stays within 20', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ password: `p${i}`, replacedAt: 1000 + i, reason: 'edit' as const }))
    const local = v('a', { updatedAt: 200, password: 'mine', history: many })
    const remote = v('a', { updatedAt: 300, password: 'p3', history: [{ password: 'p4', replacedAt: 5, reason: 'edit' }] })
    const merged = byId(merge([local], [remote], 100).items, 'a')?.entry.history ?? []
    expect(merged).toHaveLength(20)
    expect(merged.some((h) => h.password === 'p3')).toBe(false)
    expect(new Set(merged.map((h) => h.password)).size).toBe(20)
    expect(merged[0]?.replacedAt).toBe(1024)
  })
  it('is symmetric: both devices end with the same entry', () => {
    const a = v('a', { updatedAt: 200, password: 'one' })
    const b = v('a', { updatedAt: 300, password: 'two' })
    const x = byId(merge([a], [b], 100).items, 'a')?.entry
    const y = byId(merge([b], [a], 100).items, 'a')?.entry
    expect(x).toEqual(y)
  })
})

describe('describeMerge', () => {
  it('speaks plainly', () => {
    expect(describeMerge(emptyStats())).toBe('Everything was already up to date.')
    expect(describeMerge({ ...emptyStats(), added: 2, updated: 1 })).toBe('From the file: added 2 passwords, updated 1 password.')
    expect(describeMerge({ ...emptyStats(), sentToFile: 1 })).toContain('1 change from this device was included in the file.')
    expect(describeMerge({ ...emptyStats(), conflicts: 2 })).toContain('2 passwords were changed in both places')
  })
})
