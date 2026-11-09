import { describe, expect, it } from 'vitest'
import { argon2idRaw } from '../../src/crypto/argon2'
import { utf8 } from '../../src/crypto/encoding'
import { argon2idEncoded, HASH_ALGORITHMS, HASH_TOOL_NOTICE, hashText, HashToolError } from '../../src/tools/hashTool'

describe('hash tool: SHA', () => {
  it('matches the published SHA-256 and SHA-512 test vectors', async () => {
    expect(await hashText('abc', 'sha256', argon2idRaw)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    expect(await hashText('', 'sha256', argon2idRaw)).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
    expect(await hashText('abc', 'sha512', argon2idRaw)).toBe(
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a' +
        '2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    )
  })

  it('is deterministic and sensitive to every character', async () => {
    const a = await hashText('hello', 'sha256', argon2idRaw)
    expect(await hashText('hello', 'sha256', argon2idRaw)).toBe(a)
    expect(await hashText('hellp', 'sha256', argon2idRaw)).not.toBe(a)
  })
})

describe('hash tool: notice', () => {
  it('says plainly that it is a utility and not how the vault stores data', () => {
    expect(HASH_TOOL_NOTICE).toContain('utility')
    expect(HASH_TOOL_NOTICE).toContain('not how VaultKey protects your vault')
    expect(HASH_TOOL_NOTICE).toContain('never saved')
  })
})

describe('hash tool: guidance', () => {
  it('warns that fast SHA hashes are not for storing passwords', () => {
    for (const id of ['sha256', 'sha512']) {
      expect(HASH_ALGORITHMS.find((a) => a.id === id)?.note ?? '').toContain('Not suitable for storing passwords')
    }
  })
})

describe('hash tool: Argon2 encoding', () => {
  // Reference vector from the Argon2 project: argon2id, v=19, m=65536, t=2, p=1, "password" / "somesalt".
  it('produces the reference encoded string', async () => {
    const encoded = await argon2idEncoded(argon2idRaw, utf8('password'), utf8('somesalt'), {
      memKiB: 65536,
      iterations: 2,
      parallelism: 1,
    })
    expect(encoded).toBe('$argon2id$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$CTFhFdXPJO1aFaMaO6Mm5c8y7cJHAph8ArZWb2GRPPc')
  })
})

describe('hash tool: bcrypt errors', () => {
  it('refuses text bcrypt would silently cut off', async () => {
    let error: unknown
    try {
      await hashText('x'.repeat(73), 'bcrypt', argon2idRaw)
    } catch (e) {
      error = e
    }
    expect(error instanceof HashToolError).toBe(true)
  })
})
