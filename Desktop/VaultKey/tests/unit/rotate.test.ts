import { beforeAll, describe, expect, it } from 'vitest'
import { argon2idRaw } from '../../src/crypto/argon2'
import { CryptoError } from '../../src/crypto/errors'
import { openRecord, sealRecord } from '../../src/crypto/records'
import { rotateVaultKey } from '../../src/crypto/rotate'
import type { EncryptedRecord, VaultHeader } from '../../src/crypto/types'
import { createVault, rotateRecoveryKey, unlockWithPassword, unlockWithRecovery } from '../../src/crypto/wrap'
import { codeOf, TEST_COSTS } from './helpers'

const PASSWORD = 'correct horse battery staple'
let vault: { header: VaultHeader; vaultKey: CryptoKey; recoveryKey: string }
let records: EncryptedRecord[]

beforeAll(async () => {
  vault = await createVault(argon2idRaw, PASSWORD, TEST_COSTS)
  records = [
    await sealRecord(vault.vaultKey, vault.header.vaultId, 'e1', { title: 'Bank', password: 'p1' }),
    await sealRecord(vault.vaultKey, vault.header.vaultId, 'e2', { title: 'Mail', password: 'p2' }),
  ]
})

describe('a new recovery key', () => {
  it('replaces the old one, keeps the master password and the data', async () => {
    await new Promise((r) => setTimeout(r, 5))
    const { header, recoveryKey } = await rotateRecoveryKey(argon2idRaw, vault.header, PASSWORD)
    expect(recoveryKey).not.toBe(vault.recoveryKey)
    expect(await codeOf(unlockWithRecovery(vault.recoveryKey, header))).toBe('wrong-recovery-key')
    const viaNew = await unlockWithRecovery(recoveryKey, header)
    expect(await openRecord(viaNew, header.vaultId, records[0] as EncryptedRecord)).toEqual({ title: 'Bank', password: 'p1' })
    expect(await codeOf(unlockWithPassword(argon2idRaw, PASSWORD, header))).toBe('no-error')
    expect(header.vaultId).toBe(vault.header.vaultId)
    expect((header.changedAt ?? 0) > (vault.header.changedAt ?? 0)).toBe(true)
  })
  it('needs the current master password', async () => {
    expect(await codeOf(rotateRecoveryKey(argon2idRaw, vault.header, 'not the password'))).toBe('wrong-password')
  })
})

describe('a new vault key', () => {
  it('re-encrypts everything: the new key reads it, the old key cannot, and the id changes', async () => {
    const next = await rotateVaultKey(argon2idRaw, vault.header, PASSWORD, records, TEST_COSTS)
    expect(next.header.vaultId).not.toBe(vault.header.vaultId)
    expect(next.records.map((r) => r.id)).toEqual(['e1', 'e2'])
    expect(await openRecord(next.vaultKey, next.header.vaultId, next.records[1] as EncryptedRecord)).toEqual({ title: 'Mail', password: 'p2' })
    expect(await codeOf(openRecord(vault.vaultKey, next.header.vaultId, next.records[0] as EncryptedRecord))).toBe('decrypt-failed')
    expect(await codeOf(openRecord(vault.vaultKey, vault.header.vaultId, next.records[0] as EncryptedRecord))).toBe('decrypt-failed')
  })

  it('keeps the master password, and makes the old recovery key useless', async () => {
    const next = await rotateVaultKey(argon2idRaw, vault.header, PASSWORD, records, TEST_COSTS)
    const key = await unlockWithPassword(argon2idRaw, PASSWORD, next.header)
    expect(await openRecord(key, next.header.vaultId, next.records[0] as EncryptedRecord)).toEqual({ title: 'Bank', password: 'p1' })
    expect(await codeOf(unlockWithRecovery(vault.recoveryKey, next.header))).toBe('wrong-recovery-key')
    expect(await codeOf(unlockWithRecovery(next.recoveryKey, next.header))).toBe('no-error')
    expect(next.header.kdf.salt).not.toBe(vault.header.kdf.salt)
  })

  it('works on an empty vault', async () => {
    const next = await rotateVaultKey(argon2idRaw, vault.header, PASSWORD, [], TEST_COSTS)
    expect(next.records).toEqual([])
  })

  it('needs the master password', async () => {
    expect(await codeOf(rotateVaultKey(argon2idRaw, vault.header, 'nope nope nope', records, TEST_COSTS))).toBe('wrong-password')
  })

  it('refuses to continue if a record cannot be read, rather than losing it', async () => {
    const damaged = [...records, { ...(records[0] as EncryptedRecord), id: 'e3', ct: (records[0] as EncryptedRecord).ct.slice(0, -4) + 'AAAA' }]
    let error: unknown
    try {
      await rotateVaultKey(argon2idRaw, vault.header, PASSWORD, damaged, TEST_COSTS)
    } catch (e) {
      error = e
    }
    expect(error instanceof CryptoError && error.code === 'corrupt').toBe(true)
  })
})
