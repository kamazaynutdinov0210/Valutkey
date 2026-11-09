import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../../src/generator'
import { parseEntry, parseTagText, safeHttpUrl, type Entry } from '../../src/vault/entry'
import { allTags, searchEntries } from '../../src/vault/search'

const make = (over: Partial<Entry>): Entry => ({
  id: over.title ?? 'x',
  title: 'T',
  username: '',
  url: '',
  password: 'pw',
  notes: '',
  tags: [],
  createdAt: 1,
  updatedAt: 1,
  generator: defaultSettings('password'),
  history: [],
  ...over,
})
const entries = [
  make({ title: 'Zeta mail', username: 'ann@example.com', tags: ['Work'], password: 'hunter2hunter2' }),
  make({ title: 'alpha bank', url: 'https://bank.example.com', notes: 'savings account', tags: ['money', 'Personal'] }),
  make({ title: 'Gone', deletedAt: 5 }),
]

describe('searchEntries', () => {
  it('returns everything live, sorted by title ignoring case', () => {
    expect(searchEntries(entries, '').map((e) => e.title)).toEqual(['alpha bank', 'Zeta mail'])
  })
  it('matches title, username, url, notes and tags, ignoring case', () => {
    expect(searchEntries(entries, 'ZETA').map((e) => e.title)).toEqual(['Zeta mail'])
    expect(searchEntries(entries, 'ann@').map((e) => e.title)).toEqual(['Zeta mail'])
    expect(searchEntries(entries, 'bank.example').map((e) => e.title)).toEqual(['alpha bank'])
    expect(searchEntries(entries, 'savings').map((e) => e.title)).toEqual(['alpha bank'])
    expect(searchEntries(entries, 'personal').map((e) => e.title)).toEqual(['alpha bank'])
  })
  it('needs every word to match', () => {
    expect(searchEntries(entries, 'example bank').map((e) => e.title)).toEqual(['alpha bank'])
    expect(searchEntries(entries, 'example zebra')).toEqual([])
  })
  it('never matches the password itself', () => {
    expect(searchEntries(entries, 'hunter2')).toEqual([])
  })
  it('filters by tag, ignoring case, and combines with the search', () => {
    expect(searchEntries(entries, '', 'work').map((e) => e.title)).toEqual(['Zeta mail'])
    expect(searchEntries(entries, 'bank', 'work')).toEqual([])
  })
  it('lists each tag once, from live entries only', () => {
    expect(allTags([...entries, make({ title: 'More', tags: ['WORK'] }), make({ title: 'D', tags: ['secret'], deletedAt: 1 })])).toEqual(['money', 'Personal', 'Work'])
  })
})

describe('safeHttpUrl', () => {
  it('accepts web addresses and assumes https for bare domains', () => {
    expect(safeHttpUrl('https://example.com/login')).toBe('https://example.com/login')
    expect(safeHttpUrl('http://example.com')).toBe('http://example.com/')
    expect(safeHttpUrl('bank.example.com')).toBe('https://bank.example.com/')
    expect(safeHttpUrl('  example.com  ')).toBe('https://example.com/')
    expect(safeHttpUrl('localhost:3000/app')).toBe('https://localhost:3000/app')
  })
  it('refuses anything that is not http or https', () => {
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', 'ftp://example.com', 'vbscript:x', '']) {
      expect(safeHttpUrl(bad)).toBe(null)
    }
  })
})

describe('parseTagText', () => {
  it('splits on commas and tidies', () => {
    expect(parseTagText(' a, b ,,A ,c d ')).toEqual(['a', 'b', 'c d'])
  })
})

describe('parseEntry', () => {
  const good = make({ title: 'Ok', rotation: { every: 3, unit: 'month', lastRotatedAt: 9 }, history: [{ password: 'old', replacedAt: 2, reason: 'rotation' }] })
  it('accepts a good entry unchanged', () => {
    expect(parseEntry(JSON.parse(JSON.stringify(good)))).toEqual(good)
  })
  it('rejects wrong types and shapes', () => {
    const bad = (patch: Record<string, unknown>) => () => parseEntry({ ...JSON.parse(JSON.stringify(good)), ...patch })
    expect(bad({ password: 42 })).toThrow()
    expect(bad({ tags: 'a' })).toThrow()
    expect(bad({ createdAt: 'yesterday' })).toThrow()
    expect(bad({ history: [{ password: 'x', replacedAt: 1, reason: 'nope' }] })).toThrow()
    expect(bad({ rotation: { every: 0, unit: 'month', lastRotatedAt: 1 } })).toThrow()
    expect(bad({ rotation: { every: 2, unit: 'year', lastRotatedAt: 1 } })).toThrow()
    expect(bad({ title: '' })).toThrow()
    expect(() => parseEntry(null)).toThrow()
    expect(() => parseEntry([])).toThrow()
  })
  it('falls back to default generator settings instead of losing the password', () => {
    const parsed = parseEntry({ ...JSON.parse(JSON.stringify(good)), generator: { mode: 'garbage' } })
    expect(parsed.generator.mode).toBe('password')
    expect(parsed.password).toBe('pw')
  })
  it('allows an empty title only on a deleted entry', () => {
    expect(parseEntry({ ...JSON.parse(JSON.stringify(good)), title: '', deletedAt: 5 }).deletedAt).toBe(5)
  })
})
