import type { EncryptedRecord, VaultHeader } from '../crypto/types'

/** Where the (non-secret) vault header lives. Swappable so tests can use memory. */
export interface HeaderStorage {
  load(): Promise<VaultHeader | null>
  save(header: VaultHeader): Promise<void>
}

/** Where encrypted entries live. Only ciphertext ever reaches this layer. */
export interface RecordStorage {
  all(): Promise<EncryptedRecord[]>
  put(record: EncryptedRecord): Promise<void>
  putMany(records: EncryptedRecord[]): Promise<void>
  clear(): Promise<void>
}

/** Replaces the header and every record in one transaction: all of it happens, or none of it. */
export interface VaultReplacer {
  replaceAll(header: VaultHeader, records: EncryptedRecord[]): Promise<void>
}

const DB_NAME = 'vaultkey'
const DB_VERSION = 2 // v1 had only "meta"; v2 adds "records"
const META = 'meta'
const RECORDS = 'records'
const HEADER_KEY = 'header'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META)
      if (!db.objectStoreNames.contains(RECORDS)) db.createObjectStore(RECORDS, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('storage-unavailable'))
  })
}

function run<T>(store: string, mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode)
        const request = action(tx.objectStore(store))
        tx.oncomplete = () => {
          db.close()
          resolve(request.result)
        }
        tx.onerror = tx.onabort = () => {
          db.close()
          reject(new Error('storage-unavailable'))
        }
      }),
  )
}

/** IndexedDB holds only the header here: salts, wrapped keys, a verifier. Nothing that opens the vault by itself. */
export const idbHeaderStorage: HeaderStorage = {
  load: async () => (await run<VaultHeader | undefined>(META, 'readonly', (s) => s.get(HEADER_KEY))) ?? null,
  save: async (header) => {
    await run(META, 'readwrite', (s) => s.put(header, HEADER_KEY))
  },
}

export const idbRecordStorage: RecordStorage = {
  all: () => run<EncryptedRecord[]>(RECORDS, 'readonly', (s) => s.getAll()),
  put: async (record) => {
    await run(RECORDS, 'readwrite', (s) => s.put(record))
  },
  // one transaction, so a bulk write either fully happens or not at all
  putMany: async (records) => {
    if (records.length === 0) return
    await run(RECORDS, 'readwrite', (s) => {
      let last: IDBRequest<IDBValidKey> | undefined
      for (const record of records) last = s.put(record)
      return last as IDBRequest<IDBValidKey> // the list is not empty, so there is a last request
    })
  },
  clear: async () => {
    await run(RECORDS, 'readwrite', (s) => s.clear())
  },
}

/** Small non-secret values kept on this device (for example the next-reminder hint). */
export const readMeta = <T>(key: string): Promise<T | undefined> => run<T | undefined>(META, 'readonly', (s) => s.get(key))
export const writeMeta = async (key: string, value: unknown): Promise<void> => {
  await run(META, 'readwrite', (s) => s.put(value, key))
}

export const idbVaultReplacer: VaultReplacer = {
  replaceAll: async (header, records) => {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([META, RECORDS], 'readwrite')
      const store = tx.objectStore(RECORDS)
      store.clear()
      for (const record of records) store.put(record)
      tx.objectStore(META).put(header, HEADER_KEY)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = tx.onabort = () => {
        db.close()
        reject(new Error('storage-unavailable'))
      }
    })
  },
}
