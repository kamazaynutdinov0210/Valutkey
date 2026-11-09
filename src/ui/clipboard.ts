export const CLIPBOARD_CLEAR_MS = 30_000

export interface ClipboardLike {
  writeText(text: string): Promise<void>
}

export interface CleanerDeps {
  clipboard: ClipboardLike
  delayMs?: number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (id: unknown) => void
}

/**
 * Copies a secret and overwrites the clipboard after a delay. We never read the clipboard
 * (that triggers permission prompts), so if the person copies something else from another
 * app within the window it is overwritten too. Clearing only works while the app is open.
 */
export function createClipboardCleaner(deps: CleanerDeps) {
  const delayMs = deps.delayMs ?? CLIPBOARD_CLEAR_MS
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = deps.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>))
  let timer: unknown
  let pending = false

  const wipe = async () => {
    pending = false
    try {
      await deps.clipboard.writeText('')
    } catch {
      /* the browser refused (page not focused); nothing more we can do */
    }
  }

  return {
    async copy(text: string): Promise<void> {
      await deps.clipboard.writeText(text)
      if (pending) clearTimer(timer)
      pending = true
      timer = setTimer(() => void wipe(), delayMs)
    },
    /** Called when the vault locks. */
    async clearNow(): Promise<void> {
      if (!pending) return
      clearTimer(timer)
      await wipe()
    },
    isPending: (): boolean => pending,
  }
}

let shared: ReturnType<typeof createClipboardCleaner> | undefined
export function secretClipboard() {
  shared ??= createClipboardCleaner({ clipboard: navigator.clipboard })
  return shared
}
