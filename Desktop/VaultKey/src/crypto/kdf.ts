import { importAesKey } from './aead'
import { wipe } from './ct'
import { asBuffer, fromB64, utf8 } from './encoding'
import { CryptoError } from './errors'
import type { Argon2Fn, KdfCosts, KdfParams } from './types'

// 64 MiB, 3 passes: above OWASP's minimum (19 MiB, 2 passes) and still
// about a second on a mid-range phone. Stored in the header, so it can be raised later.
export const DEFAULT_KDF: KdfCosts = { memKiB: 65536, iterations: 3, parallelism: 1 }

// A header may come from a synced file we don't fully trust: refuse absurd costs
// (memory exhaustion) and weak ones (silent downgrade).
export const KDF_LIMITS = { minMemKiB: 19456, maxMemKiB: 262144, minIterations: 2, maxIterations: 10 } as const

const INFO_AUTH = 'vaultkey/v1/auth'
const INFO_KEK = 'vaultkey/v1/kek'

export function assertKdfParams(p: KdfParams): void {
  const ok =
    p.alg === 'argon2id' &&
    p.parallelism === 1 &&
    Number.isInteger(p.memKiB) &&
    Number.isInteger(p.iterations) &&
    p.memKiB >= KDF_LIMITS.minMemKiB &&
    p.memKiB <= KDF_LIMITS.maxMemKiB &&
    p.iterations >= KDF_LIMITS.minIterations &&
    p.iterations <= KDF_LIMITS.maxIterations &&
    fromB64(p.salt).length >= 16
  if (!ok) throw new CryptoError('invalid-header')
}

/** NFKC so the same typed password gives the same bytes on every keyboard and OS. */
export function normalizePassword(password: string): Uint8Array {
  return utf8(password.normalize('NFKC'))
}

/** HKDF-SHA256 (RFC 5869). Different `info` labels give independent keys from one secret. */
export async function hkdf(
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
  salt: Uint8Array = new Uint8Array(0),
): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey('raw', asBuffer(ikm), 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: asBuffer(salt), info: asBuffer(info) }, base, length * 8)
  return new Uint8Array(bits)
}

/**
 * password -> Argon2id -> two independent values:
 *   verifier: stored, lets us say "wrong password" quickly
 *   kek:      memory only, a non-extractable key that unwraps the Vault Key
 */
export async function deriveFromPassword(
  argon2: Argon2Fn,
  password: string,
  params: KdfParams,
): Promise<{ verifier: Uint8Array; kek: CryptoKey }> {
  if (password.length === 0) throw new CryptoError('invalid-input')
  assertKdfParams(params)
  const pwBytes = normalizePassword(password)
  const salt = fromB64(params.salt)
  let secret: Uint8Array | undefined
  let kekBytes: Uint8Array | undefined
  try {
    secret = await argon2(pwBytes, salt, params)
    const verifier = await hkdf(secret, utf8(INFO_AUTH), 32)
    kekBytes = await hkdf(secret, utf8(INFO_KEK), 32)
    const kek = await importAesKey(kekBytes, ['encrypt', 'decrypt'])
    return { verifier, kek }
  } finally {
    wipe(pwBytes)
    if (secret) wipe(secret)
    if (kekBytes) wipe(kekBytes)
  }
}
