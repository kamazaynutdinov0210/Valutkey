import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { argon2Worker } from '../../crypto/argon2Client'
import { CryptoError } from '../../crypto/errors'
import { wipe } from '../../crypto/ct'
import { rotateVaultKey } from '../../crypto/rotate'
import type { VaultHeader } from '../../crypto/types'
import { changeMasterPassword, rotateRecoveryKey, unwrapVaultKeyBytes } from '../../crypto/wrap'
import { replaceFromText } from '../../sync/restore'
import { forgetSyncFile, idbSyncState } from '../../sync/target'
import { clearDeviceUnlock, DeviceUnlockError, enrollDeviceUnlock } from '../../unlock/device'
import { idbDeviceUnlock, webauthnProvider } from '../../unlock/webauthn'
import { session } from '../../vault/instance'
import { idbRecordStorage, writeMeta } from '../../vault/storage'
import { Button, Field, Toggle } from '../components'
import { useSessionState } from '../hooks'
import { describeError } from '../messages'
import { PasswordChoice, usePasswordChoice } from '../PasswordChoice'
import { RecoveryKeyPanel } from '../RecoveryKeyPanel'

type Flow = 'password' | 'recovery' | 'vaultkey' | 'device' | 'replace'
interface Pending {
  title: string
  recoveryKey: string
  intro: ReactNode
  confirmLabel: string
  commit: () => Promise<void>
}
const PRIVATE = { autoComplete: 'off', autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false } as const

function useAction(explain?: (e: unknown) => string | undefined) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async (job: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await job()
    } catch (e) {
      setError(explain?.(e) ?? describeError(e))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}

function Panel({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-400 dark:border-slate-600">
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-h-11 w-full items-center justify-between px-4 text-left font-semibold">
        {title}
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>}
    </div>
  )
}

const Problem = ({ text }: { text: string }) =>
  text ? (
    <p role="alert" className="text-sm font-medium text-red-800 dark:text-red-300">
      {text}
    </p>
  ) : null

export function SecuritySection() {
  const state = useSessionState()
  const [open, setOpen] = useState<Flow | null>(null)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)
  const [deviceOn, setDeviceOn] = useState(false)
  const [deviceAvailable, setDeviceAvailable] = useState(false)

  useEffect(() => {
    void idbDeviceUnlock.load().then((r) => setDeviceOn(r !== null), () => undefined)
    void webauthnProvider.isAvailable().then(setDeviceAvailable)
  }, [])

  if (state.status !== 'unlocked') return null
  const header = state.header
  const done = (text: string) => {
    setOpen(null)
    setPending(null)
    setMessage(text)
  }
  const toggle = (flow: Flow) => () => {
    setMessage('')
    setOpen(open === flow ? null : flow)
  }

  if (pending) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{pending.title}</h2>
        <RecoveryKeyPanel recoveryKey={pending.recoveryKey} intro={pending.intro} confirmLabel={pending.confirmLabel} onConfirm={pending.commit} />
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Security</h2>
      <Panel title="Change master password" open={open === 'password'} onToggle={toggle('password')}>
        <ChangePassword header={header} onDone={done} />
      </Panel>
      <Panel title="Make a new recovery key" open={open === 'recovery'} onToggle={toggle('recovery')}>
        <NewRecoveryKey header={header} onPending={setPending} onDone={done} />
      </Panel>
      <Panel title="Unlock with fingerprint, face or device PIN" open={open === 'device'} onToggle={toggle('device')}>
        <DeviceUnlock header={header} available={deviceAvailable} on={deviceOn} onChange={setDeviceOn} />
      </Panel>
      <Panel title="Make a new vault key (advanced)" open={open === 'vaultkey'} onToggle={toggle('vaultkey')}>
        <NewVaultKey header={header} onPending={setPending} onDone={(t) => { setDeviceOn(false); done(t) }} />
      </Panel>
      <Panel title="Replace this vault with a backup file" open={open === 'replace'} onToggle={toggle('replace')}>
        <ReplaceVault onDone={(t) => { setDeviceOn(false); done(t) }} />
      </Panel>
      <p role="status" className="text-sm">
        {message}
      </p>
    </section>
  )
}

