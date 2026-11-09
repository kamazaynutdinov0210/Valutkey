import { CryptoError } from './errors'

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

export const utf8 = (text: string): Uint8Array => encoder.encode(text)
export const fromUtf8 = (bytes: Uint8Array): string => decoder.decode(bytes)

export function toB64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromB64(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new CryptoError('corrupt')
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4)
  try {
    const binary = atob(padded)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
    return out
  } catch {
    throw new CryptoError('corrupt')
  }
}

/** Satisfies newer TypeScript versions, which are stricter about the byte-array types Web Crypto accepts. */
export const asBuffer = (bytes: Uint8Array): BufferSource => bytes as unknown as BufferSource
