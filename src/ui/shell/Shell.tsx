import { useEffect, useRef, useState } from 'react'
import { syncHint } from '../../pwa/background'
import { openSyncTarget } from '../../sync/target'
import { createIdleLock } from '../../vault/idleLock'
import { notificationPermission, shouldNotify, showDueNotification, todayKey } from '../../reminders/notify'
import { dueEntries } from '../../reminders/schedule'
import { lockVault } from '../lock'
import { getAutoLockMinutes, getBackgroundEnabled, getLastNotifiedDay, getNotifyEnabled, setLastNotifiedDay } from '../prefs'
import { useSessionState } from '../hooks'
import { Generator } from '../screens/Generator'
import { Reminders } from '../screens/Reminders'
import { Settings } from '../screens/Settings'
import { Vault } from '../screens/Vault'
import { Dashboard } from '../screens/Dashboard'
import { Applications } from '../screens/Applications'
import { useSync } from '../useSync'
import { useVault } from '../useVault'

type Tab = 'dashboard' | 'vault' | 'applications' | 'generator' | 'reminders' | 'settings'
const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'vault', label: 'My Vault' },
  { id: 'applications', label: 'Apps' },
  { id: 'generator', label: 'Generator' },
  { id: 'reminders', label: 'Reminders' },
  { id: 'settings', label: 'Settings' },
]
const NAV_GROUPS: { title: string; ids: Tab[] }[] = [
  { title: 'WORKSPACE', ids: ['vault', 'generator', 'reminders'] },
  { title: 'SECURITY', ids: ['dashboard', 'applications'] },
  { title: 'SYSTEM', ids: ['settings'] },
]

export function Shell() {
  const [tab, setTab] = useState<Tab>('vault')
  const [focusEntryId, setFocusEntryId] = useState<string | undefined>(undefined)
  const [healthSignal, setHealthSignal] = useState(0)
  const [minutes, setMinutes] = useState(getAutoLockMinutes)
  const vault = useVault() // lives here so entries stay loaded while switching tabs
  const sessionState = useSessionState()
  const vaultKey = sessionState.status === 'unlocked' ? sessionState.vaultKey : undefined
  const vaultId = sessionState.status === 'unlocked' ? sessionState.header.vaultId : undefined
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
    <div className="min-h-dvh bg-[rgb(var(--vk-bg))] md:flex">
      {/* One nav element: a bottom tab bar on phones, a sidebar from tablet width up. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[rgb(var(--vk-border))] bg-[rgb(var(--vk-surface))]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-[rgb(var(--vk-surface))]/80 md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-t-0 md:p-3"
      >
        <div className="hidden px-2 pb-2 md:block">
          <p className="text-xs font-bold tracking-[0.2em] text-[rgb(var(--vk-accent))]">VAULTKEY</p>
          <p className="text-xs text-[rgb(var(--vk-text-muted))]">PRIVATE SECURITY VAULT</p>
        </div>
        <div className="hidden flex-1 flex-col gap-4 overflow-y-auto md:flex">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-1">
              <p className="px-2 text-[10px] font-bold tracking-[0.18em] text-[rgb(var(--vk-text-muted))]">{group.title}</p>
              {group.ids.map((id) => {
                const t = TABS.find((x) => x.id === id)!
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-current={tab === t.id ? 'page' : undefined}
                    onClick={() => setTab(t.id)}
                    className={`flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 text-base font-semibold transition-all duration-150 ${
                      tab === t.id
                        ? 'bg-[rgb(var(--vk-accent-soft))] text-[rgb(var(--vk-accent))]'
                        : 'text-[rgb(var(--vk-text-muted))] hover:bg-[rgb(var(--vk-surface-2))]'
                    }`}
                  >
                    <span>{t.label}</span>
                    {t.id === 'reminders' && dueCount > 0 && (
                      <>
                        <span aria-hidden="true" className="min-w-6 rounded-full bg-red-800 px-2 py-0.5 text-center text-xs font-bold text-white">
                          {dueCount}
                        </span>
                        <span className="sr-only">, {dueCount} due</span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <div className="flex w-full gap-0 md:hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => setTab(t.id)}
              className={`flex min-h-14 flex-1 items-center justify-center gap-2 rounded-none text-sm font-semibold transition-all duration-150 ${
                tab === t.id
                  ? 'bg-[rgb(var(--vk-accent-soft))] text-[rgb(var(--vk-accent))]'
                  : 'text-[rgb(var(--vk-text-muted))] hover:bg-[rgb(var(--vk-surface-2))]'
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
        </div>
      </nav>
      <main id="main-content" className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 md:px-10 md:pb-10">
        {tab === 'dashboard' && (
          <Dashboard
            vault={vault}
            dueCount={dueCount}
            onOpenVault={() => setTab('vault')}
            onHealth={() => { setHealthSignal((n) => n + 1); setTab('vault') }}
            onOpenEntry={(id) => { setFocusEntryId(id); setTab('vault') }}
            onReview={() => setTab('reminders')}
          />
        )}
        {tab === 'vault' && <Vault vault={vault} dueCount={dueCount} onReview={() => setTab('reminders')} focusEntryId={focusEntryId} healthSignal={healthSignal} />}
        {tab === 'applications' && <Applications vault={vault} />}
        {tab === 'generator' && <Generator />}
        {tab === 'reminders' && <Reminders vault={vault} />}
        {tab === 'settings' && <Settings vault={vault} vaultKey={vaultKey} vaultId={vaultId} minutes={minutes} onMinutesChange={setMinutes} background={background} onBackgroundChange={setBackground} sync={sync} onSynced={vault.reload} />}
      </main>
    </div>
  )
}
