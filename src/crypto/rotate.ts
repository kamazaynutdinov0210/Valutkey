import { importAesKey } from './aead'
import { wipe } from './ct'
import { CryptoError } from './errors'
import { DEFAULT_KDF } from './kdf'
import { openRecord, sealRecord } from './records'
import type { Argon2Fn, EncryptedRecord, KdfCosts, VaultHeader } from './types'
import { createVault, unwrapVaultKeyBytes } from './wrap'

/**
 * Makes a brand-new vault key (and a new vault id and recovery key) and re-encrypts every record under it.
 * Anyone who held the old key, for example because the old master password was exposed, cannot read anything
 * saved from now on. The master password stays the same. If any record cannot be read it stops, because
 * re-encrypting would silently lose that record.
 */
export async function rotateVaultKey(
  argon2: Argon2Fn,
  oldHeader: VaultHeader,
  currentPassword: string,
  records: EncryptedRecord[],
  costs: KdfCosts = DEFAULT_KDF,
): Promise<{ header: VaultHeader; vaultKey: CryptoKey; recoveryKey: string; records: EncryptedRecord[] }> {
  const oldBytes = await unwrapVaultKeyBytes(argon2, oldHeader, currentPassword) // proves the password
  let oldKey: CryptoKey
  try {
    oldKey = await importAesKey(oldBytes, ['encrypt', 'decrypt'])
  } finally {
    wipe(oldBytes)
  }
  const created = await createVault(argon2, currentPassword, costs)
  const reencrypted: EncryptedRecord[] = []
  for (const record of records) {
    let value: unknown
    try {
      value = await openRecord<unknown>(oldKey, oldHeader.vaultId, record)
    } catch {
      throw new CryptoError('corrupt')
    }
    reencrypted.push(await sealRecord(created.vaultKey, created.header.vaultId, record.id, value))
  }
  return { header: created.header, vaultKey: created.vaultKey, recoveryKey: created.recoveryKey, records: reencrypted }
}
