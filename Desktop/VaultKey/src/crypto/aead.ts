import { CryptoError } from './errors'
import { asBuffer, fromB64, toB64, utf8 } from './encoding'
import type { Sealed } from './types'

const IV_BYTES = 12 // 96-bit random IV: the size GCM is designed for
const KEY_BYTES = 32 // AES-256

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

/**
 * Additional authenticated data: binds a ciphertext to its context (vault, record id,
 * purpose) so it cannot be moved or swapped without detection.
 */
export function buildAad(...parts: string[]): Uint8Array {
  if (parts.some((p) => p.includes('|'))) throw new CryptoError('invalid-input')
  return utf8(parts.join('|'))
}

/** Imports raw key bytes as a NON-extractable AES-GCM key. */
export async function importAesKey(raw: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  if (raw.length !== KEY_BYTES) throw new CryptoError('invalid-input')
  return crypto.subtle.importKey('raw', asBuffer(raw), 'AES-GCM', false, usages)
}

export async function encrypt(key: CryptoKey, plaintext: Uint8Array, aad: Uint8Array): Promise<Sealed> {
  const iv = randomBytes(IV_BYTES) // fresh for every encryption, never reused
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: asBuffer(iv), additionalData: asBuffer(aad), tagLength: 128 },
      key,
      asBuffer(plaintext),
    ),
  )
  return { iv: toB64(iv), ct: toB64(ct) }
}

export async function decrypt(key: CryptoKey, sealed: Sealed, aad: Uint8Array): Promise<Uint8Array> {
  try {
    const iv = fromB64(sealed.iv)
    if (iv.length !== IV_BYTES) throw new CryptoError('decrypt-failed')
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: asBuffer(iv), additionalData: asBuffer(aad), tagLength: 128 },
      key,
      asBuffer(fromB64(sealed.ct)),
    )
    return new Uint8Array(plain)
  } catch {
    // Same error for wrong key, wrong context, or tampering: no hints for an attacker.
    throw new CryptoError('decrypt-failed')
  }
}
