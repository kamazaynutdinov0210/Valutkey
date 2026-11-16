import { useState } from 'react'
import { strengthFromBits } from '../../generator'
import { suggestPassword } from '../../reminders/suggest'
import { EntryError, safeHttpUrl, type Entry } from '../../vault/entry'
import { secretClipboard } from '../clipboard'
import { Button, Card, Screen, StrengthMeter } from '../components'
import type { VaultApi } from '../useVault'

/**
 * Suggests a new password made with this entry's own settings. Nothing changes until the person
 * confirms, because the password must also be changed on the website; saving one that was never
 * set there would lock them out.
 */
export function RotateView({ vault, entry, onDone, onCancel }: { vault: VaultApi; entry: Entry; onDone: () => void; onCancel: () => void }) {
  const [suggestion, setSuggestion] = useState(() => suggestPassword(entry))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const link = safeHttpUrl(entry.url)

  const copy = async (text: string, what: string) => {
    try { await secretClipboard().copy(text); setNote(`${what} copied. It will be cleared from your clipboard in 30 seconds.`) }
    catch { setNote('Couldn’t copy. Select the text and copy it yourself.') }
  }
  const save = async () => {
    setBusy(true); setError('')
    try { await vault.rotate(entry.id, suggestion.value); onDone() }
    catch (e) { setError(e instanceof EntryError ? e.message : 'Couldn’t save. Please try again.'); setBusy(false) }
  }

  return (
    <Screen title={`Change password: ${entry.title}`}>
      <Card className="gap-4 border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/10">
        <p>Here is a new password for this account. <strong>Change it on the website first</strong>, then tap “Save new password” so VaultKey keeps the right one. Until you save, your current password stays as it is.</p>
        {link && <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center rounded-lg bg-white px-3 py-2 text-sm font-medium text-blue-800 underline underline-offset-2 shadow-sm dark:bg-slate-900 dark:text-blue-300">Open {entry.url}</a>}
      </Card>
      <Card className="gap-3">
        <p data-testid="suggested-password" className="break-all rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xl leading-relaxed dark:border-slate-700 dark:bg-slate-800/70">{suggestion.value}</p>
        <StrengthMeter strength={strengthFromBits(suggestion.entropyBits)} />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => void copy(suggestion.value, 'New password')}>Copy new password</Button>
          <Button variant="secondary" className="flex-1" onClick={() => setSuggestion(suggestPassword(entry))}>Make another</Button>
        </div>
        <Button variant="secondary" onClick={() => void copy(entry.password, 'Current password')} className="self-start">Copy current password</Button>
      </Card>
      <p role="status" aria-live="polite" className="min-h-6 text-sm">{note}</p>
      {error && <p role="alert" className="font-medium text-red-800 dark:text-red-300">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void save()} className="flex-1">{busy ? 'Saving…' : 'Save new password'}</Button>
        <Button variant="secondary" disabled={busy} onClick={onCancel} className="flex-1">Cancel</Button>
      </div>
    </Screen>
  )
}
