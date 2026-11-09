import { CryptoError } from '../../src/crypto/errors'
import type { KdfCosts } from '../../src/crypto/types'

// Smallest costs the app accepts: keeps the test suite fast. Production uses DEFAULT_KDF.
export const TEST_COSTS: KdfCosts = { memKiB: 19456, iterations: 2, parallelism: 1 }

export const hex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

export function fromHex(text: string): Uint8Array {
  const clean = text.replace(/\s/g, '')
  return Uint8Array.from(clean.match(/../g) ?? [], (h) => parseInt(h, 16))
}

/** Runs a promise and returns the CryptoError code it failed with ('no-error' if it succeeded). */
export async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
    return 'no-error'
  } catch (e) {
    return e instanceof CryptoError ? e.code : 'not-a-crypto-error'
  }
}
