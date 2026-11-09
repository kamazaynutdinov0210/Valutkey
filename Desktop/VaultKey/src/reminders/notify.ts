import { toYMD, type YMD } from './schedule'

export type NotifyPermission = NotificationPermission | 'unsupported'

export const notificationPermission = (): NotifyPermission => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

/** Must be called from a tap or click, or the browser will ignore it. */
export async function requestNotificationPermission(): Promise<NotifyPermission> {
  if (typeof Notification === 'undefined') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

export const dayKey = (d: YMD): string => `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
export const todayKey = (nowMs: number = Date.now()): string => dayKey(toYMD(nowMs))

/** At most one notification per day, only if asked for, allowed, and something is due. */
export function shouldNotify(input: {
  enabled: boolean
  permission: NotifyPermission
  count: number
  lastDay: string | null
  today: string
}): boolean {
  return input.enabled && input.permission === 'granted' && input.count > 0 && input.lastDay !== input.today
}

/** Never names an entry: notifications can show on a locked screen. */
export const dueMessage = (count: number): string =>
  count === 1 ? '1 password is due for a change.' : `${count} passwords are due for a change.`

export async function showDueNotification(count: number): Promise<void> {
  const options = { body: dueMessage(count), icon: '/icon-192.png', tag: 'vaultkey-due' }
  try {
    // Android only allows notifications through the service worker.
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) {
      await registration.showNotification('VaultKey', options)
      return
    }
  } catch {
    /* fall through to the plain API */
  }
  new Notification('VaultKey', options)
}
