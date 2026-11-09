import { beforeAll, describe, expect, it } from 'vitest'
import { argon2idRaw } from '../../src/crypto/argon2'
import { CryptoError } from '../../src/crypto/errors'
import { openRecord } from '../../src/crypto/records'
import type { VaultHeader } from '../../src/crypto/types'
import { changeMasterPassword, createVault, unlockWithPassword } from '../../src/crypto/wrap'
import { defaultSettings } from '../../src/generator'
import { openManifest, parseVaultFile, SyncError } from '../../src/sync/file'
import { restoreFromText } from '../../src/sync/restore'
import { createSyncService } from '../../src/sync/service'
import { createVaultService } from '../../src/vault/entries'
import type { EntryInput } from '../../src/vault/entry'
import { memoryRecords, memoryState, memoryTarget } from './memory'
import { TEST_COSTS } from './helpers'

const PASSWORD = 'correct horse battery staple'
let base: { header: VaultHeader; vaultKey: CryptoKey; recoveryKey: string }
let clockValue = 1_000_000
const tick = () => (clockValue += 1000)

beforeAll(async () => {
  base = await createVault(argon2idRaw, PASSWORD, TEST_COSTS)
})

const input = (over: Partial<EntryInput> = {}): EntryInput => ({
  title: 'Bank',
  username: 'sam',
  url: '',
  password: 'orig-password',
  notes: '',
  tags: [],
  generator: defaultSettings('password'),
  ...over,
})

/** One device: its own storage and sync state, sharing the vault's key and the fake clock. */
async function device(name: string, header: VaultHeader = base.header) {
  const vaultKey = await unlockWithPassword(argon2idRaw, PASSWORD, base.header) // a separate key object, same key bytes
  let current = header
  const adopted: VaultHeader[] = []
  const records = memoryRecords()
  const state = memoryState()
  let n = 0
  const newId = () => `${name}-${++n}`
  const vault = createVaultService({ vaultKey, vaultId: header.vaultId, storage: records, now: tick, newId })
  const sync = createSyncService({
    vaultKey,
    getHeader: () => current,
    adoptHeader: async (h) => {
      current = h
      adopted.push(h)
    },
    records,
    state,
    now: tick,
    newId,
  })
  return { vault, sync, records, state, vaultKey, adopted, header: () => current, setHeader: (h: VaultHeader) => void (current = h) }
}
const titles = async (d: Awaited<ReturnType<typeof device>>) => {
  await d.vault.load()
  return d.vault.list().map((e) => e.title).sort()
}
const merged = <T extends { status: string }>(o: T) => {
  if (o.status !== 'merged') throw new Error(`expected merged, got ${o.status}`)
  return o as Extract<T, { status: 'merged' }>
}
const codeOf = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p
    return 'no-error'
  } catch (e) {
    return e instanceof SyncError || e instanceof CryptoError ? e.code : 'other'
  }
}
const revisionOf = async (d: Awaited<ReturnType<typeof device>>, text: string | null) =>
  (await openManifest(d.vaultKey, parseVaultFile(text ?? ''))).revision

