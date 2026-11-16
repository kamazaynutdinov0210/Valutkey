import { describe, it, expect } from 'vitest'
import { buildApplicationGroups, isDueSoon, isOverdue, appName } from '../../src/vault/applications'
import type { Entry } from '../../src/vault/entry'

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: overrides.id ?? 'id-' + Math.random().toString(36).slice(2),
    title: overrides.title ?? 'App',
    username: overrides.username ?? 'user',
    url: overrides.url ?? '',
    password: overrides.password ?? 'secret',
    notes: overrides.notes ?? '',
    tags: overrides.tags ?? [],
    createdAt: overrides.createdAt ?? 1000,
    updatedAt: overrides.updatedAt ?? 1000,
    generator: overrides.generator ?? ({ mode: 'password', length: 12, upper: true, lower: true, digits: true, symbols: true, excludeLookalikes: false } as Entry['generator']),
    history: overrides.history ?? [],
    ...overrides,
  }
}

describe('applications logic', () => {
  it('groups entries by application name', () => {
    const entries = [makeEntry({ application: 'Google', username: 'a' }), makeEntry({ application: 'Google', username: 'b' }), makeEntry({ application: 'GitHub', username: 'c' })]
    const groups = buildApplicationGroups(entries, 'all', '', 'name')
    expect(groups.map((g) => g[0])).toEqual(['GitHub', 'Google'])
    expect(groups.find((g) => g[0] === 'Google')![1]).toHaveLength(2)
  })

  it('filters archived', () => {
    const entries = [makeEntry({ application: 'A', archivedAt: 1 }), makeEntry({ application: 'B' })]
    const groups = buildApplicationGroups(entries, 'archived', '', 'name')
    expect(groups.map((g) => g[0])).toEqual(['A'])
  })

  it('filters active excludes archived', () => {
    const entries = [makeEntry({ application: 'A', archivedAt: 1 }), makeEntry({ application: 'B' })]
    const groups = buildApplicationGroups(entries, 'active', '', 'name')
    expect(groups.map((g) => g[0])).toEqual(['B'])
  })

  it('filters favorites', () => {
    const entries = [makeEntry({ application: 'A', favorite: true }), makeEntry({ application: 'B' })]
    const groups = buildApplicationGroups(entries, 'favorites', '', 'name')
    expect(groups.map((g) => g[0])).toEqual(['A'])
  })

  it('filters automation on/off', () => {
    const entries = [makeEntry({ application: 'A', automationEnabled: true }), makeEntry({ application: 'B', automationEnabled: false })]
    expect(buildApplicationGroups(entries, 'auto-on', '', 'name').map((g) => g[0])).toEqual(['A'])
    expect(buildApplicationGroups(entries, 'auto-off', '', 'name').map((g) => g[0])).toEqual(['B'])
  })

  it('filters due and overdue', () => {
    const now = 1000000
    const soon = now + 86400000
    const past = now - 86400000
    const entries = [makeEntry({ application: 'A', nextPasswordChangeAt: soon }), makeEntry({ application: 'B', nextPasswordChangeAt: past }), makeEntry({ application: 'C', nextPasswordChangeAt: now + 30 * 86400000 })]
    expect(buildApplicationGroups(entries, 'due', '', 'name', now).map((g) => g[0])).toContain('A')
    expect(buildApplicationGroups(entries, 'overdue', '', 'name', now).map((g) => g[0])).toEqual(['B'])
  })

  it('search filters by name/username/email', () => {
    const entries = [makeEntry({ application: 'Google', username: 'alice', email: 'a@x.com' }), makeEntry({ application: 'GitHub', username: 'bob' })]
    expect(buildApplicationGroups(entries, 'all', 'alice', 'name').map((g) => g[0])).toEqual(['Google'])
    expect(buildApplicationGroups(entries, 'all', 'github', 'name').map((g) => g[0])).toEqual(['GitHub'])
    expect(buildApplicationGroups(entries, 'all', 'a@x', 'name').map((g) => g[0])).toEqual(['Google'])
  })

  it('sorts by name', () => {
    const entries = [makeEntry({ application: 'Zeta' }), makeEntry({ application: 'Alpha' })]
    expect(buildApplicationGroups(entries, 'all', '', 'name').map((g) => g[0])).toEqual(['Alpha', 'Zeta'])
  })

  it('sorts by last change descending', () => {
    const entries = [makeEntry({ application: 'A', lastPasswordChangeAt: 10 }), makeEntry({ application: 'B', lastPasswordChangeAt: 20 })]
    expect(buildApplicationGroups(entries, 'all', '', 'lastChange').map((g) => g[0])).toEqual(['B', 'A'])
  })

  it('sorts by next change ascending', () => {
    const entries = [makeEntry({ application: 'A', nextPasswordChangeAt: 20 }), makeEntry({ application: 'B', nextPasswordChangeAt: 10 })]
    expect(buildApplicationGroups(entries, 'all', '', 'nextChange').map((g) => g[0])).toEqual(['B', 'A'])
  })

  it('sorts by status', () => {
    const entries = [makeEntry({ application: 'A', accountStatus: 'inactive' }), makeEntry({ application: 'B', accountStatus: 'active' })]
    expect(buildApplicationGroups(entries, 'all', '', 'status').map((g) => g[0])).toEqual(['B', 'A'])
  })

  it('excludes deleted entries', () => {
    const entries = [makeEntry({ application: 'A', deletedAt: 5 })]
    expect(buildApplicationGroups(entries, 'all', '', 'name')).toEqual([])
  })

  it('isOverdue and isDueSoon', () => {
    const now = 1000
    const e1 = makeEntry({ nextPasswordChangeAt: 500 })
    const e2 = makeEntry({ nextPasswordChangeAt: now + 1000 })
    const e3 = makeEntry({ nextPasswordChangeAt: now + 100 * 86400000 })
    expect(isOverdue(e1, now)).toBe(true)
    expect(isOverdue(e2, now)).toBe(false)
    expect(isDueSoon(e2, now)).toBe(true)
    expect(isDueSoon(e3, now)).toBe(false)
  })

  it('appName falls back to title', () => {
    expect(appName(makeEntry({ title: 'MyApp', application: undefined }))).toBe('MyApp')
  })
})