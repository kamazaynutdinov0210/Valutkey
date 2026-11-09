import { openRecord, sealRecord } from '../crypto/records'
import { LIMITS, normalizeInput, parseEntry, EntryError, type Entry, type EntryInput, type HistoryItem } from './entry'
import type { RecordStorage } from './storage'

export interface VaultServiceDeps {
  vaultKey: CryptoKey
  vaultId: string
  storage: RecordStorage
  now?: () => number
  newId?: () => string
}

const pushHistory = (old: Entry, time: number, reason: HistoryItem['reason']): HistoryItem[] =>
  [{ password: old.password, replacedAt: time, reason }, ...old.history].slice(0, LIMITS.history)

/** Create, read, update and delete encrypted entries. Plain text exists only in this object's memory. */
export function createVaultService(deps: VaultServiceDeps) {
  const now = deps.now ?? Date.now
  const newId = deps.newId ?? (() => crypto.randomUUID())
  const cache = new Map<string, Entry>()

  const persist = async (entry: Entry) => {
    await deps.storage.put(await sealRecord(deps.vaultKey, deps.vaultId, entry.id, entry))
    cache.set(entry.id, entry)
  }
  const live = (id: string): Entry => {
    const entry = cache.get(id)
    if (!entry || entry.deletedAt !== undefined) throw new EntryError('That password no longer exists.')
    return entry
  }

  return {
    /** Decrypts everything once. A damaged item is counted and skipped, never fatal. */
    async load(): Promise<{ damaged: number }> {
      cache.clear()
      let damaged = 0
      for (const record of await deps.storage.all()) {
        try {
          const entry = parseEntry(await openRecord<unknown>(deps.vaultKey, deps.vaultId, record))
          if (entry.id !== record.id) throw new EntryError('mismatch')
          cache.set(entry.id, entry)
        } catch {
          damaged++
        }
      }
      return { damaged }
    },

    list: (): Entry[] => [...cache.values()].filter((e) => e.deletedAt === undefined),
    get: (id: string): Entry | undefined => cache.get(id),

    async create(input: EntryInput): Promise<Entry> {
      const { rotation, ...clean } = normalizeInput(input)
      const time = now()
      const entry: Entry = { ...clean, id: newId(), createdAt: time, updatedAt: time, history: [] }
      if (rotation) entry.rotation = { ...rotation, lastRotatedAt: time }
      await persist(entry)
      return entry
    },

    async update(id: string, input: EntryInput): Promise<Entry> {
      const old = live(id)
      const { rotation, ...clean } = normalizeInput(input)
      const time = now()
      const passwordChanged = clean.password !== old.password
      const entry: Entry = {
        ...old,
        ...clean,
        updatedAt: time,
        history: passwordChanged ? pushHistory(old, time, 'edit') : old.history,
      }
      if (rotation) {
        // a new password restarts the clock; changing only the interval does not
        entry.rotation = { ...rotation, lastRotatedAt: passwordChanged || !old.rotation ? time : old.rotation.lastRotatedAt }
      } else {
        delete entry.rotation
      }
      await persist(entry)
      return entry
    },

    /** Replaces the password with a new one the person has confirmed. The old one goes to history. */
    async rotate(id: string, newPassword: string): Promise<Entry> {
      const old = live(id)
      if (!newPassword || newPassword.length > LIMITS.password) throw new EntryError('Enter the new password.')
      if (newPassword === old.password) throw new EntryError('That is the same password as before.')
      const time = now()
      const entry: Entry = { ...old, password: newPassword, updatedAt: time, history: pushHistory(old, time, 'rotation') }
      if (old.rotation) entry.rotation = { ...old.rotation, lastRotatedAt: time }
      await persist(entry)
      return entry
    },

    /** Replaces the entry with an empty tombstone, so no secret remains in storage. */
    async remove(id: string): Promise<void> {
      const old = live(id)
      const time = now()
      await persist({
        id: old.id,
        title: '',
        username: '',
        url: '',
        password: '',
        notes: '',
        tags: [],
        createdAt: old.createdAt,
        updatedAt: time,
        generator: old.generator,
        history: [],
        deletedAt: time,
      })
    },
  }
}

export type VaultService = ReturnType<typeof createVaultService>
