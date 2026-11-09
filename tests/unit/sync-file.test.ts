import { describe, expect, it } from 'vitest'
import { importAesKey, randomBytes } from '../../src/crypto/aead'
import { sealRecord } from '../../src/crypto/records'
import type { VaultHeader } from '../../src/crypto/types'
import { canonicalJson } from '../../src/sync/canonical'
import { buildVaultFile, openManifest, parseVaultFile, SyncError, type VaultFile } from '../../src/sync/file'

const header = (over: Partial<VaultHeader> = {}): VaultHeader => ({
  formatVersion: 1,
  vaultId: 'vault-1',
  changedAt: 5,
  kdf: { alg: 'argon2id', salt: 'AAAAAAAAAAAAAAAAAAAAAA', memKiB: 19456, iterations: 2, parallelism: 1 },
  verifier: 'v',
  wrapped: { password: { iv: 'a', ct: 'b' }, recovery: { iv: 'c', ct: 'd' } },
  ...over,
})
const key = () => importAesKey(randomBytes(32), ['encrypt', 'decrypt'])
const codeOf = async (p: Promise<unknown> | (() => unknown)): Promise<string> => {
  try {
    await (typeof p === 'function' ? p() : p)
    return 'no-error'
  } catch (e) {
    return e instanceof SyncError ? e.code : 'other'
  }
}

async function sample(revision = 3) {
  const vaultKey = await key()
  const records = [
    await sealRecord(vaultKey, 'vault-1', 'e1', { n: 1 }),
    await sealRecord(vaultKey, 'vault-1', 'e2', { n: 2 }),
    await sealRecord(vaultKey, 'vault-1', 'e3', { n: 3 }),
  ]
  const file = await buildVaultFile({ vaultKey, header: header(), records, revision, deviceId: 'dev-1', now: 1234 })
  return { vaultKey, file, text: JSON.stringify(file) }
}
const clone = (f: VaultFile): VaultFile => JSON.parse(JSON.stringify(f))

describe('canonicalJson', () => {
  it('ignores key order and undefined values', () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: undefined }] })).toBe(canonicalJson({ a: [2, { c: undefined, d: 1 }], b: 1 }))
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }))
  })
})

describe('build, parse and open', () => {
  it('round-trips and reports the revision from the sealed manifest', async () => {
    const { vaultKey, text } = await sample(7)
    const manifest = await openManifest(vaultKey, parseVaultFile(text))
    expect([manifest.revision, manifest.deviceId, manifest.recordCount, manifest.headerChangedAt]).toEqual([7, 'dev-1', 3, 5])
  })

  it('keeps nothing readable: no titles, passwords or key material in the text', async () => {
    const { text } = await sample()
    expect(text).not.toContain('"revision"') // the manifest is sealed, not plain
    expect(text).toContain('"format":"vaultkey-vault"')
  })

  it('cannot be opened with a different vault key', async () => {
    const { file } = await sample()
    expect(await codeOf(openManifest(await key(), file))).toBe('unreadable')
  })
})

describe('integrity: a cloud service cannot quietly change the file', () => {
  it('detects a removed record', async () => {
    const { vaultKey, file } = await sample()
    const f = clone(file)
    f.records.pop()
    expect(await codeOf(openManifest(vaultKey, f))).toBe('altered')
  })
  it('detects an added record', async () => {
    const { vaultKey, file } = await sample()
    const f = clone(file)
    f.records.push({ id: 'e9', v: 1, iv: 'zzzz', ct: 'zzzz' })
    expect(await codeOf(openManifest(vaultKey, f))).toBe('altered')
  })
  it('detects a record swapped for an older one (different IV)', async () => {
    const { vaultKey, file } = await sample()
    const f = clone(file)
    const first = f.records[0]
    if (first) first.iv = 'AAAAAAAAAAAAAAAA'
    expect(await codeOf(openManifest(vaultKey, f))).toBe('altered')
  })
  it('detects a changed header', async () => {
    const { vaultKey, file } = await sample()
    const f = clone(file)
    f.header.kdf.memKiB = 19457
    expect(await codeOf(openManifest(vaultKey, f))).toBe('altered')
  })
  it('detects a manifest from another file being pasted in', async () => {
    const a = await sample(1)
    const b = await sample(2)
    const f = clone(a.file)
    f.manifest = b.file.manifest
    expect(await codeOf(openManifest(a.vaultKey, f))).toBe('unreadable')
  })
  it('ignores key order when re-saved by another tool', async () => {
    const { vaultKey, file } = await sample()
    const reordered = JSON.parse(JSON.stringify({ records: file.records, manifest: file.manifest, header: { wrapped: file.header.wrapped, kdf: file.header.kdf, verifier: 'v', changedAt: 5, vaultId: 'vault-1', formatVersion: 1 }, version: 1, format: file.format }))
    expect(await codeOf(openManifest(vaultKey, parseVaultFile(JSON.stringify(reordered))))).toBe('no-error')
  })
})

describe('parseVaultFile', () => {
  it('refuses things that are not VaultKey files', () => {
    for (const bad of ['', 'not json', '[]', '{}', '{"format":"other","version":1}', 'null', '42']) {
      expect(() => parseVaultFile(bad)).toThrow()
    }
  })
  it('names the problem', async () => {
    const { file } = await sample()
    expect(await codeOf(() => parseVaultFile('hello'))).toBe('not-a-vault-file')
    expect(await codeOf(() => parseVaultFile(JSON.stringify({ ...file, version: 2 })))).toBe('newer-format')
    expect(await codeOf(() => parseVaultFile(JSON.stringify(file), 10))).toBe('too-large')
    expect(await codeOf(() => parseVaultFile(JSON.stringify({ ...file, records: [file.records[0], file.records[0]] })))).toBe('not-a-vault-file')
    expect(await codeOf(() => parseVaultFile(JSON.stringify({ ...file, header: { ...file.header, vaultId: '' } })))).toBe('not-a-vault-file')
    expect(await codeOf(() => parseVaultFile(JSON.stringify({ ...file, records: [{ id: 'x', v: 2, iv: 'a', ct: 'b' }] })))).toBe('not-a-vault-file')
    expect(await codeOf(() => parseVaultFile(JSON.stringify({ ...file, manifest: 'nope' })))).toBe('not-a-vault-file')
  })
  it('accepts a valid file', async () => {
    const { text } = await sample()
    expect(parseVaultFile(text).records).toHaveLength(3)
  })
})
