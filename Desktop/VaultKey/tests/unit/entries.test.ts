import { describe, expect, it } from 'vitest'
import { importAesKey, randomBytes } from '../../src/crypto/aead'
import type { EncryptedRecord } from '../../src/crypto/types'
import { defaultSettings } from '../../src/generator'
import { EntryError, LIMITS, type EntryInput } from '../../src/vault/entry'
import { createVaultService } from '../../src/vault/entries'
import type { RecordStorage } from '../../src/vault/storage'

const memory = (): RecordStorage & { records: Map<string, EncryptedRecord> } => {
  const records = new Map<string, EncryptedRecord>()
  return {
    records,
    all: async () => structuredClone([...records.values()]),
    put: async (r) => void records.set(r.id, structuredClone(r)),
    putMany: async (list) => void list.forEach((r) => records.set(r.id, structuredClone(r))),
    clear: async () => void records.clear(),
  }
}

async function setup(storage = memory(), vaultId = 'vault-1', keyBytes = randomBytes(32)) {
  const vaultKey = await importAesKey(keyBytes, ['encrypt', 'decrypt'])
  let clock = 1_000
  let n = 0
  const service = createVaultService({ vaultKey, vaultId, storage, now: () => (clock += 1000), newId: () => `id-${++n}` })
  return { service, storage, vaultKey, vaultId, keyBytes }
}

const input = (over: Partial<EntryInput> = {}): EntryInput => ({
  title: 'Example bank',
  username: 'sam@example.com',
  url: 'bank.example.com',
  password: 'SuperSecret-123',
  notes: 'security question: first pet',
  tags: ['money'],
  generator: defaultSettings('password'),
  ...over,
})
const code = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p
    return 'no-error'
  } catch (e) {
    return e instanceof EntryError ? e.message : 'other'
  }
}

describe('saving and loading', () => {
  it('creates an entry and lists it', async () => {
    const { service } = await setup()
    const entry = await service.create(input())
    expect(entry.id).toBe('id-1')
    expect(service.list().map((e) => e.title)).toEqual(['Example bank'])
    expect(entry.history).toEqual([])
    expect(entry.createdAt).toBe(entry.updatedAt)
  })

  it('stores only ciphertext: no title, username, password or notes in storage', async () => {
    const { service, storage } = await setup()
    await service.create(input())
    const stored = JSON.stringify([...storage.records.values()])
    for (const secret of ['Example bank', 'sam@example.com', 'SuperSecret-123', 'first pet', 'money']) {
      expect(stored).not.toContain(secret)
    }
  })

  it('a fresh service with the same key reads everything back', async () => {
    const first = await setup()
    await first.service.create(input())
    await first.service.create(input({ title: 'Email', password: 'another-one' }))
    const second = await setup(first.storage, first.vaultId, first.keyBytes)
    expect(await second.service.load()).toEqual({ damaged: 0 })
    expect(second.service.list().map((e) => e.title).sort()).toEqual(['Email', 'Example bank'])
  })

  it('with the wrong key nothing opens, and nothing crashes', async () => {
    const first = await setup()
    await first.service.create(input())
    const other = await setup(first.storage, first.vaultId, randomBytes(32))
    expect(await other.service.load()).toEqual({ damaged: 1 })
    expect(other.service.list()).toEqual([])
  })
})

describe('damaged or moved records', () => {
  it('counts a tampered record and still loads the rest', async () => {
    const first = await setup()
    await first.service.create(input())
    await first.service.create(input({ title: 'Second' }))
    const victim = first.storage.records.get('id-1')
    if (!victim) throw new Error('missing')
    first.storage.records.set('id-1', { ...victim, ct: victim.ct.slice(0, -4) + 'AAAA' })
    const again = await setup(first.storage, first.vaultId, first.keyBytes)
    expect(await again.service.load()).toEqual({ damaged: 1 })
    expect(again.service.list().map((e) => e.title)).toEqual(['Second'])
  })

  it('refuses a record copied under another id (it is bound into the encryption)', async () => {
    const first = await setup()
    await first.service.create(input())
    const original = first.storage.records.get('id-1')
    if (!original) throw new Error('missing')
    first.storage.records.set('id-9', { ...original, id: 'id-9' })
    const again = await setup(first.storage, first.vaultId, first.keyBytes)
    expect(await again.service.load()).toEqual({ damaged: 1 })
  })

  it('refuses a record that decrypts to the wrong shape', async () => {
    const { service, storage, vaultKey, vaultId } = await setup()
    const { sealRecord } = await import('../../src/crypto/records')
    await storage.put(await sealRecord(vaultKey, vaultId, 'x', { password: 42 }))
    expect(await service.load()).toEqual({ damaged: 1 })
  })
})

