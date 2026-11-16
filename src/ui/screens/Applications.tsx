import { useMemo, useState } from 'react'
import type { Entry } from '../../vault/entry'
import { buildApplicationGroups, isDueSoon, isOverdue } from '../../vault/applications'
import { Card, Screen, Toggle } from '../components'
import type { VaultApi } from '../useVault'

interface Props { vault: VaultApi }

type Filter = 'all' | 'active' | 'archived' | 'due' | 'overdue' | 'favorites' | 'auto-on' | 'auto-off'
type Sort = 'name' | 'lastChange' | 'nextChange' | 'status'

// helpers imported from ../../vault/applications

export function Applications({ vault }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('name')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [changeTarget, setChangeTarget] = useState<Entry | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState(false)

  const showToast = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 3000) }

  // grouping handled by buildApplicationGroups

  const filteredGroups = useMemo(
    () => buildApplicationGroups(vault.entries, filter, query, sort),
    [vault.entries, filter, query, sort],
  )

  const stats = useMemo(() => {
    const accounts = vault.entries.filter((e) => e.deletedAt === undefined && e.archivedAt === undefined)
    return {
      totalApps: new Set(accounts.map((e) => (e.application || e.title || 'Unnamed').trim() || 'Unnamed')).size,
      totalAccounts: accounts.length,
      due: accounts.filter((e) => isDueSoon(e)).length,
      overdue: accounts.filter((e) => isOverdue(e)).length,
      favorites: accounts.filter((e) => e.favorite).length,
      autoOn: accounts.filter((e) => e.automationEnabled === true).length,
      archived: vault.entries.filter((e) => e.archivedAt !== undefined && e.deletedAt === undefined).length,
    }
  }, [vault.entries])

  const updateEntry = async (entry: Entry, patch: Partial<Entry>) => {
    setBusyId(entry.id)
    try {
      await vault.update(entry.id, {
        title: entry.title,
        username: entry.username,
        url: entry.url,
        password: entry.password,
        notes: entry.notes,
        tags: entry.tags,
        category: entry.category,
        favorite: patch.favorite ?? entry.favorite,
        generator: entry.generator,
        rotation: entry.rotation ? { every: entry.rotation.every, unit: entry.rotation.unit } : undefined,
        email: patch.email ?? entry.email,
        application: patch.application ?? entry.application,
        icon: patch.icon ?? entry.icon,
        accountStatus: patch.accountStatus ?? entry.accountStatus,
        automationEnabled: patch.automationEnabled ?? entry.automationEnabled,
        automationMode: patch.automationMode ?? entry.automationMode,
        requireConfirmation: patch.requireConfirmation ?? entry.requireConfirmation,
        reminderEnabled: patch.reminderEnabled ?? entry.reminderEnabled,
        lastPasswordChangeAt: patch.lastPasswordChangeAt ?? entry.lastPasswordChangeAt,
        nextPasswordChangeAt: patch.nextPasswordChangeAt ?? entry.nextPasswordChangeAt,
        reminderIntervalDays: patch.reminderIntervalDays ?? entry.reminderIntervalDays,
        snoozedUntil: patch.snoozedUntil ?? entry.snoozedUntil,
        archivedAt: Object.prototype.hasOwnProperty.call(patch, 'archivedAt') ? patch.archivedAt : entry.archivedAt,
        lastChangeMethod: patch.lastChangeMethod ?? entry.lastChangeMethod,
        lastChangeStatus: patch.lastChangeStatus ?? entry.lastChangeStatus,
        lastChangeError: patch.lastChangeError ?? entry.lastChangeError,
      })
      showToast('Saved.')
    } catch {
      showToast('Could not save. Try again.')
    } finally {
      setBusyId(null)
    }
  }

  const archive = async (entry: Entry) => {
    await updateEntry(entry, { archivedAt: Date.now() } as Partial<Entry>)
  }
  const restoreArchived = async (entry: Entry) => {
    await updateEntry(entry, { archivedAt: undefined } as Partial<Entry>)
  }
  const permanentDelete = async (entry: Entry) => {
    if (!window.confirm(`Permanently delete “${entry.title}”? This cannot be undone.`)) return
    setBusyId(entry.id)
    try {
      await vault.remove(entry.id)
      showToast('Deleted.')
    } catch {
      showToast('Could not delete. Try again.')
    } finally {
      setBusyId(null)
    }
  }

  const toggleFavorite = async (entry: Entry) => { await updateEntry(entry, { favorite: !entry.favorite }) }
  const toggleAutomation = async (entry: Entry) => { await updateEntry(entry, { automationEnabled: !entry.automationEnabled }) }
  const toggleReminder = async (entry: Entry) => { await updateEntry(entry, { reminderEnabled: !entry.reminderEnabled }) }
  const toggleRequireConfirmation = async (entry: Entry) => { await updateEntry(entry, { requireConfirmation: !entry.requireConfirmation }) }
  const snooze = async (entry: Entry, days: number) => { await updateEntry(entry, { snoozedUntil: Date.now() + days * 86400000 }) }

  const submitChange = async () => {
    if (!changeTarget || !newPassword) return
    setBusyId(changeTarget.id)
    try {
      await vault.update(changeTarget.id, {
        title: changeTarget.title,
        username: changeTarget.username,
        url: changeTarget.url,
        password: newPassword,
        notes: changeTarget.notes,
        tags: changeTarget.tags,
        category: changeTarget.category,
        favorite: changeTarget.favorite,
        generator: changeTarget.generator,
        rotation: changeTarget.rotation ? { every: changeTarget.rotation.every, unit: changeTarget.rotation.unit } : undefined,
        email: changeTarget.email,
        application: changeTarget.application,
        icon: changeTarget.icon,
        accountStatus: changeTarget.accountStatus,
        automationEnabled: changeTarget.automationEnabled,
        automationMode: changeTarget.automationMode,
        requireConfirmation: changeTarget.requireConfirmation,
        reminderEnabled: changeTarget.reminderEnabled,
        lastPasswordChangeAt: Date.now(),
        nextPasswordChangeAt: changeTarget.reminderIntervalDays ? Date.now() + changeTarget.reminderIntervalDays * 86400000 : changeTarget.nextPasswordChangeAt,
        reminderIntervalDays: changeTarget.reminderIntervalDays,
        snoozedUntil: undefined,
        archivedAt: changeTarget.archivedAt,
        lastChangeMethod: 'manual',
        lastChangeStatus: 'success',
        lastChangeError: undefined,
      })
      showToast('Password updated and recorded.')
      setChangeTarget(null)
      setNewPassword('')
      setConfirm(false)
    } catch {
      showToast('Could not update password. Try again.')
    } finally {
      setBusyId(null)
    }
  }

  if (vault.error) return <Screen title="Applications & Accounts"><p role="alert">{vault.error}</p></Screen>
  if (!vault.ready) {
    return (
      <Screen title="Applications & Accounts">
        <div className="flex flex-col gap-3" aria-busy="true">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />)}
        </div>
      </Screen>
    )
  }

  return (
    <Screen title="Applications & Accounts">
      {toast && (
        <div role="status" className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><div className="text-2xl font-bold">{stats.totalApps}</div><div className="text-sm">Applications</div></Card>
        <Card><div className="text-2xl font-bold">{stats.totalAccounts}</div><div className="text-sm">Accounts</div></Card>
        <Card><div className="text-2xl font-bold">{stats.due + stats.overdue}</div><div className="text-sm">Due/Overdue</div></Card>
        <Card><div className="text-2xl font-bold">{stats.archived}</div><div className="text-sm">Archived</div></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search applications or accounts"
          className="min-h-11 flex-1 rounded-xl border border-slate-400 bg-white px-3 text-base dark:bg-slate-800"
          aria-label="Search"
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="min-h-11 rounded-xl border border-slate-400 bg-white px-3 text-base dark:bg-slate-800">
          <option value="all">All active</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="due">Due soon</option>
          <option value="overdue">Overdue</option>
          <option value="favorites">Favorites</option>
          <option value="auto-on">Automation on</option>
          <option value="auto-off">Automation off</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="min-h-11 rounded-xl border border-slate-400 bg-white px-3 text-base dark:bg-slate-800">
          <option value="name">Sort: Name</option>
          <option value="lastChange">Sort: Last change</option>
          <option value="nextChange">Sort: Next change</option>
          <option value="status">Sort: Status</option>
        </select>
      </div>

      {filteredGroups.length === 0 && (
        <Card>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {filter === 'archived' ? 'No archived accounts.' : 'No applications match. Save passwords in the Vault with an application name to see them here.'}
          </p>
        </Card>
      )}

      {filteredGroups.map(([name, accounts]) => (
        <Card key={name} title={`${accounts[0]?.icon ? accounts[0].icon + ' ' : ''}${name} (${accounts.length} account${accounts.length === 1 ? '' : 's'})`}>
          <ul className="flex flex-col gap-3">
            {accounts.map((e) => (
              <li key={e.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {e.favorite && <span aria-label="Favorite">★</span>}
                      <span className="font-semibold truncate">{e.icon ? e.icon + ' ' : ''}{e.username || e.email || e.title}</span>
                    </div>
                    {e.email && <div className="text-sm text-slate-600 dark:text-slate-300 truncate">{e.email}</div>}
                    {e.url && <div className="text-xs text-slate-500 truncate">{e.url}</div>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${e.accountStatus === 'inactive' ? 'bg-slate-200 text-slate-700' : 'bg-green-100 text-green-900'}`}>
                    {e.accountStatus === 'inactive' ? 'Inactive' : 'Active'}
                  </span>
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-300">
                  {e.nextPasswordChangeAt ? `Next change: ${new Date(e.nextPasswordChangeAt).toLocaleDateString()}` : 'No scheduled change'}
                  {e.lastPasswordChangeAt ? ` · Last: ${new Date(e.lastPasswordChangeAt).toLocaleDateString()}` : ''}
                  {e.automationLastStatus ? ` · Automation: ${e.automationLastStatus}` : ''}
                  {e.snoozedUntil && e.snoozedUntil > Date.now() ? ` · Snoozed until ${new Date(e.snoozedUntil).toLocaleDateString()}` : ''}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" disabled={busyId === e.id} onClick={() => void toggleFavorite(e)} className="min-h-11 rounded-xl border border-slate-400 px-3 text-sm font-medium">
                    {e.favorite ? 'Unfavorite' : 'Favorite'}
                  </button>
                  <Toggle label={e.automationEnabled ? 'Automation ON' : 'Automation OFF'} checked={Boolean(e.automationEnabled)} disabled={busyId === e.id} onChange={() => void toggleAutomation(e)} />
                  <Toggle label={e.reminderEnabled !== false ? 'Reminders ON' : 'Reminders OFF'} checked={e.reminderEnabled !== false} disabled={busyId === e.id} onChange={() => void toggleReminder(e)} />
                  <Toggle label={e.requireConfirmation ? 'Confirm changes' : 'No confirm'} checked={Boolean(e.requireConfirmation)} disabled={busyId === e.id} onChange={() => void toggleRequireConfirmation(e)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busyId === e.id} onClick={() => { setChangeTarget(e); setNewPassword(''); setConfirm(false) }} className="min-h-11 rounded-xl bg-blue-800 px-3 text-sm font-semibold text-white">
                    Change password
                  </button>
                  <button type="button" disabled={busyId === e.id} onClick={() => void snooze(e, 7)} className="min-h-11 rounded-xl border border-slate-400 px-3 text-sm font-medium">
                    Snooze 7d
                  </button>
                  {e.archivedAt ? (
                    <button type="button" disabled={busyId === e.id} onClick={() => void restoreArchived(e)} className="min-h-11 rounded-xl border border-slate-400 px-3 text-sm font-medium">Restore</button>
                  ) : (
                    <button type="button" disabled={busyId === e.id} onClick={() => void archive(e)} className="min-h-11 rounded-xl border border-slate-400 px-3 text-sm font-medium">Archive</button>
                  )}
                  <button type="button" disabled={busyId === e.id} onClick={() => void permanentDelete(e)} className="min-h-11 rounded-xl border border-red-700 px-3 text-sm font-medium text-red-800">
                    Delete
                  </button>
                </div>
                {e.lastChangeError && <p className="text-xs text-red-800 dark:text-red-300">Last change failed: {e.lastChangeError}</p>}
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {changeTarget && (
        <div role="dialog" aria-label="Change password" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <h2 className="text-lg font-semibold">Change password for {changeTarget.username || changeTarget.title}</h2>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
              This only updates VaultKey after you confirm the new password was accepted by the provider. Opening the provider page does not mean it changed.
            </p>
            {changeTarget.url && (
              <a href={changeTarget.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-blue-800 underline dark:text-blue-300">
                Open provider page
              </a>
            )}
            <label className="mt-3 flex flex-col gap-1 text-sm font-medium">
              Confirmed new password
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="min-h-11 rounded-xl border border-slate-400 bg-white px-3 text-base dark:bg-slate-800"
                autoComplete="new-password"
              />
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
              I confirmed this password works on the provider
            </label>
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={!newPassword || !confirm || busyId === changeTarget.id} onClick={() => void submitChange()} className="min-h-11 flex-1 rounded-xl bg-blue-800 px-3 text-sm font-semibold text-white disabled:opacity-50">
                {busyId === changeTarget.id ? 'Saving…' : 'Save new password'}
              </button>
              <button type="button" onClick={() => { setChangeTarget(null); setNewPassword(''); setConfirm(false) }} className="min-h-11 flex-1 rounded-xl border border-slate-400 px-3 text-sm font-medium">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  )
}