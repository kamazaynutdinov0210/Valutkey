import { describeDue, describeRotation, rotationStatus } from '../../reminders/schedule'
import { safeHttpUrl, type Entry } from '../../vault/entry'
import { checkPasswordBreach } from '../../security/breach'
import { getBreachConsent, setBreachConsent } from '../prefs'
import { secretClipboard } from '../clipboard'
import { Button, Card, Screen, Toggle } from '../components'
import type { VaultApi } from '../useVault'
import { useState, type ReactNode } from 'react'

const date = (ts: number) => new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function Row({ label, children, action }: { label: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-[rgb(var(--vk-border))] pb-3 last:border-0 last:pb-0">
      <span className="text-sm font-medium text-[rgb(var(--vk-text-muted))]">{label}</span>
      <div className="break-all text-base">{children}</div>
      {action && <div className="flex flex-wrap gap-2 pt-1">{action}</div>}
    </div>
  )
}

export function EntryDetail({ vault, entry, onBack, onEdit, onRotate }: { vault: VaultApi; entry: Entry; onBack: () => void; onEdit: () => void; onRotate: () => void }) {
  const [show, setShow] = useState(false)
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [breachBusy, setBreachBusy] = useState(false)
  const [breachConsent, setBreachConsentState] = useState(getBreachConsent)
  const [shownHistory, setShownHistory] = useState<Record<number, boolean>>({})
  const link = safeHttpUrl(entry.url)

  const copy = async (text: string, what: string) => {
    try { await secretClipboard().copy(text); setNote(`${what} copied. It will be cleared from your clipboard in 30 seconds.`) }
    catch { setNote('Couldn’t copy. Select the text and copy it yourself.') }
  }
  const remove = async () => { setBusy(true); try { await vault.remove(entry.id) } catch { setNote('Couldn’t delete this. Please try again.'); setBusy(false) } }
  const duplicate = async () => { setBusy(true); try { const copy = await vault.duplicate(entry.id); setNote(`Duplicated as “${copy.title}”.`) } catch { setNote('Couldn’t duplicate this. Please try again.') } finally { setBusy(false) } }
  const checkBreach = async () => {
    if (!breachConsent) { setNote('Turn on breach checking first. It is optional and privacy-preserving.'); return }
    setBreachBusy(true); setNote('Checking breach status…')
    try {
      const r = await checkPasswordBreach(entry.password)
      if (!r.checked) setNote(r.reason === 'offline' ? 'No internet connection. Breach check is unavailable offline.' : 'Breach check failed. Try again later.')
      else if (r.breached) setNote(`This password appears in known data breaches (${r.count.toLocaleString()} times). Change it.`)
      else setNote('This password was not found in the checked breach dataset. That does not guarantee it is safe.')
    } finally { setBreachBusy(false) }
  }
  const restoreHistory = async (index: number) => {
    if (!window.confirm('Restore this previous password? The current password will be saved to history.')) return
    setBusy(true)
    try { await vault.restoreHistory(entry.id, index); setNote('Previous password restored and re-encrypted.') }
    catch { setNote('Could not restore that password version.') }
    finally { setBusy(false) }
  }

  return (
    <Screen title={entry.title}>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onBack}>Back to vault</Button>
        <Button variant="secondary" onClick={() => void vault.toggleFavorite(entry.id)} aria-pressed={Boolean(entry.favorite)}>{entry.favorite ? '★ Favorite' : '☆ Favorite'}</Button>
      </div>

      <Card className="gap-4">
        {entry.username && <Row label="Username" action={<Button variant="secondary" onClick={() => void copy(entry.username, 'Username')}>Copy username</Button>}>{entry.username}</Row>}
        <Row label="Password" action={<><Button variant="secondary" aria-pressed={show} onClick={() => setShow(!show)}>{show ? 'Hide password' : 'Show password'}</Button><Button onClick={() => void copy(entry.password, 'Password')}>Copy password</Button><Button variant="secondary" disabled={breachBusy} onClick={() => void checkBreach()}>{breachBusy ? 'Checking…' : 'Check breach'}</Button></>}>
          <span data-testid="password-value" className="font-mono text-lg">{show ? entry.password : '••••••••••'}</span>
        </Row>
        <details className="rounded-xl border border-[rgb(var(--vk-border))] bg-[rgb(var(--vk-surface-2))] p-3 text-sm">
          <summary className="cursor-pointer font-medium">Breach check (optional)</summary>
          <p className="pt-2 text-[rgb(var(--vk-text-muted))]">Uses k-anonymity: only the first 5 characters of a SHA-1 hash are sent. Your password is never sent. SHA-1 is used only for this lookup protocol, not for vault encryption. No lookup runs without your consent.</p>
          <div className="pt-2"><Toggle label="Allow breach checking" checked={breachConsent} onChange={(e) => { setBreachConsent(e.target.checked); setBreachConsentState(e.target.checked) }} /></div>
        </details>
        {entry.url && <Row label="Website">{link ? <a href={link} target="_blank" rel="noopener noreferrer" className="text-[rgb(var(--vk-accent))] underline underline-offset-2">{entry.url}</a> : entry.url}</Row>}
        {entry.category && <Row label="Category">{entry.category}</Row>}
        {entry.notes && <Row label="Notes"><span className="whitespace-pre-wrap text-base">{entry.notes}</span></Row>}
        {entry.tags.length > 0 && <Row label="Tags"><span className="flex flex-wrap gap-1">{entry.tags.map((t) => <span key={t} className="rounded-full bg-[rgb(var(--vk-surface-2))] px-2.5 py-0.5 text-sm">{t}</span>)}</span></Row>}
        {entry.rotation && <Row label="Reminder" action={<Button variant="secondary" onClick={onRotate}>Change password</Button>}><span className="text-base">Change it {describeRotation(entry.rotation)}. {describeDue(rotationStatus(entry.rotation, Date.now()))}.</span></Row>}
      </Card>

      {entry.history.length > 0 && (
        <Card title={`Password history (${entry.history.length})`}>
          <p className="text-sm font-medium">{entry.history.length === 1 ? '1 earlier password is kept.' : `${entry.history.length} earlier passwords are kept.`}</p>
          <p className="text-sm text-[rgb(var(--vk-text-muted))]">Previous versions are encrypted. Restoring saves the current password to history and re-encrypts the entry.</p>
          <ul className="flex flex-col gap-2">
            {entry.history.map((h, i) => (
              <li key={`${h.replacedAt}-${i}`} className="rounded-xl border border-[rgb(var(--vk-border))] bg-[rgb(var(--vk-surface-2))] p-3 text-sm">
                <p className="font-medium">Replaced {date(h.replacedAt)} <span className="font-normal text-[rgb(var(--vk-text-muted))]">({h.reason})</span></p>
                <p className="mt-1 font-mono break-all">{shownHistory[i] ? h.password : '••••••••••'}</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="secondary" onClick={() => setShownHistory((s) => ({ ...s, [i]: !s[i] }))}>{shownHistory[i] ? 'Hide' : 'Reveal'}</Button>
                  <Button variant="secondary" onClick={() => void copy(h.password, 'Historical password')}>Copy</Button>
                  <Button variant="secondary" disabled={busy} onClick={() => void restoreHistory(i)}>Restore</Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-sm text-[rgb(var(--vk-text-muted))]">Saved {date(entry.createdAt)}. Last changed {date(entry.updatedAt)}{entry.lastAccessedAt ? `. Last used ${date(entry.lastAccessedAt)}.` : '.'}</p>
      <p role="status" aria-live="polite" className="min-h-6 text-sm">{note}</p>

      {confirming ? (
        <div role="alertdialog" aria-label="Delete password" className="flex flex-col gap-3 rounded-2xl border border-red-700 bg-red-50 p-4 dark:border-red-400 dark:bg-red-950/20">
          <p className="font-medium">Delete “{entry.title}”? This can’t be undone.</p>
          <div className="flex gap-2">
            <Button variant="danger" disabled={busy} onClick={() => void remove()} className="flex-1">Yes, delete</Button>
            <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)} className="flex-1">Keep it</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={onEdit} className="flex-1">Edit</Button>
          <Button variant="secondary" onClick={() => void duplicate()} disabled={busy} className="flex-1">Duplicate</Button>
          <Button variant="secondary" onClick={() => setConfirming(true)} className="flex-1">Delete</Button>
        </div>
      )}
    </Screen>
  )
}
