import { useState, type ReactNode } from 'react'
import { secretClipboard } from './clipboard'
import { Button, Toggle } from './components'
import { describeError } from './messages'

/** Shows a recovery key once and only continues after the person confirms they stored it. */
export function RecoveryKeyPanel({ recoveryKey, intro, confirmLabel, onConfirm }: { recoveryKey: string; intro: ReactNode; confirmLabel: string; onConfirm: () => Promise<void> }) {
  const [saved, setSaved] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const copy = async () => {
    try {
      await secretClipboard().copy(recoveryKey)
      setNote('Copied. Paste it somewhere safe now. It will be cleared from your clipboard in 30 seconds.')
    } catch {
      setNote('Couldn’t copy. Please write the key down instead.')
    }
  }
  const finish = async () => {
    setBusy(true)
    try {
      await secretClipboard().clearNow()
      await onConfirm()
    } catch (e) {
      setNote(describeError(e))
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p>{intro}</p>
      <p
        data-testid="recovery-key"
        className="select-all break-all rounded-xl border border-slate-500 bg-slate-100 p-4 font-mono text-xl leading-relaxed dark:bg-slate-800"
      >
        {recoveryKey}
      </p>
      <Button variant="secondary" onClick={() => void copy()}>
        Copy recovery key
      </Button>
      <p role="status" className="text-sm">
        {note}
      </p>
      <Toggle label="I saved my recovery key in a safe place" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
      <Button disabled={!saved || busy} onClick={() => void finish()}>
        {busy ? 'Working…' : confirmLabel}
      </Button>
    </div>
  )
}
