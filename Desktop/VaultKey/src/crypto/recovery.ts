import { importAesKey, randomBytes } from './aead'
import { constantTimeEqual } from './ct'
import { asBuffer, utf8 } from './encoding'
import { CryptoError } from './errors'
import { hkdf } from './kdf'

// Crockford Base32: no I, L, O, U, so it is hard to misread when written down.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const PAYLOAD_BYTES = 32 // 256 random bits
const CHECK_BYTES = 3 // typo detection (1 in 16 million slip through)
const TEXT_LENGTH = ((PAYLOAD_BYTES + CHECK_BYTES) * 8) / 5 // 56 characters
const CHECK_LABEL = utf8('vaultkey-recovery-v1')
const INFO_RECOVERY = 'vaultkey/v1/recovery-kek'

async function checksum(payload: Uint8Array): Promise<Uint8Array> {
  const input = new Uint8Array(CHECK_LABEL.length + payload.length)
  input.set(CHECK_LABEL)
  input.set(payload, CHECK_LABEL.length)
  return new Uint8Array(await crypto.subtle.digest('SHA-256', asBuffer(input))).slice(0, CHECK_BYTES)
}

function base32Encode(bytes: Uint8Array): string {
  let out = ''
  let value = 0
  let bits = 0
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += ALPHABET.charAt((value >>> (bits - 5)) & 31)
      bits -= 5
    }
    value &= (1 << bits) - 1
  }
  if (bits > 0) out += ALPHABET.charAt((value << (5 - bits)) & 31)
  return out
}

function base32Decode(text: string): Uint8Array | null {
  const out: number[] = []
  let value = 0
  let bits = 0
  for (const ch of text) {
    const index = ALPHABET.indexOf(ch)
    if (index < 0) return null
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
    value &= (1 << bits) - 1
  }
  return new Uint8Array(out)
}

/** 32 secret bytes -> "XXXX-XXXX-..." (14 groups of 4) with a built-in checksum. */
export async function encodeRecoveryKey(payload: Uint8Array): Promise<string> {
  if (payload.length !== PAYLOAD_BYTES) throw new CryptoError('invalid-input')
  const full = new Uint8Array(PAYLOAD_BYTES + CHECK_BYTES)
  full.set(payload)
  full.set(await checksum(payload), PAYLOAD_BYTES)
  return base32Encode(full).match(/.{4}/g)?.join('-') ?? ''
}

/** Accepts lowercase, spaces or hyphens, and the usual look-alikes (O->0, I/L->1). */
export async function decodeRecoveryKey(text: string): Promise<Uint8Array> {
  const clean = text.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
  const bytes = clean.length === TEXT_LENGTH ? base32Decode(clean) : null
  if (!bytes || bytes.length !== PAYLOAD_BYTES + CHECK_BYTES) throw new CryptoError('invalid-recovery-key')
  const payload = bytes.slice(0, PAYLOAD_BYTES)
  if (!constantTimeEqual(bytes.slice(PAYLOAD_BYTES), await checksum(payload))) {
    throw new CryptoError('invalid-recovery-key')
  }
  return payload
}

export async function generateRecoveryKey(): Promise<{ payload: Uint8Array; text: string }> {
  const payload = randomBytes(PAYLOAD_BYTES)
  return { payload, text: await encodeRecoveryKey(payload) }
}

/** The recovery key already has full entropy, so HKDF is enough (no slow KDF needed). */
export async function recoveryKek(payload: Uint8Array): Promise<CryptoKey> {
  const bytes = await hkdf(payload, utf8(INFO_RECOVERY), 32)
  try {
    return await importAesKey(bytes, ['encrypt', 'decrypt'])
  } finally {
    bytes.fill(0)
  }
}
