import { describe, expect, it } from 'vitest'
import { buildAad, decrypt, encrypt, importAesKey, randomBytes } from '../../src/crypto/aead'
import { fromB64, toB64, utf8, fromUtf8 } from '../../src/crypto/encoding'
import { codeOf, fromHex } from './helpers'

const key = () => importAesKey(randomBytes(32), ['encrypt', 'decrypt'])
const aad = buildAad('vault', 'record', 'r1', '1')

describe('AES-256-GCM', () => {
  it('matches the official GCM test vector (NIST/McGrew-Viega test case 16)', async () => {
    const k = await importAesKey(
      fromHex('feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308'),
      ['decrypt'],
    )
    const ciphertextAndTag =
      '522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa' +
      '8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662' +
      '76fc6ece0f4e1768cddf8853bb2d551b'
    const plain = await decrypt(
      k,
      { iv: toB64(fromHex('cafebabefacedbaddecaf888')), ct: toB64(fromHex(ciphertextAndTag)) },
      fromHex('feedfacedeadbeeffeedfacedeadbeefabaddad2'),
    )
    expect(Array.from(plain)).toEqual(
      Array.from(
        fromHex(
          'd9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a72' +
            '1c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b39',
        ),
      ),
    )
  })

  it('round-trips text', async () => {
    const k = await key()
    const sealed = await encrypt(k, utf8('hunter2 ✓'), aad)
    expect(fromUtf8(await decrypt(k, sealed, aad))).toBe('hunter2 ✓')
  })

  it('uses a fresh IV every time, so equal plaintexts give different ciphertexts', async () => {
    const k = await key()
    const a = await encrypt(k, utf8('same'), aad)
    const b = await encrypt(k, utf8('same'), aad)
    expect(a.iv).not.toBe(b.iv)
    expect(a.ct).not.toBe(b.ct)
    expect(fromB64(a.iv)).toHaveLength(12)
  })

  it('fails with the wrong key', async () => {
    const sealed = await encrypt(await key(), utf8('secret'), aad)
    expect(await codeOf(decrypt(await key(), sealed, aad))).toBe('decrypt-failed')
  })

  it('fails when the context (AAD) differs', async () => {
    const k = await key()
    const sealed = await encrypt(k, utf8('secret'), aad)
    expect(await codeOf(decrypt(k, sealed, buildAad('vault', 'record', 'r2', '1')))).toBe('decrypt-failed')
  })

  it('fails when the ciphertext or IV is changed by even one bit', async () => {
    const k = await key()
    const sealed = await encrypt(k, utf8('secret'), aad)
    const ct = fromB64(sealed.ct)
    ct[0] = (ct[0] ?? 0) ^ 1
    expect(await codeOf(decrypt(k, { ...sealed, ct: toB64(ct) }, aad))).toBe('decrypt-failed')
    const iv = fromB64(sealed.iv)
    iv[0] = (iv[0] ?? 0) ^ 1
    expect(await codeOf(decrypt(k, { ...sealed, iv: toB64(iv) }, aad))).toBe('decrypt-failed')
  })

  it('fails on truncated ciphertext and garbage input', async () => {
    const k = await key()
    const sealed = await encrypt(k, utf8('secret'), aad)
    expect(await codeOf(decrypt(k, { ...sealed, ct: sealed.ct.slice(0, 8) }, aad))).toBe('decrypt-failed')
    expect(await codeOf(decrypt(k, { iv: '!!', ct: '??' }, aad))).toBe('decrypt-failed')
  })

  it('creates keys that cannot be exported', async () => {
    const k = await key()
    expect(k.extractable).toBe(false)
    expect(await codeOf(crypto.subtle.exportKey('raw', k).then(() => undefined))).not.toBe('no-error')
  })

  it('rejects wrong key sizes and ambiguous AAD parts', async () => {
    expect(await codeOf(importAesKey(new Uint8Array(16), ['encrypt']))).toBe('invalid-input')
    expect(() => buildAad('a|b')).toThrow()
  })
})
