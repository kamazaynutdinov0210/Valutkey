import { createStore } from './store'

export type InstallKind = 'installed' | 'prompt' | 'ios' | 'manual'

/** Which install help fits this device. Pure, so it can be tested with sample user agents. */
export function installKind(input: { standalone: boolean; hasPrompt: boolean; userAgent: string; maxTouchPoints?: number }): InstallKind {
  if (input.standalone) return 'installed'
  if (input.hasPrompt) return 'prompt'
  const iPhoneOrIPod = /iPhone|iPod|iPad/.test(input.userAgent)
  const iPadAsMac = /Macintosh/.test(input.userAgent) && (input.maxTouchPoints ?? 0) > 1 // iPadOS pretends to be a Mac
  return iPhoneOrIPod || iPadAsMac ? 'ios' : 'manual'
}

export const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

// Chrome and Edge offer a one-tap install through this event. Safari and Firefox do not.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const installStore = createStore({ hasPrompt: false })
let deferred: BeforeInstallPromptEvent | null = null

/** Call once at startup: the browser fires the event early and only once. */
export function initInstall(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    installStore.set({ hasPrompt: true })
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installStore.set({ hasPrompt: false })
  })
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable'
  const event = deferred
  deferred = null
  installStore.set({ hasPrompt: false }) // the browser allows each prompt only once
  await event.prompt()
  return (await event.userChoice).outcome
}
