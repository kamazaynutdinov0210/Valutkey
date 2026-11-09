import type { Argon2Fn, EncryptedRecord, VaultHeader } from '../crypto/types'
import { unlockWithPassword, unlockWithRecovery } from '../crypto/wrap'
import type { Session } from '../vault/session'
import type { RecordStorage } from '../vault/storage'
import { openManifest, parseVaultFile, type Manifest, type VaultFile } from './file'
import type { SyncStateStore } from './service'

export type Secret = { password: string } | { recoveryKey: string }

/**
 * Opens a backup file: the password or recovery key must unlock the file's own header, and the file must
 * pass its integrity check. Nothing is written anywhere.
 */
export async function openBackup(text: string, secret: Secret, argon2: Argon2Fn): Promise<{ file: VaultFile; vaultKey: CryptoKey; manifest: Manifest }> {
  const file = parseVaultFile(text)
  const vaultKey =
    'password' in secret
      ? await unlockWithPassword(argon2, secret.password, file.header)
      : await unlockWithRecovery(secret.recoveryKey, file.header)
  return { file, vaultKey, manifest: await openManifest(vaultKey, file) }
}

/** Sets up this device from a backup file (a new device, or after the browser cleared its data). */
export async function restoreFromText(input: {
  text: string
  secret: Secret
  argon2: Argon2Fn
  records: RecordStorage
  state: SyncStateStore
  session: Pick<Session, 'adoptVault'>
  newId?: () => string
}): Promise<void> {
  const { file, vaultKey, manifest } = await openBackup(input.text, input.secret, input.argon2)
  await input.records.clear()
  await input.records.putMany(file.records)
  await input.state.save({ deviceId: (input.newId ?? (() => crypto.randomUUID()))(), revision: manifest.revision, lastSyncedAt: null })
  await input.session.adoptVault(file.header, vaultKey) // the header goes in last: a vault "exists" only once it is saved
}

/**
 * Replaces the vault on this device with the one in a file (for example after another device made a new
 * vault key). Everything on this device that is not in the file is lost, so the caller must ask first.
 */
export async function replaceFromText(input: {
  text: string
  secret: Secret
  argon2: Argon2Fn
  state: SyncStateStore
  session: Pick<Session, 'replaceVault'>
  afterReplace?: () => Promise<void> // for example: forget the old biometric setup
  newId?: () => string
}): Promise<{ header: VaultHeader; records: EncryptedRecord[] }> {
  const { file, vaultKey, manifest } = await openBackup(input.text, input.secret, input.argon2)
  await input.session.replaceVault({ header: file.header, vaultKey, records: file.records })
  await input.state.save({ deviceId: (input.newId ?? (() => crypto.randomUUID()))(), revision: manifest.revision, lastSyncedAt: null })
  await input.afterReplace?.()
  return { header: file.header, records: file.records }
}
