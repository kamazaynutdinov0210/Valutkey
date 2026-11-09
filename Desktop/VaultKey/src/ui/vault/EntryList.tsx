import { allTags, searchEntries } from '../../vault/search'
import { Button, Field, Screen } from '../components'
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
}

export function EntryList({ vault, query, onQuery, tag, onTag, onOpen, onAdd, dueCount, onReview }: Props) {
  const tags = allTags(vault.entries)
  const shown = searchEntries(vault.entries, query, tag)
  return (
    <Screen title="Vault">
      {dueCount > 0 && (
        <div role="status" className="flex flex-col gap-2 rounded-xl border border-amber-800 bg-amber-50 p-4 text-amber-950 dark:border-amber-300 dark:bg-slate-800 dark:text-amber-100">
          <p className="font-medium">{dueCount === 1 ? '1 password is due for a change.' : `${dueCount} passwords are due for a change.`}</p>
          <Button variant="secondary" onClick={onReview} className="self-start">
            Review
          </Button>
        </div>
      )}
      <Button onClick={onAdd}>Add password</Button>

      {vault.entries.length > 0 && (
        <>
          <Field label="Search" type="search" value={query} onChange={(e) => onQuery(e.target.value)} autoComplete="off" spellCheck={false} />
          {tags.length > 0 && (
            <div role="group" aria-label="Filter by tag" className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tag?.toLowerCase() === t.toLowerCase()}
                  onClick={() => onTag(tag?.toLowerCase() === t.toLowerCase() ? undefined : t)}
                  className="min-h-11 rounded-full border border-slate-500 px-4 text-sm font-medium aria-pressed:border-blue-900 aria-pressed:bg-blue-100 aria-pressed:text-blue-900 dark:aria-pressed:border-blue-200 dark:aria-pressed:bg-slate-700 dark:aria-pressed:text-blue-100"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {vault.entries.length === 0 ? (
        <p>No passwords yet. Tap “Add password” to save your first one.</p>
      ) : shown.length === 0 ? (
        <p role="status">Nothing matches your search.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onOpen(e.id)}
                className="flex min-h-14 w-full flex-col justify-center rounded-xl border border-slate-400 px-4 py-2 text-left hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
              >
                <span className="font-semibold">{e.title}</span>
                {e.username && <span className="text-sm text-slate-700 dark:text-slate-300">{e.username}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {vault.damaged > 0 && (
        <p role="alert" className="font-medium text-red-800 dark:text-red-300">
          {vault.damaged} saved {vault.damaged === 1 ? 'item' : 'items'} couldn’t be read and {vault.damaged === 1 ? 'was' : 'were'} skipped. If you have a
          backup, you can restore it.
        </p>
      )}
    </Screen>
  )
}
