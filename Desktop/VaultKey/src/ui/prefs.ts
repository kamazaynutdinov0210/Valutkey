// Non-secret preferences. localStorage is fine here: nothing in it can open the vault.
export type ThemePref = 'system' | 'light' | 'dark'
export const AUTO_LOCK_CHOICES = [1, 2, 5, 10, 15] as const
const DEFAULT_AUTO_LOCK_MINUTES = 5

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private mode: preference just won't persist */
  }
}

export function getAutoLockMinutes(): number {
  const n = Number(read('vk.autoLockMinutes'))
  return (AUTO_LOCK_CHOICES as readonly number[]).includes(n) ? n : DEFAULT_AUTO_LOCK_MINUTES
}
export const setAutoLockMinutes = (minutes: number): void => write('vk.autoLockMinutes', String(minutes))

export function getTheme(): ThemePref {
  const v = read('vk.theme')
  return v === 'light' || v === 'dark' ? v : 'system'
}
export function setTheme(theme: ThemePref): void {
  write('vk.theme', theme)
  applyTheme(theme)
}
/** "system" removes the override, so the device setting (and no JavaScript) decides. */
export function applyTheme(theme: ThemePref): void {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', theme)
}

export const getNotifyEnabled = (): boolean => read('vk.notify') === '1'
export const setNotifyEnabled = (on: boolean): void => write('vk.notify', on ? '1' : '0')
export const getLastNotifiedDay = (): string | null => read('vk.lastNotifiedDay')
export const setLastNotifiedDay = (day: string): void => write('vk.lastNotifiedDay', day)

export const getBackgroundEnabled = (): boolean => read('vk.background') === '1'
export const setBackgroundEnabled = (on: boolean): void => write('vk.background', on ? '1' : '0')
