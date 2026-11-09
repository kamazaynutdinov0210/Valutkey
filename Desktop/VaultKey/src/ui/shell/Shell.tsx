import { useEffect, useRef, useState } from 'react'
import { syncHint } from '../../pwa/background'
import { openSyncTarget } from '../../sync/target'
import { createIdleLock } from '../../vault/idleLock'
import { notificationPermission, shouldNotify, showDueNotification, todayKey } from '../../reminders/notify'
import { dueEntries } from '../../reminders/schedule'
import { lockVault } from '../lock'
import { getAutoLockMinutes, getBackgroundEnabled, getLastNotifiedDay, getNotifyEnabled, setLastNotifiedDay } from '../prefs'
import { Generator } from '../screens/Generator'
import { Reminders } from '../screens/Reminders'
import { Settings } from '../screens/Settings'
import { Vault } from '../screens/Vault'
import { useSync } from '../useSync'
import { useVault } from '../useVault'

type Tab = 'vault' | 'generator' | 'reminders' | 'settings'
const TABS: { id: Tab; label: string }[] = [
  { id: 'vault', label: 'Vault' },
  { id: 'generator', label: 'Generator' },
  { id: 'reminders', label: 'Reminders' },
  { id: 'settings', label: 'Settings' },
]

export function Shell() {
  const [tab, setTab] = useState<Tab>('vault')
  const [minutes, setMinutes] = useState(getAutoLockMinutes)
  const vault = useVault() // lives here so entries stay loaded while switching tabs
  const [background, setBackground] = useState(getBackgroundEnabled)
  const sync = useSync()
  const reload = useRef(vault.reload)
  reload.current = vault.reload

  // If a sync file is set up and the browser still allows access, sync quietly after unlocking.
  // It never prompts, and it stops (without writing) if anything looks wrong; Settings explains why.
  useEffect(() => {
    if (!vault.ready || !sync) return
    let cancelled = false
    void (async () => {
      const target = await openSyncTarget(false).catch(() => null)
      if (!target || cancelled) return
      const outcome = await sync.syncWith(target).catch(() => null)
      if (outcome?.status === 'merged' && outcome.changedHere && !cancelled) await reload.current()
    })()
    return () => {
      cancelled = true
    }
  }, [vault.ready, sync])
  const { overdue, soon } = dueEntries(vault.entries, Date.now())
  const dueCount = overdue.length + soon.length

  // If closed-app reminders are on, keep the device-local "next reminder date" up to date. It holds a date and nothing else.
  useEffect(() => {
    if (vault.ready && background) void syncHint(vault.entries)
  }, [vault.ready, vault.entries, background])

  // Optional notification, at most once a day, and it never names a password.
  useEffect(() => {
    if (!vault.ready) return
    const today = todayKey()
    const lastDay = getLastNotifiedDay()
    if (shouldNotify({ enabled: getNotifyEnabled(), permission: notificationPermission(), count: dueCount, lastDay, today })) {
      setLastNotifiedDay(today)
      void showDueNotification(dueCount)
    }
  }, [vault.ready, dueCount])

  // Auto-lock: after inactivity, when coming back to a long-hidden app, and when the page is closed.
  useEffect(() => {
    const idle = createIdleLock({ timeoutMs: minutes * 60_000, onLock: lockVault })
    const poke = () => idle.poke()
    const onVisible = () => {
      if (document.visibilityState === 'visible') idle.check()
    }
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const
    for (const name of events) window.addEventListener(name, poke, { passive: true })
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pagehide', lockVault)
    return () => {
      idle.stop()
      for (const name of events) window.removeEventListener(name, poke)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pagehide', lockVault)
    }
  }, [minutes])

  return (
    <div className="min-h-dvh md:flex">
      {/* One nav element: a bottom tab bar on phones, a sidebar from tablet width up. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-slate-300 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-700 dark:bg-slate-900 md:sticky md:top-0 md:h-dvh md:w-56 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-t-0 md:p-3"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
            className={`flex min-h-14 flex-1 items-center justify-center text-sm font-semibold md:min-h-11 md:flex-none md:justify-start md:rounded-xl md:px-4 md:text-base ${
              tab === t.id
                ? 'bg-blue-100 text-blue-900 dark:bg-slate-800 dark:text-blue-200'
                : 'text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {t.label}
            {t.id === 'reminders' && dueCount > 0 && (
              <>
                <span aria-hidden="true" className="ml-2 min-w-6 rounded-full bg-red-800 px-2 py-0.5 text-center text-xs font-bold text-white">
                  {dueCount}
                </span>
                <span className="sr-only">, {dueCount} due</span>
              </>
            )}
          </button>
        ))}
      </nav>
      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-10">
        {tab === 'vault' && <Vault vault={vault} dueCount={dueCount} onReview={() => setTab('reminders')} />}
        {tab === 'generator' && <Generator />}
        {tab === 'reminders' && <Reminders vault={vault} />}
        {tab === 'settings' && <Settings minutes={minutes} onMinutesChange={setMinutes} background={background} onBackgroundChange={setBackground} sync={sync} onSynced={vault.reload} />}
      </main>
    </div>
  )
}