describe('editing', () => {
  it('keeps the old password in history when it changes, and nothing when it does not', async () => {
    const { service } = await setup()
    const entry = await service.create(input())
    const renamed = await service.update(entry.id, input({ title: 'Renamed' }))
    expect(renamed.history).toEqual([])
    expect(renamed.createdAt).toBe(entry.createdAt)
    expect(renamed.updatedAt > entry.updatedAt).toBe(true)

    const changed = await service.update(entry.id, input({ title: 'Renamed', password: 'new-password-1' }))
    expect(changed.password).toBe('new-password-1')
    expect(changed.history.map((h) => [h.password, h.reason])).toEqual([['SuperSecret-123', 'edit']])
  })

  it('caps history at 20, newest first', async () => {
    const { service } = await setup()
    const entry = await service.create(input({ password: 'p0' }))
    let last = entry
    for (let i = 1; i <= 25; i++) last = await service.update(entry.id, input({ password: `p${i}` }))
    expect(last.history).toHaveLength(LIMITS.history)
    expect(last.history[0]?.password).toBe('p24')
  })

  it('cannot edit a missing or deleted entry', async () => {
    const { service } = await setup()
    expect(await code(service.update('nope', input()))).toBe('That password no longer exists.')
    const entry = await service.create(input())
    await service.remove(entry.id)
    expect(await code(service.update(entry.id, input()))).toBe('That password no longer exists.')
  })
})

describe('deleting', () => {
  it('hides the entry and leaves no secret behind in storage', async () => {
    const { service, storage, vaultKey, vaultId } = await setup()
    const entry = await service.create(input())
    await service.remove(entry.id)
    expect(service.list()).toEqual([])
    const { openRecord } = await import('../../src/crypto/records')
    const record = storage.records.get(entry.id)
    if (!record) throw new Error('tombstone missing')
    const tomb = await openRecord<Record<string, unknown>>(vaultKey, vaultId, record)
    expect(tomb.password).toBe('')
    expect(tomb.title).toBe('')
    expect(tomb.history).toEqual([])
    expect(typeof tomb.deletedAt).toBe('number')
  })

  it('stays deleted after a reload', async () => {
    const first = await setup()
    const entry = await first.service.create(input())
    await first.service.remove(entry.id)
    const again = await setup(first.storage, first.vaultId, first.keyBytes)
    expect(await again.service.load()).toEqual({ damaged: 0 })
    expect(again.service.list()).toEqual([])
  })
})

describe('input checks', () => {
  it('needs a title and trims whitespace', async () => {
    const { service } = await setup()
    expect(await code(service.create(input({ title: '   ' })))).toBe('Give this password a title.')
    expect((await service.create(input({ title: '  Padded  ', username: ' u ' }))).title).toBe('Padded')
  })

  it('rejects over-long fields', async () => {
    const { service } = await setup()
    expect(await code(service.create(input({ notes: 'x'.repeat(LIMITS.notes + 1) })))).toContain('too long')
    expect(await code(service.create(input({ password: 'x'.repeat(LIMITS.password + 1) })))).toContain('too long')
  })

  it('tidies tags: trims, removes blanks and case-insensitive duplicates', async () => {
    const { service } = await setup()
    const entry = await service.create(input({ tags: [' Work ', 'work', '', 'Home  office', 'WORK'] }))
    expect(entry.tags).toEqual(['Work', 'Home office'])
  })

  it('limits the number of tags', async () => {
    const { service } = await setup()
    const many = Array.from({ length: 21 }, (_, i) => `t${i}`)
    expect(await code(service.create(input({ tags: many })))).toContain('tags')
  })
})