function ChangePassword({ header, onDone }: { header: VaultHeader; onDone: (text: string) => void }) {
  const [current, setCurrent] = useState('')
  const choice = usePasswordChoice()
  const { busy, error, run } = useAction()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!choice.valid || !current || busy) return
    void run(async () => {
      await session.replaceHeader(await changeMasterPassword(argon2Worker, header, current, choice.password))
      choice.reset()
      onDone('Master password changed. If you sync, your other devices will ask for the new password after their next sync.')
    })
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Current master password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} {...PRIVATE} />
      <PasswordChoice choice={choice} label="New master password" />
      <Problem text={error} />
      <Button type="submit" disabled={!choice.valid || !current || busy}>
        {busy ? 'Working… this takes a moment' : 'Save new master password'}
      </Button>
    </form>
  )
}

function NewRecoveryKey({ header, onPending, onDone }: { header: VaultHeader; onPending: (p: Pending) => void; onDone: (text: string) => void }) {
  const [current, setCurrent] = useState('')
  const { busy, error, run } = useAction()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!current || busy) return
    void run(async () => {
      const next = await rotateRecoveryKey(argon2Worker, header, current)
      setCurrent('')
      onPending({
        title: 'Save your new recovery key',
        recoveryKey: next.recoveryKey,
        intro: 'This replaces your old recovery key, which stops working once you continue. Store the new one somewhere safe. It is shown just once.',
        confirmLabel: 'Use this recovery key',
        commit: async () => {
          await session.replaceHeader(next.header) // only saved after the person confirmed they stored it
          onDone('New recovery key saved. The old one no longer works.')
        },
      })
    })
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm">Use this if your recovery key was lost or seen by someone else. Your passwords and master password stay the same.</p>
      <Field label="Current master password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} {...PRIVATE} />
      <Problem text={error} />
      <Button type="submit" disabled={!current || busy}>
        {busy ? 'Working… this takes a moment' : 'Create new recovery key'}
      </Button>
    </form>
  )
}

function NewVaultKey({ header, onPending, onDone }: { header: VaultHeader; onPending: (p: Pending) => void; onDone: (text: string) => void }) {
  const [current, setCurrent] = useState('')
  const [understood, setUnderstood] = useState(false)
  const { busy, error, run } = useAction((e) =>
    e instanceof CryptoError && e.code === 'corrupt'
      ? 'Some saved items can’t be read, so VaultKey won’t make a new key (it would lose them). Restore from a backup first.'
      : undefined,
  )
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!current || !understood || busy) return
    void run(async () => {
      const next = await rotateVaultKey(argon2Worker, header, current, await idbRecordStorage.all())
      setCurrent('')
      onPending({
        title: 'Save your new recovery key',
        recoveryKey: next.recoveryKey,
        intro: 'Your passwords are now locked with a brand-new vault key, and this is its recovery key. The old recovery key stops working. It is shown just once.',
        confirmLabel: 'Finish',
        commit: async () => {
          await session.replaceVault({ header: next.header, vaultKey: next.vaultKey, records: next.records })
          await clearDeviceUnlock(idbDeviceUnlock) // it was tied to the old key
          await forgetSyncFile().catch(() => undefined)
          await writeMeta('syncState', null).catch(() => undefined) // a new vault starts a new sync history
          onDone('New vault key made. Delete your old backup and sync files, and use “Replace this vault with a backup file” on your other devices.')
        },
      })
    })
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm">
        Do this if you think your old master password was seen by someone who also has a copy of your data (for example a backup file). Changing the master
        password alone does not protect against that, because it does not change the key that locks your passwords. This makes a new key and locks everything again
        with it.
      </p>
      <p className="text-sm font-medium">
        Your other devices, backup files and sync file still hold the old vault. After this, delete them, and set your other devices up again from a new backup.
      </p>
      <Field label="Current master password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} {...PRIVATE} />
      <Toggle label="I understand my other devices and old backups will stop working with this vault" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
      <Problem text={error} />
      <Button type="submit" disabled={!current || !understood || busy}>
        {busy ? 'Working… this takes a moment' : 'Create new vault key'}
      </Button>
    </form>
  )
}