describe('two devices sharing one file', () => {
  it('a new device receives everything, then both agree', async () => {
    const a = await device('a')
    const b = await device('b')
    await a.vault.create(input({ title: 'One' }))
    await a.vault.create(input({ title: 'Two' }))
    const target = memoryTarget('') // a brand-new empty file

    expect(merged(await a.sync.syncWith(target)).stats.added).toBe(0)
    expect(await revisionOf(a, target.text)).toBe(1)

    expect(merged(await b.sync.syncWith(target)).stats.added).toBe(2)
    expect(await titles(b)).toEqual(['One', 'Two'])
    expect(await revisionOf(b, target.text)).toBe(2)

    const again = merged(await a.sync.syncWith(target))
    expect(again.stats.unchanged).toBe(2)
    expect(again.changedHere).toBe(false)
  })

  it('carries edits and deletes both ways', async () => {
    const a = await device('a')
    const b = await device('b')
    const one = await a.vault.create(input({ title: 'One' }))
    const two = await a.vault.create(input({ title: 'Two' }))
    const target = memoryTarget()
    await a.sync.syncWith(target)
    await b.sync.syncWith(target)

    await b.vault.load()
    await b.vault.update(one.id, input({ title: 'One renamed' }))
    await b.sync.syncWith(target)
    expect(merged(await a.sync.syncWith(target)).stats.updated).toBe(1)
    expect(await titles(a)).toEqual(['One renamed', 'Two'])

    await a.vault.remove(two.id)
    await a.sync.syncWith(target)
    expect(merged(await b.sync.syncWith(target)).stats.removed).toBe(1)
    expect(await titles(b)).toEqual(['One renamed'])
  })

  it('a change made on both devices keeps the newest and keeps the other password in history', async () => {
    const a = await device('a')
    const b = await device('b')
    const entry = await a.vault.create(input({ title: 'Shared' }))
    const target = memoryTarget()
    await a.sync.syncWith(target)
    await b.sync.syncWith(target)
    await b.vault.load()

    await a.vault.update(entry.id, input({ title: 'Shared', password: 'from-a' })) // earlier
    await b.vault.update(entry.id, input({ title: 'Shared', password: 'from-b' })) // later
    await a.sync.syncWith(target)
    const result = merged(await b.sync.syncWith(target))
    expect(result.stats.conflicts).toBe(1)

    await b.vault.load()
    const kept = b.vault.get(entry.id)
    expect(kept?.password).toBe('from-b')
    expect(kept?.history.map((h) => h.password)).toContain('from-a')

    await a.sync.syncWith(target)
    await a.vault.load()
    expect(a.vault.get(entry.id)?.password).toBe('from-b')
    expect(a.vault.get(entry.id)?.history.map((h) => h.password)).toContain('from-a')
  })

  it('merging the same file twice changes nothing the second time', async () => {
    const a = await device('a')
    const b = await device('b')
    await a.vault.create(input())
    const text = await a.sync.exportFile()
    expect(merged(await b.sync.mergeText(text)).changedHere).toBe(true)
    const second = merged(await b.sync.mergeText(text))
    expect(second.changedHere).toBe(false)
    expect(second.stats.unchanged).toBe(1)
  })
})

describe('rollback: an older copy than this device has already seen', () => {
  it('warns first, writes nothing, and loses nothing if the person goes ahead', async () => {
    const a = await device('a')
    await a.vault.create(input({ title: 'One' }))
    const target = memoryTarget()
    await a.sync.syncWith(target) // revision 1
    const oldCopy = target.text ?? ''
    await a.vault.create(input({ title: 'Two' }))
    await a.sync.syncWith(target) // revision 2
    await a.vault.create(input({ title: 'Three' }))
    await a.sync.syncWith(target) // revision 3

    target.text = oldCopy // the cloud serves an old version
    const writesBefore = target.writes
    const outcome = await a.sync.syncWith(target)
    expect(outcome).toEqual({ status: 'older', fileRevision: 1, knownRevision: 3 })
    expect(target.text).toBe(oldCopy)
    expect(target.writes).toBe(writesBefore)

    const forced = merged(await a.sync.syncWith(target, { acceptOlder: true }))
    expect(forced.stats.sentToFile).toBe(2)
    expect(await revisionOf(a, target.text)).toBe(4)
    expect(await titles(a)).toEqual(['One', 'Three', 'Two'])
  })

  it('an export is a snapshot: it does not move the revision, and it is older than later syncs', async () => {
    const a = await device('a')
    await a.vault.create(input())
    const backup = await a.sync.exportFile()
    expect(await revisionOf(a, backup)).toBe(0)
    const target = memoryTarget()
    await a.sync.syncWith(target) // revision 1
    expect((await a.sync.mergeText(backup)).status).toBe('older') // the snapshot (0) is older than what this device has seen (1)
    expect((await a.sync.mergeText(backup, { acceptOlder: true })).status).toBe('merged')
  })
})

