import { useState } from 'react'
import { describeDue, describeRotation, dueEntries, type DueItem } from '../../reminders/schedule'
import { Button, Screen } from '../components'
import { RotateView } from '../vault/RotateView'
import type { VaultApi } from '../useVault'

function Group({ title, items, onChange }: { title: string; items: DueItem[]; onChange?: (id: string) => void }) {
  if (items.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <ul className="flex flex-col gap-2">
        {items.map(({ entry, status }) => (
          <li key={entry.id} className="flex flex-col gap-2 rounded-xl border border-slate-400 p-4 dark:border-slate-600">
            <div>
              <p className="font-semibold">{entry.title}</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {describeDue(status)}
                {entry.rotation ? ` · changes ${describeRotation(entry.rotation)}` : ''}
              </p>
            </div>
            {onChange && (
              <Button variant="secondary" aria-label={`Change password for ${entry.title}`} onClick={() => onChange(entry.id)} className="self-start">
                Change password
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Reminders({ vault }: { vault: VaultApi }) {
  const [rotatingId, setRotatingId] = useState<string | null>(null)

  if (!vault.ready) {
    return (
      <Screen title="Reminders">
        <p aria-busy="true">Opening your passwords…</p>
      </Screen>
    )
  }

  const rotating = rotatingId ? vault.entries.find((e) => e.id === rotatingId) : undefined
  if (rotating) {
    return <RotateView vault={vault} entry={rotating} onDone={() => setRotatingId(null)} onCancel={() => setRotatingId(null)} />
  }

  const { overdue, soon, later } = dueEntries(vault.entries, Date.now())
  const hasAny = overdue.length + soon.length + later.length > 0
  return (
    <Screen title="Reminders">
      {!hasAny && <p>No reminders yet. Open a password and choose “Remind me to change this password”.</p>}
      {hasAny && overdue.length + soon.length === 0 && <p>Nothing is due.</p>}
      <Group title="Overdue" items={overdue} onChange={setRotatingId} />
      <Group title="Due soon" items={soon} onChange={setRotatingId} />
      <Group title="Coming up" items={later.slice(0, 5)} />
    </Screen>
  )
}
