import { buildAad, decrypt, encrypt, importAesKey, randomBytes } from './aead'
import { constantTimeEqual, wipe } from './ct'
import { fromB64, toB64 } from './encoding'
import { CryptoError } from './errors'
import { assertKdfParams, DEFAULT_KDF, deriveFromPassword } from './kdf'
import { decodeRecoveryKey, generateRecoveryKey, recoveryKek } from './recovery'
import type { Argon2Fn, KdfCosts, KdfParams, Sealed, VaultHeader } from './types'

type Method = 'password' | 'recovery'

const wrapAad = (vaultId: string, method: Method) => buildAad(vaultId, 'wrap', method)

export function assertHeader(h: VaultHeader): void {
  const ok =
    h.formatVersion === 1 &&
    typeof h.vaultId === 'string' &&
    h.vaultId.length > 0 &&
    fromB64(h.verifier).length === 32
  if (!ok) throw new CryptoError('invalid-header')
  assertKdfParams(h.kdf)
}

/** Turns raw Vault Key bytes into a non-extractable key and wipes the bytes. */
async function toVaultKey(raw: Uint8Array): Promise<CryptoKey> {
  try {
    return await importAesKey(raw, ['encrypt', 'decrypt'])
  } finally {
    wipe(raw)
  }
}

function newKdfParams(costs: KdfCosts): KdfParams {
  return { alg: 'argon2id', salt: toB64(randomBytes(16)), ...costs }
}

/**
 * Returns the raw Vault Key bytes after checking the master password. Only for operations that
 * must re-wrap the key (new password, new recovery key, biometric setup). The caller MUST wipe the bytes.
 */
export async function unwrapVaultKeyBytes(argon2: Argon2Fn, header: VaultHeader, password: string): Promise<Uint8Array> {
  return unwrapWithPassword(argon2, header, password)
}

async function unwrapWithPassword(argon2: Argon2Fn, header: VaultHeader, password: string): Promise<Uint8Array> {
  assertHeader(header)
  const { verifier, kek } = await deriveFromPassword(argon2, password, header.kdf)
  const matches = constantTimeEqual(verifier, fromB64(header.verifier))
  wipe(verifier)
  if (!matches) throw new CryptoError('wrong-password')
  try {
    return await decrypt(kek, header.wrapped.password, wrapAad(header.vaultId, 'password'))
  } catch {
    throw new CryptoError('corrupt') // verifier matched but the wrapped key is damaged
  }
}

async function unwrapWithRecovery(header: VaultHeader, recoveryText: string): Promise<Uint8Array> {
  assertHeader(header)
  const payload = await decodeRecoveryKey(recoveryText)
  try {
    const kek = await recoveryKek(payload)
    return await decrypt(kek, header.wrapped.recovery, wrapAad(header.vaultId, 'recovery'))
  } catch {
    throw new CryptoError('wrong-recovery-key')
  } finally {
    wipe(payload)
  }
}

/** Creates a new vault. The recovery key is returned ONCE: show it, never store it. */
export async function createVault(
  argon2: Argon2Fn,
  masterPassword: string,
  costs: KdfCosts = DEFAULT_KDF,
): Promise<{ header: VaultHeader; vaultKey: CryptoKey; recoveryKey: string }> {
  const vaultId = crypto.randomUUID()
  const kdf = newKdfParams(costs)
  const { verifier, kek } = await deriveFromPassword(argon2, masterPassword, kdf)
  const vkBytes = randomBytes(32) // the Vault Key: random, independent of any password
  const recovery = await generateRecoveryKey()
  try {
    const rkek = await recoveryKek(recovery.payload)
    const header: VaultHeader = {
      formatVersion: 1,
      vaultId,
      changedAt: Date.now(),
      kdf,
      verifier: toB64(verifier),
      wrapped: {
        password: await encrypt(kek, vkBytes, wrapAad(vaultId, 'password')),
        recovery: await encrypt(rkek, vkBytes, wrapAad(vaultId, 'recovery')),
      },
    }
    return { header, vaultKey: await toVaultKey(vkBytes), recoveryKey: recovery.text }
  } finally {
    wipe(verifier)
    wipe(vkBytes)
    wipe(recovery.payload)
  }
}

export async function unlockWithPassword(argon2: Argon2Fn, password: string, header: VaultHeader): Promise<CryptoKey> {
  return toVaultKey(await unwrapWithPassword(argon2, header, password))
}

export async function unlockWithRecovery(recoveryText: string, header: VaultHeader): Promise<CryptoKey> {
  return toVaultKey(await unwrapWithRecovery(header, recoveryText))
}

/** Re-wraps the Vault Key under a new password (new salt). Data is not re-encrypted. */
async function rewrapPassword(
  argon2: Argon2Fn,
  header: VaultHeader,
  vkBytes: Uint8Array,
  newPassword: string,
  costs: KdfCosts,
): Promise<VaultHeader> {
  try {
    const kdf = newKdfParams(costs)
    const { verifier, kek } = await deriveFromPassword(argon2, newPassword, kdf)
    const sealed: Sealed = await encrypt(kek, vkBytes, wrapAad(header.vaultId, 'password'))
    const next: VaultHeader = {
      ...header,
      changedAt: Date.now(),
      kdf,
      verifier: toB64(verifier),
      wrapped: { ...header.wrapped, password: sealed },
    }
    wipe(verifier)
    return next
  } finally {
    wipe(vkBytes)
  }
}

export async function changeMasterPassword(
  argon2: Argon2Fn,
  header: VaultHeader,
  currentPassword: string,
  newPassword: string,
  costs: KdfCosts = DEFAULT_KDF,
): Promise<VaultHeader> {
  const vk = await unwrapWithPassword(argon2, header, currentPassword)
  return rewrapPassword(argon2, header, vk, newPassword, costs)
}

export async function resetPasswordWithRecovery(
  argon2: Argon2Fn,
  header: VaultHeader,
  recoveryText: string,
  newPassword: string,
  costs: KdfCosts = DEFAULT_KDF,
): Promise<VaultHeader> {
  const vk = await unwrapWithRecovery(header, recoveryText)
  return rewrapPassword(argon2, header, vk, newPassword, costs)
}

/**
 * Makes a new recovery key for the same vault. The old recovery key stops working. Needs the current
 * master password. The returned header must only be saved after the person has stored the new key.
 */
export async function rotateRecoveryKey(
  argon2: Argon2Fn,
  header: VaultHeader,
  currentPassword: string,
): Promise<{ header: VaultHeader; recoveryKey: string }> {
  const vk = await unwrapWithPassword(argon2, header, currentPassword)
  const recovery = await generateRecoveryKey()
  try {
    const recoveryWrap = await encrypt(await recoveryKek(recovery.payload), vk, wrapAad(header.vaultId, 'recovery'))
    return {
      header: { ...header, changedAt: Date.now(), wrapped: { ...header.wrapped, recovery: recoveryWrap } },
      recoveryKey: recovery.text,
    }
  } finally {
    wipe(vk)
    wipe(recovery.payload)
  }
}