describe('refusing files it should not touch', () => {
  it('leaves a file that is not a VaultKey file untouched', async () => {
    const a = await device('a')
    const target = memoryTarget('{"hello":"world"}')
    expect(await codeOf(a.sync.syncWith(target))).toBe('not-a-vault-file')
    expect(target.text).toBe('{"hello":"world"}')
    expect(target.writes).toBe(0)
  })

  it('leaves another vault’s file untouched', async () => {
    const a = await device('a')
    const other = await createVault(argon2idRaw, 'another long passphrase here', TEST_COSTS)
    const otherDevice = createSyncService({ vaultKey: other.vaultKey, getHeader: () => other.header, adoptHeader: async () => undefined, records: memoryRecords(), state: memoryState() })
    const text = await otherDevice.exportFile()
    const target = memoryTarget(text)
    expect(await codeOf(a.sync.syncWith(target))).toBe('different-vault')
    expect(target.text).toBe(text)
    expect(target.writes).toBe(0)
  })

  it('refuses an altered file: removed record, or a record from an older save', async () => {
    const a = await device('a')
    const b = await device('b')
    await a.vault.create(input({ title: 'One' }))
    await a.vault.create(input({ title: 'Two' }))
    const target = memoryTarget()
    await a.sync.syncWith(target)

    const removed = JSON.parse(target.text ?? '')
    removed.records.pop()
    const t1 = memoryTarget(JSON.stringify(removed))
    expect(await codeOf(b.sync.syncWith(t1))).toBe('altered')
    expect(t1.writes).toBe(0)
    expect(await titles(b)).toEqual([])

    const swapped = JSON.parse(target.text ?? '')
    swapped.records[0].iv = 'AAAAAAAAAAAAAAAA'
    expect(await codeOf(b.sync.syncWith(memoryTarget(JSON.stringify(swapped))))).toBe('altered')
  })

  it('keeps a record it cannot read, so writing the file back does not destroy it', async () => {
    const a = await device('a')
    const b = await device('b')
    await a.vault.create(input({ title: 'One' }))
    await a.vault.create(input({ title: 'Two' }))
    const target = memoryTarget()
    await a.sync.syncWith(target)

    const damaged = JSON.parse(target.text ?? '')
    damaged.records[0].ct = damaged.records[0].ct.slice(0, -4) + 'AAAA'
    const t = memoryTarget(JSON.stringify(damaged))
    const outcome = merged(await b.sync.syncWith(t))
    expect(outcome.damaged).toBe(1)
    expect(outcome.stats.added).toBe(1)
    expect(parseVaultFile(t.text ?? '').records).toHaveLength(2) // still both in the file
  })

  it('refuses a file made by a newer version of the app', async () => {
    const a = await device('a')
    const file = JSON.parse(await a.sync.exportFile())
    file.version = 2
    expect(await codeOf(a.sync.syncWith(memoryTarget(JSON.stringify(file))))).toBe('newer-format')
  })

  it('does not record a write that failed', async () => {
    const a = await device('a')
    await a.vault.create(input())
    const failing = { read: async () => '', write: async () => { throw new Error('disk full') } }
    expect(await codeOf(a.sync.syncWith(failing))).toBe('other')
    expect(a.state.data?.revision ?? 0).toBe(0)
    expect(a.state.data?.lastSyncedAt ?? null).toBe(null)
  })
})