function DeviceUnlock({ header, available, on, onChange }: { header: VaultHeader; available: boolean; on: boolean; onChange: (on: boolean) => void }) {
  const [current, setCurrent] = useState('')
  const { busy, error, run } = useAction((e) => {
    if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'AbortError')) return 'Cancelled. Nothing was changed.'
    if (e instanceof DeviceUnlockError && e.code === 'unsupported') return 'This device or browser can’t do this. It needs passkey support.'
    return undefined
  })

  if (!available) return <p className="text-sm">Not available on this device or browser.</p>
  if (on) {
    return (
      <>
        <p>Unlocking with this device is on. Your master password still works too.</p>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await clearDeviceUnlock(idbDeviceUnlock)
              onChange(false)
            })
          }
        >
          Turn off
        </Button>
        <Problem text={error} />
      </>
    )
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!current || busy) return
    void run(async () => {
      const keyBytes = await unwrapVaultKeyBytes(argon2Worker, header, current) // proves the master password
      try {
        await enrollDeviceUnlock({ provider: webauthnProvider, vaultKeyBytes: keyBytes, vaultId: header.vaultId, store: idbDeviceUnlock })
      } finally {
        wipe(keyBytes)
      }
      setCurrent('')
      onChange(true)
    })
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm">
        Unlock quickly with your fingerprint, face or device PIN instead of typing the master password. It is only as strong as your device’s lock screen, and it
        works on this device only. Your master password always still works.
      </p>
      <Field label="Current master password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} {...PRIVATE} />
      <Problem text={error} />
      <Button type="submit" disabled={!current || busy}>
        {busy ? 'Working…' : 'Turn on'}
      </Button>
    </form>
  )
}

function ReplaceVault({ onDone }: { onDone: (text: string) => void }) {
  const [text, setText] = useState<string | null>(null)
  const [useRecovery, setUseRecovery] = useState(false)
  const [password, setPassword] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [understood, setUnderstood] = useState(false)
  const { busy, error, run } = useAction()
  const ready = Boolean(text) && understood && (useRecovery ? recoveryKey !== '' : password !== '')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!ready || !text || busy) return
    void run(async () => {
      await replaceFromText({
        text,
        secret: useRecovery ? { recoveryKey } : { password },
        argon2: argon2Worker,
        state: idbSyncState,
        session,
        afterReplace: () => clearDeviceUnlock(idbDeviceUnlock),
      })
      onDone('This device now has the vault from the file.')
    })
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm">
        Use this on a device whose vault is out of date, for example after you made a new vault key on another device. <strong>Everything on this device that is not
        in the file will be lost.</strong>
      </p>
      <Field
        label="Backup file to use"
        type="file"
        accept=".vaultkey,application/json"
        onChange={(e) => {
          const file = e.target.files?.[0]
          void (file ? file.text() : Promise.resolve(null)).then(setText)
        }}
      />
      {useRecovery ? (
        <Field label="Recovery key of that file" value={recoveryKey} onChange={(e) => setRecoveryKey(e.target.value)} {...PRIVATE} />
      ) : (
        <Field label="Master password of that file" type="password" value={password} onChange={(e) => setPassword(e.target.value)} {...PRIVATE} />
      )}
      <Toggle label="Use the recovery key instead" checked={useRecovery} onChange={(e) => setUseRecovery(e.target.checked)} />
      <Toggle label="I understand this replaces everything on this device" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
      <Problem text={error} />
      <Button variant="danger" type="submit" disabled={!ready || busy}>
        {busy ? 'Working… this takes a moment' : 'Replace this vault'}
      </Button>
    </form>
  )
}
