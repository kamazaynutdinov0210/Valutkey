import { useMemo } from 'react'
import { allCategories, allTags, searchEntries, type SortKey } from '../../vault/search'
import { Button, EmptyState, Field, Screen, Toggle } from '../components'
import type { VaultApi } from '../useVault'

interface Props {
  vault: VaultApi
  query: string
  onQuery: (q: string) => void
  tag: string | undefined
  onTag: (t: string | undefined) => void
  onOpen: (id: string) => void
  onAdd: () => void
  dueCount: number
  onReview: () => void
  onHealth?: () => void
  sort: SortKey
  onSort: (s: SortKey) => void
  favoritesOnly: boolean
  onFavoritesOnly: (v: boolean) => void
  category: string | undefined
  onCategory: (c: string | undefined) => void
}

const SELECT = 'min-h-11 rounded-xl border border-[rgb(var(--vk-border))] bg-[rgb(var(--vk-surface))] px-3 text-base text-[rgb(var(--vk-text))]'

export function EntryList({ vault, query, onQuery, tag, onTag, onOpen, onAdd, dueCount, onReview, onHealth, sort, onSort, favoritesOnly, onFavoritesOnly, category, onCategory }: Props) {
  const tags = useMemo(() => allTags(vault.entries), [vault.entries])
  const categories = useMemo(() => allCategories(vault.entries), [vault.entries])
  const shown = useMemo(() => searchEntries(vault.entries, query, tag, { sort, favoritesOnly, category }), [vault.entries, query, tag, sort, favoritesOnly, category])
  return (
    <Screen title="Vault">
      {dueCount > 0 && (
        <div role="status" className="flex flex-col gap-2 rounded-xl border border-amber-800 bg-amber-50 p-4 text-amber-950 dark:border-amber-300 dark:bg-[rgb(var(--vk-surface))] dark:text-amber-100">
          <p className="font-medium">{dueCount === 1 ? '1 password is due for a change.' : `${dueCount} passwords are due for a change.`}</p>
          <Button variant="secondary" onClick={onReview} className="self-start">Review</Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onAdd} className="flex-1">Add password</Button>
        {onHealth && <Button variant="secondary" onClick={onHealth}>Password Health</Button>}
      </div>

      {vault.entries.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[rgb(var(--vk-border))] bg-[rgb(var(--vk-surface-2))] p-3">
          <Field label="Search" type="search" value={query} onChange={(e) => onQuery(e.target.value)} autoComplete="off" spellCheck={false} />
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1 text-sm font-medium">Sort
              <select className={SELECT} value={sort} onChange={(e) => onSort(e.target.value as SortKey)}>
                <option value="title">Title (A–Z)</option>
                <option value="updated">Recently updated</option>
                <option value="recent">Recently used</option>
                <option value="created">Recently added</option>
              </select>
            </label>
            {categories.length > 0 && (
              <label className="flex flex-col gap-1 text-sm font-medium">Category
                <select className={SELECT} value={category ?? ''} onChange={(e) => onCategory(e.target.value || undefined)}>
                  <option value="">All categories</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            )}
          </div>
          <Toggle label="Favorites only" checked={favoritesOnly} onChange={(e) => onFavoritesOnly(e.target.checked)} />
          {tags.length > 0 && (
            <div role="group" aria-label="Filter by tag" className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <button key={t} type="button" aria-pressed={tag?.toLowerCase() === t.toLowerCase()} onClick={() => onTag(tag?.toLowerCase() === t.toLowerCase() ? undefined : t)}
                  className="min-h-11 rounded-full border border-[rgb(var(--vk-border))] px-4 text-sm font-medium aria-pressed:border-[rgb(var(--vk-accent))] aria-pressed:bg-[rgb(var(--vk-accent-soft))] aria-pressed:text-[rgb(var(--vk-accent))]">{t}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {vault.entries.length === 0 ? (
        <EmptyState><p>No passwords yet. Tap “Add password” to save your first one.</p></EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState><p role="status">Nothing matches your search.</p></EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => onOpen(e.id)} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-[rgb(var(--vk-border))] bg-[rgb(var(--vk-surface))] px-4 py-3 text-left shadow-sm transition-colors hover:bg-[rgb(var(--vk-surface-2))]">
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-semibold">{e.favorite && <span aria-label="Favorite">★</span>}<span className="truncate">{e.title}</span></span>
                  {e.username && <span className="block truncate text-sm text-[rgb(var(--vk-text-muted))]">{e.username}</span>}
                  {(e.category || e.tags.length > 0) && <span className="mt-1 flex flex-wrap gap-1 text-xs text-[rgb(var(--vk-text-muted))]">{e.category && <span className="rounded bg-[rgb(var(--vk-surface-2))] px-2 py-0.5">{e.category}</span>}{e.tags.slice(0,2).map((t)=><span key={t} className="rounded bg-[rgb(var(--vk-surface-2))] px-2 py-0.5">{t}</span>)}</span>}
                </span>
                <span className="text-[rgb(var(--vk-text-muted))]">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {vault.damaged > 0 && (
        <p role="alert" className="font-medium text-red-800 dark:text-red-300">
          {vault.damaged} saved {vault.damaged === 1 ? 'item' : 'items'} couldn’t be read and {vault.damaged === 1 ? 'was' : 'were'} skipped. If you have a backup, you can restore it.
        </p>
      )}
    </Screen>
  )
}
