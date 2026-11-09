import { nextDueAtMs } from '../reminders/schedule'
import type { Entry } from '../vault/entry'
import { writeMeta } from '../vault/storage'
import { BACKGROUND_TAG, HINT_KEY, type ReminderHint } from './hint'

interface PeriodicSyncRegistration extends ServiceWorkerRegistration {
  periodicSync: { register(tag: string, options: { minInterval: number }): Promise<void>; unregister(tag: string): Promise<void> }
}
const TWELVE_HOURS = 12 * 60 * 60 * 1000

/** Periodic background checks exist only in some browsers (mainly installed Chrome and Edge apps). */
export const backgroundSupported = (): boolean =>
  'serviceWorker' in navigator && typeof ServiceWorkerRegistration !== 'undefined' && 'periodicSync' in ServiceWorkerRegistration.prototype

async function registration(): Promise<PeriodicSyncRegistration | undefined> {
  return (await navigator.serviceWorker?.getRegistration()) as PeriodicSyncRegistration | undefined
}

export async function enableBackground(): Promise<'enabled' | 'unsupported' | 'denied'> {
  if (!backgroundSupported()) return 'unsupported'
  try {
    const reg = await registration()
    if (!reg) return 'unsupported'
    const permission = await navigator.permissions.query({ name: 'periodic-background-sync' as PermissionName })
    if (permission.state !== 'granted') return 'denied'
    await reg.periodicSync.register(BACKGROUND_TAG, { minInterval: TWELVE_HOURS })
    return 'enabled'
  } catch {
    return 'denied'
  }
}

export async function disableBackground(): Promise<void> {
  try {
    await (await registration())?.periodicSync.unregister(BACKGROUND_TAG)
  } catch {
    /* nothing registered */
  }
  await writeMeta(HINT_KEY, { nextDueAt: null } satisfies ReminderHint).catch(() => undefined)
}

/** Saves only the date of the next reminder, so the closed app can tell that something is due. */
export function syncHint(entries: Entry[]): Promise<void> {
  return writeMeta(HINT_KEY, { nextDueAt: nextDueAtMs(entries) } satisfies ReminderHint).catch(() => undefined)
}
