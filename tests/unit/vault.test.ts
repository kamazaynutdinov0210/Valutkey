import { beforeAll, describe, expect, it } from 'vitest'
import { argon2idRaw } from '../../src/crypto/argon2'
import { openRecord, sealRecord } from '../../src/crypto/records'
import type { VaultHeader } from '../../src/crypto/types'
import {
  changeMasterPassword,
  createVault,
  resetPasswordWithRecovery,
  unlockWithPassword,
  unlockWithRecovery,
} from '../../src/crypto/wrap'
import { codeOf, TEST_COSTS } from './helpers'

const PASSWORD = 'correct horse battery staple'
const NEW_PASSWORD = 'a different long passphrase'
const argon2 = argon2idRaw

let header: VaultHeader
let vaultKey: CryptoKey
let recoveryKey: string

beforeAll(async () => {
  ;({ header, vaultKey, recoveryKey } = await createVault(argon2, PASSWORD, TEST_COSTS))
})

const clone = (h: VaultHeader): VaultHeader => structuredClone(h)

describe('create and unlock', () => {
  it('unlocks with the right password and decrypts data made before', async () => {
    const record = await sealRecord(vaultKey, header.vaultId, 'e1', { title: 'Bank', password: 'p@ss' })
    const unlocked = await unlockWithPassword(argon2, PASSWORD, header)
    expect(await openRecord(unlocked, header.vaultId, record)).toEqual({ title: 'Bank', password: 'p@ss' })
  })

  it('rejects a wrong password, including near-misses', async () => {
    expect(await codeOf(unlockWithPassword(argon2, 'wrong', header))).toBe('wrong-password')
    expect(await codeOf(unlockWithPassword(argon2, PASSWORD + ' ', header))).toBe('wrong-password')
    expect(await codeOf(unlockWithPassword(argon2, '', header))).toBe('invalid-input')
  })

  it('accepts the same password typed in a different Unicode form', async () => {
    const { header: h } = await createVault(argon2, 'caf\u00e9 au lait 2024', TEST_COSTS)
    expect(await codeOf(unlockWithPassword(argon2, 'cafe\u0301 au lait 2024', h))).toBe('no-error')
  })

  it('never stores the password or any raw key in the header', () => {
    const json = JSON.stringify(header)
    expect(json).not.toContain(PASSWORD)
    expect(json).not.toContain(recoveryKey.replace(/-/g, ''))
  })

  it('gives each vault its own salt, id, verifier and wrapped key', async () => {
    const { header: other } = await createVault(argon2, PASSWORD, TEST_COSTS)
    expect(other.kdf.salt).not.toBe(header.kdf.salt)
    expect(other.vaultId).not.toBe(header.vaultId)
    expect(other.verifier).not.toBe(header.verifier)
    expect(other.wrapped.password.ct).not.toBe(header.wrapped.password.ct)
  })

  it('keeps the Vault Key non-extractable', async () => {
    expect(vaultKey.extractable).toBe(false)
    const unlocked = await unlockWithPassword(argon2, PASSWORD, header)
    expect(unlocked.extractable).toBe(false)
  })
})

describe('recovery key', () => {
  it('unlocks the same vault', async () => {
    const record = await sealRecord(vaultKey, header.vaultId, 'e2', { n: 1 })
    const unlocked = await unlockWithRecovery(recoveryKey, header)
    expect(await openRecord(unlocked, header.vaultId, record)).toEqual({ n: 1 })
  })

  it('rejects a well-formed but wrong key, and a mistyped key', async () => {
    const { recoveryKey: someoneElses } = await createVault(argon2, PASSWORD, TEST_COSTS)
    expect(await codeOf(unlockWithRecovery(someoneElses, header))).toBe('wrong-recovery-key')
    const typo = recoveryKey.slice(0, -1) + (recoveryKey.endsWith('0') ? '1' : '0')
    expect(await codeOf(unlockWithRecovery(typo, header))).toBe('invalid-recovery-key')
  })
})

