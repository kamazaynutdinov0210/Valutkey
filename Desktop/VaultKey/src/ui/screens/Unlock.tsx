import { useEffect, useState, type FormEvent } from 'react'
import { DeviceUnlockError, unlockWithDevice } from '../../unlock/device'
import { idbDeviceUnlock, webauthnProvider } from '../../unlock/webauthn'
import { session } from '../../vault/instance'
import { useSessionState } from '../hooks'
import { Button, Field } from '../components'
import { describeError } from '../messages'
import { PasswordChoice, usePasswordChoice } from '../PasswordChoice'

const NO_AUTOFILL = { autoComplete: 'off', autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false } as const

export function Unlock() {
  const [recovering, setRecovering] = useState(false)
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-5 px-5 py-10">
      <h1 className="text-3xl font-bold">VaultKey is locked</h1>
      {recovering ? <Recover onBack={() => setRecovering(false)} /> : <PasswordUnlock onForgot={() => setRecovering(true)} />}
    </main>
  )
}

function deviceMessage(e: unknown): string | null {
  if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'AbortError')) return null // they cancelled
  if (e instanceof DeviceUnlockError && e.code === 'stale') return 'Unlocking with this device isn’t set up for this vault. Use your master password.'
  if (e instanceof DeviceUnlockError && e.code === 'failed') {
    return 'Unlocking with this device isn’t working any more (your passkey may have changed). Use your master password, then turn it off and on again in Settings.'
  }
  return 'Unlocking with this device didn’t work. Use your master password.'
}

function PasswordUnlock({ onForgot }: { onForgot: () => void }) {
  const state = useSessionState()
  const vaultId = state.status === 'locked' ? state.header.vaultId : ''
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [hasDevice, setHasDevice] = useState(false)

  useEffect(() => {
    void idbDeviceUnlock.load().then((record) => setHasDevice(record !== null && record.vaultId === vaultId), () => undefined)
  }, [vaultId])

  const unlockWithThisDevice = async () => {
    setBusy(true)
    setError('')
    try {
      await session.unlockWithKey(await unlockWithDevice({ provider: webauthnProvider, vaultId, store: idbDeviceUnlock }))
    } catch (e) {
      setBusy(false)
      setError(deviceMessage(e) ?? '')
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setError('')
    try {
      await session.unlock(password)
    } catch (e) {
      setError(describeError(e))
      setBusy(false)
      setPassword('')
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {hasDevice && (
        <Button disabled={busy} onClick={() => void unlockWithThisDevice()}>
          Unlock with this device
        </Button>
      )}
      <Field label="Master password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} autoFocus {...NO_AUTOFILL} />
      <Button type="submit" disabled={!password || busy}>
        {busy ? 'Unlocking…' : 'Unlock'}
      </Button>
      <Button variant="secondary" onClick={onForgot} disabled={busy}>
        I forgot my password
      </Button>
    </form>
  )
}

function Recover({ onBack }: { onBack: () => void }) {
  const choice = usePasswordChoice()
  const [recoveryKey, setRecoveryKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!choice.valid || !recoveryKey || busy) return
    setBusy(true)
    setError('')
    try {
      await session.resetWithRecovery(recoveryKey, choice.password)
    } catch (e) {
      setError(describeError(e))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <p>Enter the recovery key you saved when you set up VaultKey, then choose a new master password.</p>
      <Field label="Recovery key" value={recoveryKey} onChange={(e) => setRecoveryKey(e.target.value)} error={error} {...NO_AUTOFILL} />
      <PasswordChoice choice={choice} label="New master password" />
      <Button type="submit" disabled={!choice.valid || !recoveryKey || busy}>
        {busy ? 'Working… this takes a moment' : 'Set new password and unlock'}
      </Button>
      <Button variant="secondary" onClick={onBack} disabled={busy}>
        Back
      </Button>
    </form>
  )
}
