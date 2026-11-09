import { describe, expect, it } from 'vitest'
import { decodeRecoveryKey, encodeRecoveryKey, generateRecoveryKey } from '../../src/crypto/recovery'
import { codeOf } from './helpers'

const FIXED = Uint8Array.from({ length: 32 }, (_, i) => i * 7 + 1)

describe('recovery key', () => {
  it('has 14 groups of 4 readable characters', async () => {
    const { text } = await generateRecoveryKey()
    expect(text).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){13}[0-9A-HJKMNP-TV-Z]{4}$/)
  })

  it('is different every time', async () => {
    const a = await generateRecoveryKey()
    const b = await generateRecoveryKey()
    expect(a.text).not.toBe(b.text)
  })

  it('round-trips, and forgives case, spaces and look-alike letters', async () => {
    const text = await encodeRecoveryKey(FIXED)
    expect(Array.from(await decodeRecoveryKey(text))).toEqual(Array.from(FIXED))
    const messy = text.toLowerCase().replace(/-/g, '  ').replace(/0/g, 'o').replace(/1/g, 'l')
    expect(Array.from(await decodeRecoveryKey(messy))).toEqual(Array.from(FIXED))
  })

  it('catches any single mistyped character', async () => {
    const text = await encodeRecoveryKey(FIXED)
    const chars = text.replace(/-/g, '')
    const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
    for (let i = 0; i < chars.length; i++) {
      const replacement = alphabet.charAt((alphabet.indexOf(chars.charAt(i)) + 1) % 32)
      const typo = chars.slice(0, i) + replacement + chars.slice(i + 1)
      expect(await codeOf(decodeRecoveryKey(typo))).toBe('invalid-recovery-key')
    }
  })

  it('rejects wrong length and characters outside the alphabet', async () => {
    const text = await encodeRecoveryKey(FIXED)
    expect(await codeOf(decodeRecoveryKey(text.slice(0, -2)))).toBe('invalid-recovery-key')
    expect(await codeOf(decodeRecoveryKey('U'.repeat(56)))).toBe('invalid-recovery-key')
    expect(await codeOf(decodeRecoveryKey(''))).toBe('invalid-recovery-key')
  })
})
