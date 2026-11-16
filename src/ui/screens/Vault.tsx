import { useEffect, useState } from 'react'
import type { SortKey } from '../../vault/search'
import { Screen } from '../components'
import { PasswordHealth } from './PasswordHealth'
import { EntryDetail } from '../vault/EntryDetail'
import { EntryForm } from '../vault/EntryForm'
import { EntryList } from '../vault/EntryList'
import { RotateView } from '../vault/RotateView'
import type { VaultApi } from '../useVault'

type View = { kind: 'list' } | { kind: 'health' } | { kind: 'detail'; id: string } | { kind: 'form'; id?: string } | { kind: 'rotate'; id: string }

export function Vault({ vault, dueCount, onReview, focusEntryId, healthSignal }: { vault: VaultApi; dueCount: number; onReview: () => void; focusEntryId?: string; healthSignal?: number }) {
  const [view, setView] = useState<View>({ kind: 'list' })
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | undefined>(undefined)
  const [sort, setSort] = useState<SortKey>('title')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [category, setCategory] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (focusEntryId) setView({ kind: 'detail', id: focusEntryId })
  }, [focusEntryId])
  useEffect(() => {
    if (healthSignal) setView({ kind: 'health' })
  }, [healthSignal])

  if (vault.error) {
    return (
      <Screen title="Vault">
        <p role="alert">{vault.error}</p>
      </Screen>
    )
  }
  if (!vault.ready) {
    return (
      <Screen title="Vault">
        <p aria-busy="true">Opening your passwords…</p>
      </Screen>
    )
  }

  const toList = () => setView({ kind: 'list' })
  const current = view.kind !== 'list' && view.kind !== 'health' && view.id ? vault.entries.find((e) => e.id === view.id) : undefined
  const toDetail = (id: string) => setView({ kind: 'detail', id })

  if (view.kind === 'health') return <PasswordHealth entries={vault.entries} onOpen={toDetail} onBack={toList} />
  if (view.kind === 'form') {
    return <EntryForm vault={vault} entry={current} onCancel={() => (current ? toDetail(current.id) : toList())} onSaved={(entry) => toDetail(entry.id)} />
  }
  if (view.kind === 'rotate' && current) {
    return <RotateView vault={vault} entry={current} onDone={() => toDetail(current.id)} onCancel={() => toDetail(current.id)} />
  }
  if (view.kind === 'detail' && current) {
    return (
      <EntryDetail
        vault={vault}
        entry={current}
        onBack={toList}
        onEdit={() => setView({ kind: 'form', id: current.id })}
        onRotate={() => setView({ kind: 'rotate', id: current.id })}
      />
    )
  }
  return (
    <EntryList
      vault={vault}
      query={query}
      onQuery={setQuery}
      tag={tag}
      onTag={setTag}
      onOpen={(id) => { void vault.markAccessed(id); toDetail(id) }}
      onAdd={() => setView({ kind: 'form' })}
      dueCount={dueCount}
      onReview={onReview}
      onHealth={() => setView({ kind: 'health' })}
      sort={sort}
      onSort={setSort}
      favoritesOnly={favoritesOnly}
      onFavoritesOnly={setFavoritesOnly}
      category={category}
      onCategory={setCategory}
    />
  )
}
