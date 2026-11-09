import { describe, expect, it } from 'vitest'
import { argon2idRaw } from '../../src/crypto/argon2'
import { openRecord, sealRecord } from '../../src/crypto/records'
import type { VaultHeader } from '../../src/crypto/types'
import { createSession } from '../../src/vault/session'
import type { HeaderStorage } from '../../src/vault/storage'
import { memoryRecords } from './memory'
import { codeOf, TEST_COSTS } from './helpers'

const memoryStorage = (): HeaderStorage & { saved: VaultHeader | null; saves: number } => {
  const s = {
    saved: null as VaultHeader | null,
    saves: 0,
    load: async () => s.saved,
    save: async (h: VaultHeader) => {
      s.saved = structuredClone(h)
      s.saves++
    },
  }
  return s
}
const make = (storage = memoryStorage()) => ({
  storage,
  session: createSession({ argon2: argon2idRaw, storage, costs: TEST_COSTS }),
})
const PASSWORD = 'correct horse battery staple'

describe('session lifecycle', () => {
  it('starts as loading, then reports whether a vault exists', async () => {
    const { session } = make()
    expect(session.getState().status).toBe('loading')
    await session.init()
    expect(session.getState().status).toBe('no-vault')
  })

  it('does not save anything until the recovery key is confirmed', async () => {
    const { session, storage } = make()
    await session.init()
    const pending = await session.prepareVault(PASSWORD)
    expect(storage.saves).toBe(0)
    expect(session.getState().status).toBe('no-vault')
    expect(pending.recoveryKey).toMatch(/^([0-9A-Z]{4}-){13}[0-9A-Z]{4}$/)
    await session.commitVault(pending)
    expect(storage.saves).toBe(1)
    expect(session.getState().status).toBe('unlocked')
  })

  it('locks, drops the key, and unlocks again with the same data', async () => {
    const { session, storage } = make()
    await session.init()
    const pending = await session.prepareVault(PASSWORD)
    await session.commitVault(pending)
    const first = session.getState()
    if (first.status !== 'unlocked') throw new Error('expected unlocked')
    const record = await sealRecord(first.vaultKey, first.header.vaultId, 'e1', { secret: 'x' })

    session.lock()
    expect(session.getState().status).toBe('locked')
    expect('vaultKey' in session.getState()).toBe(false)

    // a fresh app start sees the stored header and starts locked
    const restart = make(storage)
    await restart.session.init()
    expect(restart.session.getState().status).toBe('locked')
    await restart.session.unlock(PASSWORD)
    const again = restart.session.getState()
    if (again.status !== 'unlocked') throw new Error('expected unlocked')
    expect(await openRecord(again.vaultKey, again.header.vaultId, record)).toEqual({ secret: 'x' })
  })

  it('stays locked after a wrong password', async () => {
    const { session, storage } = make()
    await session.init()
    await session.commitVault(await session.prepareVault(PASSWORD))
    session.lock()
    expect(await codeOf(session.unlock('nope nope nope nope'))).toBe('wrong-password')
    expect(session.getState().status).toBe('locked')
    expect(storage.saves).toBe(1)
  })

  it('refuses to create a second vault over an existing one', async () => {
    const { session } = make()
    await session.init()
    await session.commitVault(await session.prepareVault(PASSWORD))
    const other = await session.prepareVault('another long passphrase')
    let failed = false
    try {
      await session.commitVault(other)
    } catch {
      failed = true
    }
    expect(failed).toBe(true)
  })

  it('resets a forgotten password with the recovery key and saves the new header', async () => {
    const { session, storage } = make()
    await session.init()
    const pending = await session.prepareVault(PASSWORD)
    await session.commitVault(pending)
    session.lock()

    await session.resetWithRecovery(pending.recoveryKey, 'brand new long passphrase')
    expect(session.getState().status).toBe('unlocked')
    expect(storage.saves).toBe(2)

    session.lock()
    expect(await codeOf(session.unlock(PASSWORD))).toBe('wrong-password')
    expect(await codeOf(session.unlock('brand new long passphrase'))).toBe('no-error')
  })

  it('notifies subscribers on every change and stops after unsubscribe', async () => {
    const { session } = make()
    let calls = 0
    const off = session.subscribe(() => calls++)
    await session.init()
    expect(calls).toBe(1)
    off()
    session.lock()
    await session.init()
    expect(calls).toBe(1)
  })
})

