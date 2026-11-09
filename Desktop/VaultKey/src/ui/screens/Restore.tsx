import { useState, type FormEvent } from 'react'
import { argon2Worker } from '../../crypto/argon2Client'
import { requestPersistence } from '../../pwa/persist'
import { parseVaultFile } from '../../sync/file'
import { restoreFromText } from '../../sync/restore'
import { idbSyncState } from '../../sync/target'
import { session } from '../../vault/instance'
import { idbRecordStorage } from '../../vault/storage'
import { Button, Field, Toggle } from '../components'
import { describeError } from '../messages'

const PRIVATE = { autoComplete: 'off', autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false } as const

/** Set up this device from a backup file: for a new device, or after the browser cleared its data. */
export function Restore({ onBack }: { onBack: () => void }) {
  const [text, setText] = useState<string | null>(null)
  const [useRecovery, setUseRecovery] = useState(false)
  const [password, setPassword] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const choose = async (file: File | undefined) => {
    setError('')
    setText(null)
    if (!file) return
    try {
      const content = await file.text()
      parseVaultFile(content) // a quick shape check, so a wrong file is reported straight away
      setText(content)
    } catch (e) {
      setError(describeError(e))
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!text || busy) return
    setBusy(true)
    setError('')
    try {
      await restoreFromText({
        text,
        secret: useRecovery ? { recoveryKey } : { password },
        argon2: argon2Worker,
        records: idbRecordStorage,
        state: idbSyncState,
        session,
      })
      void requestPersistence()
    } catch (e) {
      setError(describeError(e))
      setBusy(false)
      setPassword('')
    }
  }

  const ready = Boolean(text) && (useRecovery ? recoveryKey !== '' : password !== '')
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-5 px-5 py-10">
      <h1 className="text-3xl font-bold">Restore from a backup</h1>
      <p>
        Choose the backup or sync file, then enter the master password you used when it was made. If you have changed your master password since, use your
        recovery key instead.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Field label="Backup file" type="file" accept=".vaultkey,application/json" onChange={(e) => void choose(e.target.files?.[0])} />
        {useRecovery ? (
          <Field label="Recovery key" value={recoveryKey} onChange={(e) => setRecoveryKey(e.target.value)} {...PRIVATE} />
        ) : (
          <Field label="Master password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} {...PRIVATE} />
        )}
        <Toggle label="Use my recovery key instead" checked={useRecovery} onChange={(e) => setUseRecovery(e.target.checked)} />
        {error && (
          <p role="alert" className="font-medium text-red-800 dark:text-red-300">
            {error}
          </p>
        )}
        <Button type="submit" disabled={!ready || busy}>
          {busy ? 'Restoring… this takes a moment' : 'Restore my vault'}
        </Button>
        <Button variant="secondary" onClick={onBack} disabled={busy}>
          Back
        </Button>
      </form>
    </main>
  )
}
