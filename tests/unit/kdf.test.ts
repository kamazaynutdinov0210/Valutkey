import { describe, expect, it } from 'vitest'
import { argon2idRaw } from '../../src/crypto/argon2'
import { utf8 } from '../../src/crypto/encoding'
import { assertAdoptsKdfParams, assertKdfParams, hkdf, isWeakerKdf, kdfCost, normalizePassword } from '../../src/crypto/kdf'
import type { KdfParams } from '../../src/crypto/types'
import { codeOf, fromHex, hex } from './helpers'

describe('Argon2id', () => {
  // Reference vector from the Argon2 project's own test suite (phc-winner-argon2, test.c):
  // argon2id, v=19, m=65536 KiB, t=2, p=1, password "password", salt "somesalt".
  it('matches the reference implementation', async () => {
    const hash = await argon2idRaw(utf8('password'), utf8('somesalt'), { memKiB: 65536, iterations: 2, parallelism: 1 })
    expect(hex(hash)).toBe('09316115d5cf24ed5a15a31a3ba326e5cf32edc24702987c02b6566f61913cf7')
  })

  it('gives different output for a different salt or password', async () => {
    const costs = { memKiB: 19456, iterations: 2, parallelism: 1 } as const
    const a = hex(await argon2idRaw(utf8('pw'), utf8('saltsalt'), costs))
    const b = hex(await argon2idRaw(utf8('pw'), utf8('saltsalu'), costs))
    const c = hex(await argon2idRaw(utf8('px'), utf8('saltsalt'), costs))
    expect(new Set([a, b, c]).size).toBe(3)
  })
})

describe('HKDF-SHA256', () => {
  it('matches RFC 5869 test case 1', async () => {
    const okm = await hkdf(
      fromHex('0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b'),
      fromHex('f0f1f2f3f4f5f6f7f8f9'),
      42,
      fromHex('000102030405060708090a0b0c'),
    )
    expect(hex(okm)).toBe(
      '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865',
    )
  })

  it('gives independent keys for different labels', async () => {
    const ikm = new Uint8Array(32).fill(5)
    expect(hex(await hkdf(ikm, utf8('auth'), 32))).not.toBe(hex(await hkdf(ikm, utf8('kek'), 32)))
  })
})

describe('normalizePassword', () => {
  it('treats composed and decomposed Unicode (and full-width forms) as the same password', () => {
    expect(hex(normalizePassword('caf\u00e9'))).toBe(hex(normalizePassword('cafe\u0301')))
    expect(hex(normalizePassword('ＡＢＣ１２３'))).toBe(hex(normalizePassword('ABC123')))
  })
})

describe('KDF policy', () => {
  const salt = 'AAAAAAAAAAAAAAAAAAAAAA' // 16 zero bytes, base64url
  const params = (memKiB: number, iterations: number): KdfParams => ({ alg: 'argon2id', salt, memKiB, iterations, parallelism: 1 })

  it('rejects settings below the absolute limits', () => {
    expect(() => assertKdfParams(params(1024, 2))).toThrow()
    expect(() => assertKdfParams(params(65536, 1))).toThrow()
    expect(() => assertKdfParams(params(4 * 1024 * 1024, 2))).toThrow()
  })

  it('ranks cost by memory times iterations', () => {
    const strong = params(65536, 3)
    const weak = params(65536, 2)
    expect(kdfCost(strong)).toBeGreaterThan(kdfCost(weak))
    expect(isWeakerKdf(weak, strong)).toBe(true)
    expect(isWeakerKdf(strong, weak)).toBe(false)
  })

  it('allows equal or stronger headers on adoption', () => {
    const current = params(19456, 2)
    expect(() => assertAdoptsKdfParams(params(19456, 2), current)).not.toThrow()
    expect(() => assertAdoptsKdfParams(params(65536, 3), current)).not.toThrow()
  })

  it('refuses a silent downgrade on adoption', async () => {
    const current = params(65536, 3)
    const adopt = Promise.resolve().then(() => assertAdoptsKdfParams(params(19456, 2), current))
    expect(await codeOf(adopt)).toBe('weak-header')
  })

  it('still rejects absurd headers during adoption', () => {
    const current = params(19456, 2)
    expect(() => assertAdoptsKdfParams(params(1024, 2), current)).toThrow()
    expect(() => assertAdoptsKdfParams(params(4 * 1024 * 1024, 2), current)).toThrow()
  })
})
