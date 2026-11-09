import { useState, type FormEvent } from 'react'
import { session } from '../../vault/instance'
import type { PendingVault } from '../../vault/session'
import { requestPersistence } from '../../pwa/persist'
import { Button } from '../components'
import { describeError } from '../messages'
import { PasswordChoice, usePasswordChoice } from '../PasswordChoice'
import { RecoveryKeyPanel } from '../RecoveryKeyPanel'
import { Restore } from './Restore'

export function Setup() {
  const choice = usePasswordChoice()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<PendingVault | null>(null)
  const [restoring, setRestoring] = useState(false)

  const create = async (event: FormEvent) => {
    event.preventDefault()
    if (!choice.valid || busy) return
    setBusy(true)
    setError('')
    try {
      setPending(await session.prepareVault(choice.password))
      choice.reset() // we no longer need the typed password
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  if (pending) return <SaveRecoveryKey pending={pending} />
  if (restoring) return <Restore onBack={() => setRestoring(false)} />

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-5 px-5 py-10">
      <h1 className="text-3xl font-bold">Welcome to VaultKey</h1>
      <p>
        Choose one master password. It unlocks everything, so make it strong and don’t reuse it. Your passwords are
        locked on this device. We never see them, and we can’t reset this password for you.
      </p>
      <form onSubmit={create} className="flex flex-col gap-5">
        <PasswordChoice choice={choice} />
        {error && (
          <p role="alert" className="font-medium text-red-800 dark:text-red-300">
            {error}
          </p>
        )}
        <Button type="submit" disabled={!choice.valid || busy}>
          {busy ? 'Creating your vault… this takes a moment' : 'Create my vault'}
        </Button>
      </form>
      <hr className="border-slate-300 dark:border-slate-700" />
      <p>Already use VaultKey on another device, or have a backup file?</p>
      <Button variant="secondary" onClick={() => setRestoring(true)} disabled={busy}>
        I already have a backup file
      </Button>
    </main>
  )
}

function SaveRecoveryKey({ pending }: { pending: PendingVault }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-5 px-5 py-10">
      <h1 className="text-3xl font-bold">Save your recovery key</h1>
      <RecoveryKeyPanel
        recoveryKey={pending.recoveryKey}
        intro={
          <>
            If you forget your master password, this key is the <strong>only</strong> way back in. Write it on paper or store it somewhere safe that is not on this
            device. It is shown just once.
          </>
        }
        confirmLabel="Continue"
        onConfirm={async () => {
          await session.commitVault(pending)
          void requestPersistence() // best effort: asks the browser not to clear our data
        }}
      />
    </main>
  )
}
