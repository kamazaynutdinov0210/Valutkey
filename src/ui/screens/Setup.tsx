import { useState, type FormEvent } from 'react'
import { session } from '../../vault/instance'
import type { PendingVault } from '../../vault/session'
import { requestPersistence } from '../../pwa/persist'
import { Button } from '../components'
import { describeError } from '../messages'
import { PasswordChoice, usePasswordChoice } from '../PasswordChoice'
import { RecoveryKeyPanel } from '../RecoveryKeyPanel'
import { AuthLayout } from '../shell/AuthLayout'
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
    setBusy(true); setError('')
    try { setPending(await session.prepareVault(choice.password)); choice.reset() }
    catch (e) { setError(describeError(e)) }
    finally { setBusy(false) }
  }

  if (pending) return <AuthLayout title="Save your recovery key" subtitle="This is the only way back in if you forget your master password."><SaveRecoveryKey pending={pending} /></AuthLayout>
  if (restoring) return <AuthLayout title="Restore from a backup" subtitle="Import an encrypted backup to this device."><Restore onBack={() => setRestoring(false)} embedded /></AuthLayout>

  return (
    <AuthLayout title="Welcome to VaultKey" subtitle="Create your local, encrypted vault. No account or server is required.">
      <form onSubmit={create} className="flex flex-col gap-4 transition-opacity duration-200 motion-reduce:transition-none">
        <p className="text-sm text-slate-600 dark:text-slate-300">Choose one master password. It unlocks everything, so make it strong and don’t reuse it. Your passwords are locked on this device.</p>
        <PasswordChoice choice={choice} />
        {error && <p role="alert" className="font-medium text-red-800 dark:text-red-300">{error}</p>}
        <Button type="submit" disabled={!choice.valid || busy} className="w-full">{busy ? 'Creating your vault… this takes a moment' : 'Create my vault'}</Button>
        <hr className="border-slate-200 dark:border-slate-700" />
        <p className="text-sm text-slate-600 dark:text-slate-300">Already use VaultKey on another device, or have a backup file?</p>
        <Button variant="secondary" onClick={() => setRestoring(true)} disabled={busy} className="w-full">I already have a backup file</Button>
      </form>
    </AuthLayout>
  )
}

function SaveRecoveryKey({ pending }: { pending: PendingVault }) {
  return (
    <RecoveryKeyPanel
      recoveryKey={pending.recoveryKey}
      intro={<><p>If you forget your master password, this key is the <strong>only</strong> way back in. Write it on paper or store it somewhere safe that is not on this device. It is shown just once.</p></>}
      confirmLabel="Continue"
      onConfirm={async () => { await session.commitVault(pending); void requestPersistence() }}
    />
  )
}
