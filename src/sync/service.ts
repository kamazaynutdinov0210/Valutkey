import { openRecord, sealRecord } from '../crypto/records'
import type { EncryptedRecord, VaultHeader } from '../crypto/types'
import { assertHeader } from '../crypto/wrap'
import { parseEntry } from '../vault/entry'
import type { RecordStorage } from '../vault/storage'
import { buildVaultFile, openManifest, parseVaultFile, SyncError } from './file'
import { emptyStats, mergeEntries, type MergeStats, type Versioned } from './merge'

/** Kept on this device only. */
export interface SyncStateData {
  deviceId: string
  revision: number // the highest file revision this device has seen or written
  lastSyncedAt: number | null // when this device last wrote the sync file
}
export interface SyncStateStore {
  load(): Promise<SyncStateData | null>
  save(state: SyncStateData): Promise<void>
}

/** A place a vault file can be read from and written to (a file in a cloud folder, for example). */
export interface SyncTarget {
  read(): Promise<string | null>
  write(text: string): Promise<void>
}

export interface SyncDeps {
  vaultKey: CryptoKey
  getHeader: () => VaultHeader
  adoptHeader: (header: VaultHeader) => Promise<void>
  records: RecordStorage
  state: SyncStateStore
  now?: () => number
  newId?: () => string
}

export type MergeOutcome =
  | { status: 'older'; fileRevision: number; knownRevision: number }
  | { status: 'merged'; stats: MergeStats; damaged: number; headerAdopted: boolean; changedHere: boolean }

export function createSyncService(deps: SyncDeps) {
  const now = deps.now ?? Date.now
  const newId = deps.newId ?? (() => crypto.randomUUID())

  async function ensureState(): Promise<SyncStateData> {
    const existing = await deps.state.load()
    if (existing) return existing
    const fresh: SyncStateData = { deviceId: newId(), revision: 0, lastSyncedAt: null }
    await deps.state.save(fresh)
    return fresh
  }

  /** Decrypts what it can. Anything unreadable is counted and kept aside, never silently dropped. */
  async function decryptAll(records: EncryptedRecord[]) {
    const items: Versioned[] = []
    const unreadable: EncryptedRecord[] = []
    for (const record of records) {
      try {
        const entry = parseEntry(await openRecord<unknown>(deps.vaultKey, deps.getHeader().vaultId, record))
        if (entry.id !== record.id) throw new Error('mismatch')
        items.push({ entry, record })
      } catch {
        unreadable.push(record)
      }
    }
    return { items, unreadable }
  }

  async function writeFile(target: SyncTarget): Promise<void> {
    const state = await ensureState()
    const revision = state.revision + 1
    const time = now()
    const file = await buildVaultFile({
      vaultKey: deps.vaultKey,
      header: deps.getHeader(),
      records: await deps.records.all(),
      revision,
      deviceId: state.deviceId,
      now: time,
    })
    await target.write(JSON.stringify(file))
    await deps.state.save({ ...state, revision, lastSyncedAt: time }) // only after the write succeeded
  }

  async function mergeText(text: string, options: { acceptOlder?: boolean } = {}): Promise<MergeOutcome> {
    const file = parseVaultFile(text)
    const header = deps.getHeader()
    if (file.header.vaultId !== header.vaultId) throw new SyncError('different-vault')
    const manifest = await openManifest(deps.vaultKey, file)
    const state = await ensureState()
    if (manifest.revision < state.revision && !options.acceptOlder) {
      return { status: 'older', fileRevision: manifest.revision, knownRevision: state.revision }
    }

    const remote = await decryptAll(file.records)
    const local = await decryptAll(await deps.records.all())
    const { items, stats } = mergeEntries(local.items, remote.items, state.lastSyncedAt)

    const toWrite: EncryptedRecord[] = []
    for (const item of items) {
      if (item.origin === 'remote' && item.record) toWrite.push(item.record)
      if (item.origin === 'merged') toWrite.push(await sealRecord(deps.vaultKey, header.vaultId, item.entry.id, item.entry))
    }
    // Keep records we cannot read (for example from a newer app version) so writing the file back does not destroy them.
    const known = new Set([...local.items.map((v) => v.entry.id), ...local.unreadable.map((r) => r.id)])
    const keptAside = remote.unreadable.filter((r) => !known.has(r.id))
    toWrite.push(...keptAside)
    if (toWrite.length) await deps.records.putMany(toWrite)

    let headerAdopted = false
    if (manifest.headerChangedAt > (header.changedAt ?? 0)) {
      assertHeader(file.header)
      await deps.adoptHeader(file.header) // the master password was changed on another device
      headerAdopted = true
    }
    await deps.state.save({ ...state, revision: Math.max(state.revision, manifest.revision) })
    return { status: 'merged', stats, damaged: remote.unreadable.length, headerAdopted, changedHere: toWrite.length > 0 || headerAdopted }
  }

  return {
    /** A snapshot of this device's vault as a file text (a backup). */
    async exportFile(): Promise<string> {
      const state = await ensureState()
      const file = await buildVaultFile({
        vaultKey: deps.vaultKey,
        header: deps.getHeader(),
        records: await deps.records.all(),
        revision: state.revision,
        deviceId: state.deviceId,
        now: now(),
      })
      return JSON.stringify(file)
    },

    mergeText,

    /**
     * Reads the target, merges what it holds, then writes the combined result back.
     * A file that is not a VaultKey file, or belongs to another vault, is refused and left untouched.
     */
    async syncWith(target: SyncTarget, options: { acceptOlder?: boolean } = {}): Promise<MergeOutcome> {
      const text = await target.read()
      let outcome: MergeOutcome = { status: 'merged', stats: emptyStats(), damaged: 0, headerAdopted: false, changedHere: false }
      if (text !== null && text.trim() !== '') {
        const merged = await mergeText(text, options)
        if (merged.status === 'older') return merged // nothing is written until the person confirms
        outcome = merged
      }
      await writeFile(target)
      return outcome
    },
  }
}

export type SyncService = ReturnType<typeof createSyncService>