describe('restore and sync support', () => {
  it('adoptVault saves the header and opens, but only when there is no vault', async () => {
    const source = make()
    await source.session.init()
    const pending = await source.session.prepareVault(PASSWORD)

    const target = make()
    await target.session.init()
    await target.session.adoptVault(pending.header, pending.vaultKey)
    expect(target.session.getState().status).toBe('unlocked')
    expect(target.storage.saves).toBe(1)
    let failed = false
    try {
      await target.session.adoptVault(pending.header, pending.vaultKey)
    } catch {
      failed = true
    }
    expect(failed).toBe(true)
  })

  it('replaceHeader swaps the header, keeps the same key, and needs an unlocked vault', async () => {
    const { session, storage } = make()
    await session.init()
    const pending = await session.prepareVault(PASSWORD)
    await session.commitVault(pending)
    const before = session.getState()
    if (before.status !== 'unlocked') throw new Error('expected unlocked')
    const next = { ...before.header, changedAt: 99 }
    await session.replaceHeader(next)
    const after = session.getState()
    if (after.status !== 'unlocked') throw new Error('expected unlocked')
    expect(after.header.changedAt).toBe(99)
    expect(after.vaultKey).toBe(before.vaultKey)
    expect(storage.saved?.changedAt).toBe(99)

    session.lock()
    let failed = false
    try {
      await session.replaceHeader(next)
    } catch {
      failed = true
    }
    expect(failed).toBe(true)
  })

  it('creating a brand-new vault removes leftover records from a failed restore', async () => {
    const storage = memoryStorage()
    const records = memoryRecords()
    await records.put({ id: 'orphan', v: 1, iv: 'a', ct: 'b' })
    const session = createSession({ argon2: argon2idRaw, storage, records, costs: TEST_COSTS })
    await session.init()
    await session.commitVault(await session.prepareVault(PASSWORD))
    expect(records.map.size).toBe(0)
  })
})

describe('biometric unlock and whole-vault replacement', () => {
  it('unlockWithKey opens a locked vault with a key obtained another way', async () => {
    const { session } = make()
    await session.init()
    const pending = await session.prepareVault(PASSWORD)
    await session.commitVault(pending)
    session.lock()
    await session.unlockWithKey(pending.vaultKey)
    const state = session.getState()
    expect(state.status).toBe('unlocked')
    expect(state.status === 'unlocked' && state.vaultKey === pending.vaultKey).toBe(true)
  })

  it('unlockWithKey is refused when there is nothing to unlock', async () => {
    const { session } = make()
    await session.init()
    let failed = false
    try {
      await session.unlockWithKey({} as CryptoKey)
    } catch {
      failed = true
    }
    expect(failed).toBe(true)
  })

  it('replaceVault swaps header and records together and opens with the new key', async () => {
    const calls: unknown[] = []
    const replacer = { replaceAll: async (h: VaultHeader, r: unknown[]) => void calls.push([h.vaultId, r.length]) }
    const storage = memoryStorage()
    const session = createSession({ argon2: argon2idRaw, storage, replacer, costs: TEST_COSTS })
    await session.init()
    const first = await session.prepareVault(PASSWORD)
    await session.commitVault(first)
    const second = await session.prepareVault('a different long passphrase')
    await session.replaceVault({ header: second.header, vaultKey: second.vaultKey, records: [] })
    const state = session.getState()
    expect(state.status === 'unlocked' && state.header.vaultId === second.header.vaultId).toBe(true)
    expect(calls).toEqual([[second.header.vaultId, 0]])
  })

  it('replaceVault needs an atomic replacer', async () => {
    const { session } = make()
    await session.init()
    let failed = false
    try {
      const p = await session.prepareVault(PASSWORD)
      await session.replaceVault({ header: p.header, vaultKey: p.vaultKey, records: [] })
    } catch {
      failed = true
    }
    expect(failed).toBe(true)
  })
})