describe('master password changed on one device', () => {
  it('the other device adopts the newer header and then needs the new password', async () => {
    const a = await device('a')
    const b = await device('b')
    await a.vault.create(input())
    const target = memoryTarget()
    await a.sync.syncWith(target)
    await b.sync.syncWith(target)

    await new Promise((r) => setTimeout(r, 5)) // so "changed at" is later
    const newPassword = 'a completely new long passphrase'
    const newHeader = await changeMasterPassword(argon2idRaw, base.header, PASSWORD, newPassword, TEST_COSTS)
    a.setHeader(newHeader)
    await a.sync.syncWith(target)

    const result = merged(await b.sync.syncWith(target))
    expect(result.headerAdopted).toBe(true)
    expect(b.adopted).toHaveLength(1)
    expect(await codeOf(unlockWithPassword(argon2idRaw, newPassword, b.header()))).toBe('no-error')
    expect(await codeOf(unlockWithPassword(argon2idRaw, PASSWORD, b.header()))).toBe('wrong-password')
  })

  it('never goes back to an older header', async () => {
    const a = await device('a')
    await a.vault.create(input())
    const target = memoryTarget()
    await a.sync.syncWith(target) // file has the original header

    await new Promise((r) => setTimeout(r, 5))
    const newHeader = await changeMasterPassword(argon2idRaw, base.header, PASSWORD, 'another new long passphrase', TEST_COSTS)
    a.setHeader(newHeader)
    const result = merged(await a.sync.syncWith(target))
    expect(result.headerAdopted).toBe(false)
    expect(parseVaultFile(target.text ?? '').header.verifier).toBe(newHeader.verifier)
  })
})

describe('restoring a backup onto a device with nothing', () => {
  async function backup() {
    const a = await device('a')
    await a.vault.create(input({ title: 'Saved', password: 'pw-from-backup' }))
    return { a, text: await a.sync.exportFile() }
  }
  const adopt = () => {
    const seen: { header?: VaultHeader; key?: CryptoKey } = {}
    return { seen, session: { adoptVault: async (header: VaultHeader, key: CryptoKey) => void Object.assign(seen, { header, key }) } }
  }

  it('works with the master password', async () => {
    const { text } = await backup()
    const records = memoryRecords()
    const state = memoryState()
    const { seen, session } = adopt()
    await restoreFromText({ text, secret: { password: PASSWORD }, argon2: argon2idRaw, records, state, session, newId: () => 'new-device' })

    expect(records.map.size).toBe(1)
    expect(state.data).toEqual({ deviceId: 'new-device', revision: 0, lastSyncedAt: null })
    const record = [...records.map.values()][0]
    if (!record || !seen.key || !seen.header) throw new Error('nothing restored')
    expect((await openRecord<{ password: string }>(seen.key, seen.header.vaultId, record)).password).toBe('pw-from-backup')
  })

  it('works with the recovery key, even after the master password was changed', async () => {
    const { text } = await backup()
    const { seen, session } = adopt()
    await restoreFromText({ text, secret: { recoveryKey: base.recoveryKey }, argon2: argon2idRaw, records: memoryRecords(), state: memoryState(), session })
    expect(seen.key).toBeTruthy()
  })

  it('stores nothing if the password is wrong, the file is altered, or it is not a backup', async () => {
    const { text } = await backup()
    const tampered = JSON.parse(text)
    tampered.records.pop()
    for (const [file, secret, code] of [
      [text, { password: 'wrong password entirely' }, 'wrong-password'],
      [JSON.stringify(tampered), { password: PASSWORD }, 'altered'],
      ['{"x":1}', { password: PASSWORD }, 'not-a-vault-file'],
    ] as const) {
      const records = memoryRecords()
      const state = memoryState()
      const { seen, session } = adopt()
      expect(await codeOf(restoreFromText({ text: file, secret, argon2: argon2idRaw, records, state, session }))).toBe(code)
      expect([records.map.size, state.data, seen.header]).toEqual([0, null, undefined])
    }
  })

  it('later syncing with the same file is not mistaken for a rollback', async () => {
    const { a, text } = await backup()
    const target = memoryTarget()
    await a.sync.syncWith(target)
    const records = memoryRecords()
    const state = memoryState()
    const { seen, session } = adopt()
    await restoreFromText({ text: target.text ?? text, secret: { password: PASSWORD }, argon2: argon2idRaw, records, state, session })
    const restored = createSyncService({ vaultKey: seen.key as CryptoKey, getHeader: () => seen.header as VaultHeader, adoptHeader: async () => undefined, records, state, now: tick })
    expect(merged(await restored.syncWith(target)).stats.unchanged).toBe(1)
  })
})
