// Shared by the page and the service worker, so it must not use anything that only exists in one of them.

/** Kept on this device only (never in the sync file): the date of the next reminder, nothing else. */
export interface ReminderHint {
  nextDueAt: number | null
}

export const BACKGROUND_TAG = 'vaultkey-due-check'
export const HINT_KEY = 'reminderHint'
export const LAST_BACKGROUND_DAY_KEY = 'lastBackgroundDay'
export const BACKGROUND_MESSAGE = 'At least one password is due for a change. Open VaultKey to see which.'

export function localDayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** At most one background notification a day, only if allowed, and only once the next due date has arrived. */
export function shouldBackgroundNotify(input: { hint: ReminderHint | null; now: number; lastDay: string | null; permission: string }): boolean {
  const due = input.hint?.nextDueAt
  return input.permission === 'granted' && typeof due === 'number' && due <= input.now && input.lastDay !== localDayKey(input.now)
}
