import { useState } from 'react'
import { importCsv, type ImportPreview } from '../../sync/importCsv'
import { recordActivity } from '../../security/activityStore'
import type { EntryInput } from '../../vault/entry'
import type { VaultApi } from '../useVault'
import { Button, Card, Field } from '../components'
import { describeError } from '../messages'

export function ImportSection({ vault, vaultKey, vaultId }: { vault: VaultApi; vaultKey?: CryptoKey; vaultId?: string }) {
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const choose = async (file: File | undefined) => {
    setError(''); setNote(''); setPreview(null)
    if (!file) return
    try {
      const text = await file.text()
      const existing = vault.entries.map((e) => ({ title: e.title, username: e.username, url: e.url }))
      setPreview(importCsv(text, existing))
    } catch (e) { setError(describeError(e)) }
  }

  const toggle = (i: number) => setPreview((p) => p ? { ...p, records: p.records.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r) } : p)

  const run = async () => {
    if (!preview || busy) return
    setBusy(true); setError('')
    try {
      const selected = preview.records.filter((r) => r.selected)
      let ok = 0
      for (const r of selected) {
        const input: EntryInput = { title: r.title || 'Imported', username: r.username, url: r.url, password: r.password, notes: r.notes, tags: r.tags, generator: { mode: 'password', length: 20, upper: true, lower: true, digits: true, symbols: true, excludeLookalikes: true } }
        await vault.create(input)
        ok++
      }
      await recordActivity('import-completed', `Imported ${ok} item(s)`, vaultKey, vaultId)
      setNote(`Imported ${ok} item(s). Duplicates and unsafe URLs were skipped or cleaned.`)
      setPreview(null)
    } catch (e) { setError(describeError(e)) }
    finally { setBusy(false) }
  }

  return (
    <Card title="Import passwords" className="gap-3">
      <p className="text-sm text-slate-700 dark:text-slate-300">Import a CSV file (including Bitwarden-compatible exports). Data stays local, you’ll see a preview, duplicates are skipped by default, and unsafe URL schemes are removed. If the CSV contains unencrypted passwords, handle the file carefully and delete it after import.</p>
      <Field label="Choose CSV file" type="file" accept=".csv,text/csv" onChange={(e) => void choose(e.target.files?.[0])} />
      {preview && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/40">
          <p><strong>Detected:</strong> {preview.detectedFormat}. <strong>Rows:</strong> {preview.records.length}. Select items to import.</p>
          {preview.errors.map((e) => <p key={e} className="text-amber-800 dark:text-amber-300" role="status">{e}</p>)}
          <ul className="mt-2 max-h-56 space-y-1 overflow-auto" aria-label="Import preview">
            {preview.records.slice(0, 80).map((r, i) => (
              <li key={i}><label className="flex cursor-pointer gap-2 rounded p-1 hover:bg-white/60 dark:hover:bg-slate-800"><input type="checkbox" checked={r.selected} onChange={() => toggle(i)} /><span className="min-w-0"><span className="font-medium">{r.title}</span> {r.username ? <span className="text-slate-600 dark:text-slate-400">({r.username})</span> : ''} {r.duplicateOf ? <em className="text-slate-500">— {r.duplicateOf}</em> : ''} {r.errors.length ? <em className="text-amber-700 dark:text-amber-300">— {r.errors.join(' ')}</em> : ''}</span></label></li>
            ))}
          </ul>
          {preview.records.length > 80 && <p className="text-slate-500">Showing first 80 rows in preview.</p>}
          <Button disabled={busy || !preview.records.some((r) => r.selected)} onClick={() => void run()} className="mt-3">{busy ? 'Importing…' : `Import selected (${preview.records.filter((r)=>r.selected).length})`}</Button>
        </div>
      )}
      <p role="status" aria-live="polite" className="min-h-5 text-sm">{note}</p>
      {error && <p role="alert" className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>}
    </Card>
  )
}
