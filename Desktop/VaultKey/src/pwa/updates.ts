import { registerSW } from 'virtual:pwa-register'
import { createStore } from './store'

export const updateStore = createStore({ updateReady: false })
let update: ((reload?: boolean) => Promise<void>) | undefined

/**
 * Registers the offline service worker. A new version never replaces the running one by itself:
 * code must not change while a vault is unlocked. We show a banner instead, and the person restarts.
 */
export function initServiceWorker(): void {
  update = registerSW({ immediate: true, onNeedRefresh: () => updateStore.set({ updateReady: true }) })
}

/** Installs the waiting version and reloads, which also locks the vault. */
export function applyUpdate(): void {
  void update?.(true)
}
