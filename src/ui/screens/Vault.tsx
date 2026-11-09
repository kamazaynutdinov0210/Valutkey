import { useState } from 'react'
import { Screen } from '../components'
import { EntryDetail } from '../vault/EntryDetail'
import { EntryForm } from '../vault/EntryForm'
import { EntryList } from '../vault/EntryList'
import { RotateView } from '../vault/RotateView'
import type { VaultApi } from '../useVault'

type View = { kind: 'list' } | { kind: 'detail'; id: string } | { kind: 'form'; id?: string } | { kind: 'rotate'; id: string }

export function Vault({ vault, dueCount, onReview }: { vault: VaultApi; dueCount: number; onReview: () => void }) {
  const [view, setView] = useState<View>({ kind: 'list' })
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | undefined>(undefined)

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
  const current = view.kind !== 'list' && view.id ? vault.entries.find((e) => e.id === view.id) : undefined
  const toDetail = (id: string) => setView({ kind: 'detail', id })

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
      onOpen={toDetail}
      onAdd={() => setView({ kind: 'form' })}
      dueCount={dueCount}
      onReview={onReview}
    />
  )
}
