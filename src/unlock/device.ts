import { buildAad, decrypt, encrypt, importAesKey, randomBytes } from '../crypto/aead'
import { wipe } from '../crypto/ct'
import { fromB64, toB64, utf8 } from '../crypto/encoding'
import { hkdf } from '../crypto/kdf'
import type { Sealed } from '../crypto/types'

/**
 * Something that can produce a secret value that only this device's authenticator (fingerprint, face or PIN)
 * can reproduce. In the browser that is a passkey with the WebAuthn "PRF" extension; tests use a stand-in.
 */
export interface PrfProvider {
  isAvailable(): Promise<boolean>
  create(): Promise<{ credentialId: Uint8Array; prfEnabled: boolean }>
  evaluate(credentialId: Uint8Array, salt: Uint8Array): Promise<Uint8Array>
}

/** Device-local, never in a backup or sync file. Holds the Vault Key encrypted under the authenticator's secret. */
export interface DeviceUnlockRecord {
  credentialId: string
  prfSalt: string
  wrapped: Sealed
  vaultId: string
}
export interface DeviceUnlockStore {
  load(): Promise<DeviceUnlockRecord | null>
  save(record: DeviceUnlockRecord | null): Promise<void>
}

export class DeviceUnlockError extends Error {
  code: 'unsupported' | 'failed' | 'stale'
  constructor(code: 'unsupported' | 'failed' | 'stale') {
    super(code)
    this.name = 'DeviceUnlockError'
    this.code = code
  }
}

const INFO = 'vaultkey/v1/device-kek'
const aad = (vaultId: string) => buildAad(vaultId, 'device')

async function keyFrom(secret: Uint8Array): Promise<CryptoKey> {
  const bytes = await hkdf(secret, utf8(INFO), 32)
  try {
    return await importAesKey(bytes, ['encrypt', 'decrypt'])
  } finally {
    wipe(bytes)
    wipe(secret)
  }
}

/**
 * Turns on device unlock. `vaultKeyBytes` come from the master password (the caller proved it), so
 * setting this up always needs the password. Nothing is saved unless the device really supports it.
 */
export async function enrollDeviceUnlock(input: {
  provider: PrfProvider
  vaultKeyBytes: Uint8Array
  vaultId: string
  store: DeviceUnlockStore
}): Promise<void> {
  const { credentialId, prfEnabled } = await input.provider.create()
  if (!prfEnabled) throw new DeviceUnlockError('unsupported')
  const prfSalt = randomBytes(32)
  const kek = await keyFrom(await input.provider.evaluate(credentialId, prfSalt)) // a second prompt proves it works
  const wrapped = await encrypt(kek, input.vaultKeyBytes, aad(input.vaultId))
  await input.store.save({ credentialId: toB64(credentialId), prfSalt: toB64(prfSalt), wrapped, vaultId: input.vaultId })
}

/** Asks the authenticator for its secret and uses it to open the Vault Key (as a non-extractable key). */
export async function unlockWithDevice(input: { provider: PrfProvider; vaultId: string; store: DeviceUnlockStore }): Promise<CryptoKey> {
  const record = await input.store.load()
  if (!record || record.vaultId !== input.vaultId) throw new DeviceUnlockError('stale')
  const kek = await keyFrom(await input.provider.evaluate(fromB64(record.credentialId), fromB64(record.prfSalt)))
  let bytes: Uint8Array
  try {
    bytes = await decrypt(kek, record.wrapped, aad(input.vaultId))
  } catch {
    throw new DeviceUnlockError('failed')
  }
  try {
    return await importAesKey(bytes, ['encrypt', 'decrypt'])
  } finally {
    wipe(bytes)
  }
}

export const clearDeviceUnlock = (store: DeviceUnlockStore): Promise<void> => store.save(null)
