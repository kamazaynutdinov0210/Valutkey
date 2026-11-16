import { describe, expect, it } from 'vitest'
import { analyzeVaultHealth } from '../../src/vault/health'
import { defaultSettings, type PasswordSettings } from '../../src/generator'
import type { Entry } from '../../src/vault/entry'

function e(partial: Partial<Entry>): Entry {
  return {
    id: partial.id ?? crypto.randomUUID(),
    title: partial.title ?? 't',
    username: partial.username ?? 'u',
    url: partial.url ?? '',
    password: partial.password ?? 'LongUniquePassword!123',
    notes: '',
    tags: [],
    createdAt: partial.createdAt ?? Date.now(),
    updatedAt: partial.updatedAt ?? Date.now(),
    generator: partial.generator ?? defaultSettings('password'),
    history: [],
    ...partial,
  } as Entry
}

describe('password health', () => {
  it('reports reuse and weak patterns', () => {
    const now = Date.now()
    const pwGen: PasswordSettings = { ...defaultSettings('password') as PasswordSettings, length: 16 }
    const r = analyzeVaultHealth([
      e({ id: 'a', password: 'same-password-12345', generator: pwGen }),
      e({ id: 'b', password: 'same-password-12345', generator: pwGen }),
      e({ id: 'c', password: 'short', username: '', url: 'http://example.com', updatedAt: now - 200 * 86_400_000 }),
    ], now)
    expect(r.reused).toBe(2)
    expect(r.missingUsername).toBe(1)
    expect(r.insecureUrls).toBe(1)
    expect(r.old).toBeGreaterThanOrEqual(1)
    expect(r.score).toBeLessThan(100)
    expect(r.formula).toMatch(/not guarantee/i)
  })

  it('gives 100 for empty vault', () => {
    expect(analyzeVaultHealth([], Date.now()).score).toBe(100)
  })
})
