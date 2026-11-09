import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { BACKGROUND_MESSAGE, BACKGROUND_TAG, HINT_KEY, LAST_BACKGROUND_DAY_KEY, localDayKey, shouldBackgroundNotify, type ReminderHint } from './pwa/hint'
import { readMeta, writeMeta } from './vault/storage'

type ManifestEntry = string | { url: string; revision: string | null }
declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: ManifestEntry[] }

// Offline support: every built file is cached at install time. The service
// worker only ever caches our own static files, never user data or API responses.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting()
})

// Tapping a reminder opens (or focuses) the app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows[0]
      return open ? open.focus() : self.clients.openWindow('/')
    }),
  )
})

// Take control of open pages as soon as the worker is active, so offline works without a second reload.
self.addEventListener('activate', () => void self.clients.claim())

// Optional closed-app reminder (the person opts in; only some browsers run this at all).
// It sees one thing: the date the next reminder starts. It cannot read titles or anything else.
interface PeriodicSyncEvent extends ExtendableEvent {
  tag: string
}
async function checkDue(): Promise<void> {
  const now = Date.now()
  const hint = (await readMeta<ReminderHint>(HINT_KEY)) ?? null
  const lastDay = (await readMeta<string>(LAST_BACKGROUND_DAY_KEY)) ?? null
  if (!shouldBackgroundNotify({ hint, now, lastDay, permission: Notification.permission })) return
  await writeMeta(LAST_BACKGROUND_DAY_KEY, localDayKey(now))
  await self.registration.showNotification('VaultKey', { body: BACKGROUND_MESSAGE, icon: '/icon-192.png', tag: 'vaultkey-due' })
}
self.addEventListener('periodicsync', (event) => {
  const sync = event as unknown as PeriodicSyncEvent
  if (sync.tag === BACKGROUND_TAG) sync.waitUntil(checkDue().catch(() => undefined))
})
