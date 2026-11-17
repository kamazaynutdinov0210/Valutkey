import { getLastBackupAt } from '../prefs'
import { buildDashboard } from '../../vault/dashboard'
import { describeDue } from '../../reminders/schedule'
import { Button, Card, Screen } from '../components'
import type { VaultApi } from '../useVault'

const date = (ts: number) => new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function Stat({ label, value, tone = '' }: { label: string; value: number; tone?: string }) {
  return (
    <div className={`rounded-xl border border-[rgb(var(--vk-border))] bg-[rgb(var(--vk-surface))] p-3 ${tone}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-[rgb(var(--vk-text-muted))]">{label}</div>
    </div>
  )
}

export function Dashboard({ vault, dueCount, onOpenVault, onHealth, onOpenEntry, onReview }: { vault: VaultApi; dueCount: number; onOpenVault: () => void; onHealth: () => void; onOpenEntry: (id: string) => void; onReview: () => void }) {
  if (vault.error) {
    return (
      <Screen title="Dashboard">
        <p role="alert">{vault.error}</p>
      </Screen>
    )
  }
  if (!vault.ready) {
    return (
      <Screen title="Dashboard">
        <p aria-busy="true">Opening your dashboard…</p>
      </Screen>
    )
  }

  const data = buildDashboard(vault.entries, Date.now(), getLastBackupAt())

  return (
    <Screen title="Dashboard">
      <div className="flex flex-wrap gap-2">
        <Button onClick={onOpenVault} className="flex-1">Open vault</Button>
        <Button variant="secondary" onClick={onHealth}>Password health</Button>
      </div>

      <Card title="Security score" className="gap-2">
        <div className="flex items-end gap-3">
          <span className="text-4xl font-bold">{data.score}</span>
          <span className="pb-1 text-[rgb(var(--vk-text-muted))]">out of 100</span>
        </div>
        <p className="text-sm text-[rgb(var(--vk-text-muted))]">A local heuristic from this vault’s data. It does not guarantee security.</p>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Saved items" value={data.total} />
        <Stat label="Secure notes" value={data.notes} />
        <Stat label="Favorites" value={data.favorites} />
        <Stat label="Weak passwords" value={data.weak} />
        <Stat label="Reused passwords" value={data.reused} />
        <Stat label="Need attention" value={data.needsAttention} />
      </div>

      {dueCount > 0 && (
        <div role="status" className="flex flex-col gap-2 rounded-xl border border-amber-800 bg-amber-50 p-4 text-amber-950 dark:border-amber-300 dark:bg-[rgb(var(--vk-surface))] dark:text-amber-100">
          <p className="font-medium">{dueCount === 1 ? '1 password is due for a change.' : `${dueCount} passwords are due for a change.`}</p>
          <Button variant="secondary" onClick={onReview} className="self-start">Review reminders</Button>
        </div>
      )}

      <Card title="Recommendations">
        {data.recommendations.length === 0 ? (
          <p>Nothing needs attention right now.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5">
            {data.recommendations.map((r) => <li key={r}>{r}</li>)}
          </ul>
        )}
      </Card>

      <Card title="Upcoming rotations">
        {data.upcoming.length === 0 ? (
          <p className="text-[rgb(var(--vk-text-muted))]">No rotations are due soon.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.upcoming.map(({ entry, status }) => (
              <li key={entry.id}>
                <button type="button" onClick={() => onOpenEntry(entry.id)} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-[rgb(var(--vk-border))] bg-[rgb(var(--vk-surface))] px-4 py-3 text-left hover:bg-[rgb(var(--vk-surface-2))]">
                  <span className="truncate font-semibold">{entry.title}</span>
                  <span className={`shrink-0 text-sm ${status.state === 'overdue' ? 'text-red-800 dark:text-red-300' : 'text-[rgb(var(--vk-text-muted))]'}`}>{describeDue(status)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Recently updated">
        {data.recentlyUpdated.length === 0 ? (
          <p className="text-[rgb(var(--vk-text-muted))]">No items yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.recentlyUpdated.map((entry) => (
              <li key={entry.id}>
                <button type="button" onClick={() => onOpenEntry(entry.id)} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-[rgb(var(--vk-border))] bg-[rgb(var(--vk-surface))] px-4 py-3 text-left hover:bg-[rgb(var(--vk-surface-2))]">
                  <span className="truncate font-semibold">{entry.favorite ? '★ ' : ''}{entry.title}</span>
                  <span className="shrink-0 text-sm text-[rgb(var(--vk-text-muted))]">{date(entry.updatedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Last backup">
        <p className="text-[rgb(var(--vk-text-muted))]">
          {data.lastBackupAt === null ? 'No backup saved from this device yet.' : `Last saved ${date(data.lastBackupAt)}.`}
        </p>
      </Card>
    </Screen>
  )
}