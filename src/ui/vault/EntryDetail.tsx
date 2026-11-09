import { useState, type ReactNode } from 'react'
import { describeDue, describeRotation, rotationStatus } from '../../reminders/schedule'
import { safeHttpUrl, type Entry } from '../../vault/entry'
import { secretClipboard } from '../clipboard'
import { Button, Screen } from '../components'
import type { VaultApi } from '../useVault'

const date = (ts: number) => new Date(ts).toLocaleDateString(undefined, { dateStyle: 'medium' })

function Row({ label, children, action }: { label: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-300 pb-3 dark:border-slate-700">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <div className="break-all text-lg">{children}</div>
      {action && <div className="flex gap-2 pt-1">{action}</div>}
    </div>
  )
}

export function EntryDetail({ vault, entry, onBack, onEdit, onRotate }: { vault: VaultApi; entry: Entry; onBack: () => void; onEdit: () => void; onRotate: () => void }) {
  const [show, setShow] = useState(false)
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(false)
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
  const remove = async () => {
    setBusy(true)
    try {
      await vault.remove(entry.id)
    } catch {
      setNote('Couldn’t delete this. Please try again.')
      setBusy(false)
    }
  }

  return (
    <Screen title={entry.title}>
      <Button variant="secondary" onClick={onBack} className="self-start">
        Back to vault
      </Button>

      {entry.username && (
        <Row
          label="Username"
          action={
            <Button variant="secondary" onClick={() => void copy(entry.username, 'Username')}>
              Copy username
            </Button>
          }
        >
          {entry.username}
        </Row>
      )}

      <Row
        label="Password"
        action={
          <>
            <Button variant="secondary" aria-pressed={show} onClick={() => setShow(!show)}>
              {show ? 'Hide password' : 'Show password'}
            </Button>
            <Button onClick={() => void copy(entry.password, 'Password')}>Copy password</Button>
          </>
        }
      >
        <span data-testid="password-value" className="font-mono">
          {show ? entry.password : '••••••••••'}
        </span>
      </Row>

      {entry.url && (
        <Row label="Website">
          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-800 underline dark:text-blue-300">
              {entry.url}
            </a>
          ) : (
            entry.url
          )}
        </Row>
      )}
      {entry.notes && (
        <Row label="Notes">
          <span className="whitespace-pre-wrap text-base">{entry.notes}</span>
        </Row>
      )}
      {entry.tags.length > 0 && <Row label="Tags">{entry.tags.join(', ')}</Row>}
      {entry.rotation && (
        <Row
          label="Reminder"
          action={
            <Button variant="secondary" onClick={onRotate}>
              Change password
            </Button>
          }
        >
          <span className="text-base">
            Change it {describeRotation(entry.rotation)}. {describeDue(rotationStatus(entry.rotation, Date.now()))}.
          </span>
        </Row>
      )}

      <p className="text-sm text-slate-700 dark:text-slate-300">
        Saved {date(entry.createdAt)}. Last changed {date(entry.updatedAt)}.
        {entry.history.length > 0 && ` ${entry.history.length} earlier ${entry.history.length === 1 ? 'password is' : 'passwords are'} kept.`}
      </p>
      <p role="status" className="min-h-6 text-sm">
        {note}
      </p>

      {confirming ? (
        <div className="flex flex-col gap-3 rounded-xl border border-red-800 p-4 dark:border-red-300">
          <p className="font-medium">Delete “{entry.title}”? This can’t be undone.</p>
          <div className="flex gap-2">
            <Button variant="danger" disabled={busy} onClick={() => void remove()} className="flex-1">
              Yes, delete
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)} className="flex-1">
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button onClick={onEdit} className="flex-1">
            Edit
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(true)} className="flex-1">
            Delete
          </Button>
        </div>
      )}
    </Screen>
  )
}
