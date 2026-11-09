import { bcrypt } from 'hash-wasm'
import { randomBytes } from '../crypto/aead'
import { wipe } from '../crypto/ct'
import { asBuffer, toB64, utf8 } from '../crypto/encoding'
import { DEFAULT_KDF } from '../crypto/kdf'
import type { Argon2Fn, KdfCosts } from '../crypto/types'

export const HASH_TOOL_NOTICE =
  'This is a utility for hashing any text. It is not how VaultKey protects your vault: ' +
  'your vault is encrypted with a key made from your master password (Argon2id and AES-256-GCM). ' +
  'Text you enter here is never saved.'

export type HashAlgorithm = 'sha256' | 'sha512' | 'bcrypt' | 'argon2id'

export const HASH_ALGORITHMS: { id: HashAlgorithm; label: string; note: string }[] = [
  { id: 'sha256', label: 'SHA-256', note: 'A fast fingerprint for checking files or text. Not suitable for storing passwords.' },
  { id: 'sha512', label: 'SHA-512', note: 'A fast fingerprint for checking files or text. Not suitable for storing passwords.' },
  { id: 'bcrypt', label: 'bcrypt', note: 'Made for storing passwords. Slow on purpose. Text over 72 bytes is not supported.' },
  { id: 'argon2id', label: 'Argon2id', note: 'Made for storing passwords. Slow and memory-hungry on purpose.' },
]

const BCRYPT_COST = 10 // OWASP minimum; each +1 doubles the time
const BCRYPT_MAX_BYTES = 72 // bcrypt silently ignores anything longer

export class HashToolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HashToolError'
  }
}

const hex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
const toStdB64 = (bytes: Uint8Array): string => toB64(bytes).replace(/-/g, '+').replace(/_/g, '/')

/** Standard "$argon2id$v=19$m=..,t=..,p=..$salt$hash" string (PHC format) from a raw Argon2 run. */
export async function argon2idEncoded(
  argon2: Argon2Fn,
  password: Uint8Array,
  salt: Uint8Array,
  costs: KdfCosts,
): Promise<string> {
  const hash = await argon2(password.slice(), salt, costs) // the runner may zero its copy
  try {
    const { memKiB: m, iterations: t, parallelism: p } = costs
    return `$argon2id$v=19$m=${m},t=${t},p=${p}$${toStdB64(salt)}$${toStdB64(hash)}`
  } finally {
    wipe(hash)
  }
}

/** Hashes any text. Nothing is stored or logged. SHA is for checksums; bcrypt and Argon2id are password hashes. */
export async function hashText(text: string, algorithm: HashAlgorithm, argon2: Argon2Fn): Promise<string> {
  const bytes = utf8(text)
  try {
    switch (algorithm) {
      case 'sha256':
        return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', asBuffer(bytes))))
      case 'sha512':
        return hex(new Uint8Array(await crypto.subtle.digest('SHA-512', asBuffer(bytes))))
      case 'bcrypt':
        if (bytes.length > BCRYPT_MAX_BYTES) {
          throw new HashToolError('bcrypt only reads the first 72 bytes, so this text is too long for it.')
        }
        return await bcrypt({ password: bytes, salt: randomBytes(16), costFactor: BCRYPT_COST, outputType: 'encoded' })
      case 'argon2id':
        return await argon2idEncoded(argon2, bytes, randomBytes(16), DEFAULT_KDF)
    }
  } finally {
    wipe(bytes)
  }
}