describe('reminders on entries', () => {
  const monthly = { every: 3, unit: 'month' as const }

  it('starts the clock when a reminder is set at creation', async () => {
    const { service } = await setup()
    const entry = await service.create(input({ rotation: monthly }))
    expect(entry.rotation).toEqual({ ...monthly, lastRotatedAt: entry.createdAt })
    expect((await service.create(input())).rotation).toBe(undefined)
  })

  it('a new password restarts the clock; renaming or changing the interval does not', async () => {
    const { service } = await setup()
    const entry = await service.create(input({ rotation: monthly }))
    const renamed = await service.update(entry.id, input({ title: 'Renamed', rotation: monthly }))
    expect(renamed.rotation?.lastRotatedAt).toBe(entry.rotation?.lastRotatedAt)
    const longer = await service.update(entry.id, input({ title: 'Renamed', rotation: { every: 6, unit: 'month' } }))
    expect(longer.rotation).toEqual({ every: 6, unit: 'month', lastRotatedAt: entry.rotation?.lastRotatedAt })
    const changed = await service.update(entry.id, input({ title: 'Renamed', password: 'brand-new-1', rotation: monthly }))
    expect((changed.rotation?.lastRotatedAt ?? 0) > (entry.rotation?.lastRotatedAt ?? 0)).toBe(true)
  })

  it('turning a reminder on later starts the clock then; turning it off removes it', async () => {
    const { service } = await setup()
    const entry = await service.create(input())
    const on = await service.update(entry.id, input({ rotation: monthly }))
    expect(on.rotation?.lastRotatedAt).toBe(on.updatedAt)
    const off = await service.update(entry.id, input())
    expect('rotation' in off).toBe(false)
  })

  it('rotate() swaps in the confirmed password, keeps the old one, and restarts the clock', async () => {
    const { service } = await setup()
    const entry = await service.create(input({ rotation: monthly }))
    const rotated = await service.rotate(entry.id, 'confirmed-new-password')
    expect(rotated.password).toBe('confirmed-new-password')
    expect(rotated.history.map((h) => [h.password, h.reason])).toEqual([['SuperSecret-123', 'rotation']])
    expect((rotated.rotation?.lastRotatedAt ?? 0) > (entry.rotation?.lastRotatedAt ?? 0)).toBe(true)
  })

  it('rotate() works without a reminder and does not invent one', async () => {
    const { service } = await setup()
    const entry = await service.create(input())
    const rotated = await service.rotate(entry.id, 'another-one-2')
    expect('rotation' in rotated).toBe(false)
  })

  it('rotate() refuses empty, identical, and missing', async () => {
    const { service } = await setup()
    const entry = await service.create(input())
    expect(await code(service.rotate(entry.id, ''))).toBe('Enter the new password.')
    expect(await code(service.rotate(entry.id, 'SuperSecret-123'))).toBe('That is the same password as before.')
    expect(await code(service.rotate('nope', 'x'))).toBe('That password no longer exists.')
  })

  it('survives a reload', async () => {
    const first = await setup()
    const entry = await first.service.create(input({ rotation: monthly }))
    const again = await setup(first.storage, first.vaultId, first.keyBytes)
    await again.service.load()
    expect(again.service.get(entry.id)?.rotation).toEqual(entry.rotation)
  })

  it('rejects impossible intervals', async () => {
    const { service } = await setup()
    for (const rotation of [
      { every: 0, unit: 'day' as const },
      { every: 1.5, unit: 'week' as const },
      { every: 121, unit: 'month' as const },
      { every: 3651, unit: 'day' as const },
      { every: 2, unit: 'year' as unknown as 'day' },
    ]) {
      expect(await code(service.create(input({ rotation })))).toContain('whole number')
    }
  })
})