describe('changing the password', () => {
  it('re-wraps the key: old password stops working, new works, data and recovery survive', async () => {
    const record = await sealRecord(vaultKey, header.vaultId, 'e3', { keep: true })
    const next = await changeMasterPassword(argon2, header, PASSWORD, NEW_PASSWORD, TEST_COSTS)

    expect(next.kdf.salt).not.toBe(header.kdf.salt)
    expect(next.vaultId).toBe(header.vaultId)
    expect(await codeOf(unlockWithPassword(argon2, PASSWORD, next))).toBe('wrong-password')
    const unlocked = await unlockWithPassword(argon2, NEW_PASSWORD, next)
    expect(await openRecord(unlocked, header.vaultId, record)).toEqual({ keep: true })
    expect(await codeOf(unlockWithRecovery(recoveryKey, next))).toBe('no-error')
  })

  it('requires the current password', async () => {
    expect(await codeOf(changeMasterPassword(argon2, header, 'nope', NEW_PASSWORD, TEST_COSTS))).toBe('wrong-password')
  })

  it('can reset a forgotten password using the recovery key', async () => {
    const next = await resetPasswordWithRecovery(argon2, header, recoveryKey, NEW_PASSWORD, TEST_COSTS)
    expect(await codeOf(unlockWithPassword(argon2, PASSWORD, next))).toBe('wrong-password')
    expect(await codeOf(unlockWithPassword(argon2, NEW_PASSWORD, next))).toBe('no-error')
  })
})

describe('tampering and unsafe headers', () => {
  it('detects a damaged wrapped key', async () => {
    const bad = clone(header)
    bad.wrapped.password.ct = header.wrapped.password.ct.slice(0, -4) + 'AAAA'
    expect(await codeOf(unlockWithPassword(argon2, PASSWORD, bad))).toBe('corrupt')
  })

  it('refuses a header whose vault id was changed (it is bound into the encryption)', async () => {
    const bad = clone(header)
    bad.vaultId = crypto.randomUUID()
    expect(await codeOf(unlockWithPassword(argon2, PASSWORD, bad))).toBe('corrupt')
  })

  it('refuses to use the recovery-wrapped key in the password slot (and vice versa)', async () => {
    const swapped = clone(header)
    swapped.wrapped.password = header.wrapped.recovery
    expect(await codeOf(unlockWithPassword(argon2, PASSWORD, swapped))).toBe('corrupt')
  })

  it('refuses downgraded or absurd KDF settings from a synced file', async () => {
    const weak = clone(header)
    weak.kdf.memKiB = 1024
    expect(await codeOf(unlockWithPassword(argon2, PASSWORD, weak))).toBe('invalid-header')
    const huge = clone(header)
    huge.kdf.memKiB = 4 * 1024 * 1024
    expect(await codeOf(unlockWithPassword(argon2, PASSWORD, huge))).toBe('invalid-header')
    const fewPasses = clone(header)
    fewPasses.kdf.iterations = 1
    expect(await codeOf(unlockWithPassword(argon2, PASSWORD, fewPasses))).toBe('invalid-header')
  })

  it('refuses an unknown format version', async () => {
    const bad = { ...clone(header), formatVersion: 2 } as unknown as VaultHeader
    expect(await codeOf(unlockWithPassword(argon2, PASSWORD, bad))).toBe('invalid-header')
  })
})

describe('encrypted records', () => {
  it('cannot be moved to another record id, another vault, or another version', async () => {
    const record = await sealRecord(vaultKey, header.vaultId, 'e4', { secret: 1 })
    expect(await codeOf(openRecord(vaultKey, header.vaultId, { ...record, id: 'e5' }))).toBe('decrypt-failed')
    expect(await codeOf(openRecord(vaultKey, crypto.randomUUID(), record))).toBe('decrypt-failed')
    expect(await codeOf(openRecord(vaultKey, header.vaultId, { ...record, v: 2 as unknown as 1 }))).toBe('decrypt-failed')
  })

  it('does not contain the plaintext', async () => {
    const record = await sealRecord(vaultKey, header.vaultId, 'e6', { password: 'SuperSecret123' })
    expect(JSON.stringify(record)).not.toContain('SuperSecret123')
  })
})

describe('master password change time', () => {
  it('is recorded at creation and moves forward on a change or a reset', async () => {
    expect(typeof header.changedAt).toBe('number')
    await new Promise((r) => setTimeout(r, 5))
    const changed = await changeMasterPassword(argon2, header, PASSWORD, NEW_PASSWORD, TEST_COSTS)
    expect((changed.changedAt ?? 0) > (header.changedAt ?? 0)).toBe(true)
    await new Promise((r) => setTimeout(r, 5))
    const reset = await resetPasswordWithRecovery(argon2, changed, recoveryKey, 'yet another long passphrase', TEST_COSTS)
    expect((reset.changedAt ?? 0) > (changed.changedAt ?? 0)).toBe(true)
  })
})
