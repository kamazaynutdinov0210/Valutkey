import { analyzeVaultHealth, type HealthReport } from '../../vault/health'
import { Button, Card, Screen } from '../components'
import type { Entry } from '../../vault/entry'

export function PasswordHealth({ entries, onOpen, onBack }: { entries: Entry[]; onOpen: (id: string) => void; onBack: () => void }) {
  const report: HealthReport = analyzeVaultHealth(entries)
  return (
    <Screen title="Password Health">
      <Button variant="secondary" onClick={onBack} className="self-start">Back to vault</Button>
      <Card className="bg-gradient-to-br from-emerald-50 to-[rgb(var(--vk-surface))] dark:from-[rgb(var(--vk-surface))] dark:to-[rgb(var(--vk-surface))]">
        <p className="text-sm font-medium text-[rgb(var(--vk-text-muted))]">Overall score</p>
        <p className="text-4xl font-bold tracking-tight">{report.score}<span className="text-xl text-[rgb(var(--vk-text-muted))]">/100</span></p>
        <p className="text-sm text-[rgb(var(--vk-text-muted))]">{report.formula}</p>
      </Card>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Health summary">
        {[['Total', report.total], ['Strong', report.strong], ['Weak', report.weak], ['Reused', report.reused], ['Old', report.old], ['Attention', report.needsAttention], ['Missing username', report.missingUsername], ['Insecure HTTP', report.insecureUrls]].map(([label, value]) => (
          <li key={String(label)} className="rounded-xl border border-[rgb(var(--vk-border))] bg-[rgb(var(--vk-surface))] p-3 shadow-sm"><span className="block text-xs font-medium uppercase tracking-wide text-[rgb(var(--vk-text-muted))]">{label}</span><span className="text-xl font-semibold">{value}</span></li>
        ))}
      </ul>
      {report.reusedGroups.length > 0 && (
        <Card title="Reused passwords">
          <div className="flex flex-col gap-3">{report.reusedGroups.map((g) => (
            <div key={g.entryIds.join(',')} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
              <p>Used by: {g.titles.join(', ')}</p>
              <div className="flex flex-wrap gap-2 pt-2">{g.entryIds.map((id, i) => <Button key={id} variant="secondary" onClick={() => onOpen(id)}>{g.titles[i]}</Button>)}</div>
            </div>
          ))}</div>
        </Card>
      )}
      {report.weakEntries.length > 0 && (
        <Card title="Items needing attention">
          <ul className="flex flex-col gap-2">{report.weakEntries.map((e) => (
            <li key={e.entryId}><button type="button" onClick={() => onOpen(e.entryId)} className="w-full rounded-xl border border-[rgb(var(--vk-border))] bg-[rgb(var(--vk-surface-2))] p-3 text-left transition-colors hover:bg-[rgb(var(--vk-surface))]"><span className="font-medium">{e.title}</span><span className="mt-1 block text-sm text-[rgb(var(--vk-text-muted))]">{e.issues.map((i) => i.label).join(' · ')}</span></button></li>
          ))}</ul>
        </Card>
      )}
      {report.suggestions.length > 0 && (
        <Card title="Suggested actions"><ul className="list-disc space-y-1 pl-5 text-sm text-[rgb(var(--vk-text-muted))]">{report.suggestions.map((s, i) => <li key={i}><strong>{s.title}:</strong> {s.text}</li>)}</ul></Card>
      )}
    </Screen>
  )
}
