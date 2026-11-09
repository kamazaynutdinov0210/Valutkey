import { readMeta, writeMeta } from '../vault/storage'
import type { SyncStateData, SyncStateStore, SyncTarget } from './service'

export const idbSyncState: SyncStateStore = {
  load: async () => (await readMeta<SyncStateData>('syncState')) ?? null,
  save: (state) => writeMeta('syncState', state),
}

// File System Access API (Chrome, Edge and other Chromium browsers on a computer). Not in TypeScript's DOM types yet.
interface WritableLike {
  write(data: string): Promise<void>
  close(): Promise<void>
}
interface FileHandle {
  name: string
  getFile(): Promise<File>
  createWritable(): Promise<WritableLike>
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>
}
interface Picker {
  showSaveFilePicker(options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }): Promise<FileHandle>
}
const HANDLE_KEY = 'syncHandle'

export const folderSyncSupported = (): boolean => typeof window !== 'undefined' && 'showSaveFilePicker' in window

/** Lets the person pick (or create) the sync file, for example inside their Dropbox or OneDrive folder. */
export async function chooseSyncFile(): Promise<string | null> {
  try {
    const handle = await (window as unknown as Picker).showSaveFilePicker({
      suggestedName: 'vaultkey.vaultkey',
      types: [{ description: 'VaultKey file', accept: { 'application/json': ['.vaultkey'] } }],
    })
    await writeMeta(HANDLE_KEY, handle)
    return handle.name
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null // they closed the dialog
    throw e
  }
}

export async function syncFileName(): Promise<string | null> {
  const handle = await readMeta<FileHandle | null>(HANDLE_KEY).catch(() => null)
  return handle?.name ?? null
}

export const forgetSyncFile = (): Promise<void> => writeMeta(HANDLE_KEY, null)

/**
 * The chosen file as a sync target. Without `askPermission` it only succeeds if the browser has already
 * allowed access, so it can run quietly at startup. Reading never swallows errors: a failed read must not
 * look like an empty file, or we could overwrite something.
 */
export async function openSyncTarget(askPermission: boolean): Promise<SyncTarget | null> {
  const handle = await readMeta<FileHandle | null>(HANDLE_KEY).catch(() => null)
  if (!handle) return null
  let permission = await handle.queryPermission({ mode: 'readwrite' })
  if (permission !== 'granted' && askPermission) permission = await handle.requestPermission({ mode: 'readwrite' })
  if (permission !== 'granted') return null
  return {
    read: async () => (await handle.getFile()).text(),
    write: async (text) => {
      const writable = await handle.createWritable() // writes to a temporary copy and swaps it in on close
      await writable.write(text)
      await writable.close()
    },
  }
}
