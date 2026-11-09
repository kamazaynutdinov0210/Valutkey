import { describe, expect, it } from 'vitest'
import { constantTimeEqual, wipe } from '../../src/crypto/ct'
import { fromB64, toB64 } from '../../src/crypto/encoding'
import { codeOf } from './helpers'

describe('constantTimeEqual', () => {
  it('is true for equal bytes, including empty', () => {
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true)
    expect(constantTimeEqual(new Uint8Array(0), new Uint8Array(0))).toBe(true)
  })

  it('is false for a difference in the first, middle or last byte', () => {
    const base = new Uint8Array(32).fill(7)
    for (const i of [0, 15, 31]) {
      const other = base.slice()
      other[i] = 8
      expect(constantTimeEqual(base, other)).toBe(false)
    }
  })

  it('is false for different lengths, even when one is a prefix of the other', () => {
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 0]))).toBe(false)
    expect(constantTimeEqual(new Uint8Array(0), new Uint8Array([0]))).toBe(false)
  })
})

describe('wipe', () => {
  it('zeroes every byte', () => {
    const secret = new Uint8Array([9, 9, 9, 9])
    wipe(secret)
    expect(Array.from(secret)).toEqual([0, 0, 0, 0])
  })
})

describe('base64url', () => {
  it('round-trips every byte value and every length 0..40', () => {
    const all = Uint8Array.from({ length: 256 }, (_, i) => i)
    expect(Array.from(fromB64(toB64(all)))).toEqual(Array.from(all))
    for (let n = 0; n <= 40; n++) {
      const bytes = crypto.getRandomValues(new Uint8Array(n))
      expect(Array.from(fromB64(toB64(bytes)))).toEqual(Array.from(bytes))
    }
  })

  it('uses only URL-safe characters and no padding', () => {
    expect(toB64(new Uint8Array([251, 255, 254]))).toBe('-__-')
    expect(toB64(new Uint8Array([1]))).toBe('AQ')
  })

  it('rejects text that is not base64url', async () => {
    expect(await codeOf(Promise.resolve().then(() => fromB64('not valid!')))).toBe('corrupt')
    expect(await codeOf(Promise.resolve().then(() => fromB64('a+b/')))).toBe('corrupt')
  })
})
