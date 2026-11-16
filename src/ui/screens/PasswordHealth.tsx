import { analyzeVaultHealth, type HealthReport } from '../../vault/health'
import { Button, Card, Screen } from '../components'
import type { Entry } from '../../vault/entry'

export function PasswordHealth({ entries, onOpen, onBack }: { entries: Entry[]; onOpen: (id: string) => void; onBack: () => void }) {
  const report: HealthReport = analyzeVaultHealth(entries)
  return (
    <Screen title="Password Health">
      <Button variant="secondary" onClick={onBack} className="self-start">Back to vault</Button>
      <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-slate-900 dark:to-slate-900">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Overall score</p>
        <p className="text-4xl font-bold tracking-tight">{report.score}<span className="text-xl text-slate-500">/100</span></p>
        <p className="text-sm text-slate-700 dark:text-slate-300">{report.formula}</p>
      </Card>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Health summary">
        {[['Total', report.total], ['Strong', report.strong], ['Weak', report.weak], ['Reused', report.reused], ['Old', report.old], ['Attention', report.needsAttention], ['Missing username', report.missingUsername], ['Insecure HTTP', report.insecureUrls]].map(([label, value]) => (
          <li key={String(label)} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"><span className="block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span><span className="text-xl font-semibold">{value}</span></li>
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
            <li key={e.entryId}><button type="button" onClick={() => onOpen(e.entryId)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800"><span className="font-medium">{e.title}</span><span className="mt-1 block text-sm text-slate-700 dark:text-slate-300">{e.issues.map((i) => i.label).join(' · ')}</span></button></li>
          ))}</ul>
        </Card>
      )}
      {report.suggestions.length > 0 && (
        <Card title="Suggested actions"><ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">{report.suggestions.map((s, i) => <li key={i}><strong>{s.title}:</strong> {s.text}</li>)}</ul></Card>
      )}
    </Screen>
  )
}
