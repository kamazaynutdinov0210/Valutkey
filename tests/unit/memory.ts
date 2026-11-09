import type { EncryptedRecord } from '../../src/crypto/types'
import type { SyncStateData, SyncStateStore, SyncTarget } from '../../src/sync/service'
import type { RecordStorage } from '../../src/vault/storage'

export function memoryRecords(): RecordStorage & { map: Map<string, EncryptedRecord> } {
  const map = new Map<string, EncryptedRecord>()
  return {
    map,
    all: async () => structuredClone([...map.values()]),
    put: async (r) => void map.set(r.id, structuredClone(r)),
    putMany: async (list) => void list.forEach((r) => map.set(r.id, structuredClone(r))),
    clear: async () => void map.clear(),
  }
}

export function memoryState(): SyncStateStore & { data: SyncStateData | null } {
  const s = {
    data: null as SyncStateData | null,
    load: async () => (s.data ? { ...s.data } : null),
    save: async (d: SyncStateData) => void (s.data = { ...d }),
  }
  return s
}

export function memoryTarget(initial: string | null = null): SyncTarget & { text: string | null; writes: number } {
  const t = {
    text: initial,
    writes: 0,
    read: async () => t.text,
    write: async (x: string) => {
      t.text = x
      t.writes++
    },
  }
  return t
}
