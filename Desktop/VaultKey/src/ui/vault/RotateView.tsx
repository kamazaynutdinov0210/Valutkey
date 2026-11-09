import { useState } from 'react'
import { strengthFromBits } from '../../generator'
import { suggestPassword } from '../../reminders/suggest'
import { EntryError, safeHttpUrl, type Entry } from '../../vault/entry'
import { secretClipboard } from '../clipboard'
import { Button, Screen, StrengthMeter } from '../components'
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
    try {
      await secretClipboard().copy(text)
      setNote(`${what} copied. It will be cleared from your clipboard in 30 seconds.`)
    } catch {
      setNote('Couldn’t copy. Select the text and copy it yourself.')
    }
  }
  const save = async () => {
    setBusy(true)
    setError('')
    try {
      await vault.rotate(entry.id, suggestion.value)
      onDone()
    } catch (e) {
      setError(e instanceof EntryError ? e.message : 'Couldn’t save. Please try again.')
      setBusy(false)
    }
  }

  return (
    <Screen title={`Change password: ${entry.title}`}>
      <p>
        Here is a new password for this account. <strong>Change it on the website first</strong>, then tap “Save new password” so VaultKey keeps the right
        one. Until you save, your current password stays as it is.
      </p>
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer" className="self-start text-blue-800 underline dark:text-blue-300">
          Open {entry.url}
        </a>
      )}
      <p data-testid="suggested-password" className="break-all rounded-xl border border-slate-500 bg-slate-100 p-4 font-mono text-xl leading-relaxed dark:bg-slate-800">
        {suggestion.value}
      </p>
      <StrengthMeter strength={strengthFromBits(suggestion.entropyBits)} />
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => void copy(suggestion.value, 'New password')}>
          Copy new password
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => setSuggestion(suggestPassword(entry))}>
          Make another
        </Button>
      </div>
      <Button variant="secondary" onClick={() => void copy(entry.password, 'Current password')}>
        Copy current password
      </Button>
      <p role="status" className="min-h-6 text-sm">
        {note}
      </p>
      {error && (
        <p role="alert" className="font-medium text-red-800 dark:text-red-300">
          {error}
        </p>
      )}
      <Button disabled={busy} onClick={() => void save()}>
        Save new password
      </Button>
      <Button variant="secondary" disabled={busy} onClick={onCancel}>
        Cancel
      </Button>
    </Screen>
  )
}
