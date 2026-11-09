import { useEffect, useState } from 'react'
import { todayKey } from '../../reminders/notify'
import { describeMerge } from '../../sync/merge'
import type { MergeOutcome, SyncService } from '../../sync/service'
import { chooseSyncFile, folderSyncSupported, forgetSyncFile, openSyncTarget, syncFileName } from '../../sync/target'
import { Button } from '../components'
import { saveTextFile } from '../download'
import { describeError } from '../messages'

type Retry = { kind: 'file'; text: string } | { kind: 'sync' }

export function BackupSection({ sync, onChanged }: { sync: SyncService | null; onChanged: () => Promise<void> }) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [older, setOlder] = useState<Retry | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const canFolderSync = folderSyncSupported()

  useEffect(() => {
    if (canFolderSync) void syncFileName().then(setFileName)
  }, [canFolderSync])

  const run = async (job: () => Promise<void>) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await job()
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  const report = async (outcome: MergeOutcome, retry: Retry) => {
    if (outcome.status === 'older') {
      setOlder(retry)
      return
    }
    setOlder(null)
    if (outcome.changedHere) await onChanged()
    let text = describeMerge(outcome.stats)
    if (outcome.headerAdopted) text += ' Your master password was changed on another device. Use the new one next time you unlock.'
    if (outcome.damaged > 0) text += ` ${outcome.damaged} item${outcome.damaged === 1 ? '' : 's'} in the file couldn’t be read and ${outcome.damaged === 1 ? 'was' : 'were'} left as they are.`
    setMessage(text)
  }

  const runRetry = async (retry: Retry, acceptOlder: boolean) => {
    if (!sync) return
    if (retry.kind === 'file') return report(await sync.mergeText(retry.text, { acceptOlder }), retry)
    const target = await openSyncTarget(true)
    if (!target) throw new Error('no-access')
    return report(await sync.syncWith(target, { acceptOlder }), retry)
  }

  const saveBackup = () =>
    run(async () => {
      if (!sync) return
      saveTextFile(`vaultkey-backup-${todayKey()}.vaultkey`, await sync.exportFile())
      setMessage('Backup saved. Keep it somewhere private: anyone who gets it can try to guess your master password.')
    })

  const mergeFile = (file: File) =>
    run(async () => {
      if (!sync) return
      const text = await file.text()
      await report(await sync.mergeText(text), { kind: 'file', text })
    })

  const chooseFile = () =>
    run(async () => {
      if (!sync) return
      const name = await chooseSyncFile()
      if (!name) return
      setFileName(name)
      try {
        await runRetry({ kind: 'sync' }, false)
      } catch (e) {
        await forgetSyncFile() // do not stay attached to a file that is not ours
        setFileName(null)
        throw e
      }
    })

  const syncNow = () =>
    run(async () => {
      try {
        await runRetry({ kind: 'sync' }, false)
      } catch (e) {
        if (e instanceof Error && e.message === 'no-access') {
          setError('VaultKey doesn’t have permission to use the sync file. Choose it again.')
          return
        }
        throw e
      }
    })

  const stop = () =>
    run(async () => {
      await forgetSyncFile()
      setFileName(null)
      setMessage('Sync stopped. The file itself was not deleted.')
    })

  const confirmOlder = () => {
    const retry = older
    setOlder(null)
    if (retry) void run(async () => void (await runRetry(retry, true)))
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Backup and sync</h2>
      <p className="text-sm text-slate-700 dark:text-slate-300">
        A backup file holds your passwords locked with your master password and recovery key. Keep copies somewhere you trust, such as a cloud drive. Anyone who
        gets the file can try to guess your master password, so keep it private.
      </p>

      <Button variant="secondary" disabled={busy || !sync} onClick={() => void saveBackup()}>
        Save a backup file
      </Button>
      <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-slate-400 px-5 py-2 text-center text-base font-semibold focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-700 dark:border-slate-500">
        Choose a backup file to merge
        <input
          type="file"
          accept=".vaultkey,application/json"
          className="sr-only"
          disabled={busy || !sync}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void mergeFile(file)
          }}
        />
      </label>

      <h3 className="pt-2 font-semibold">Keep devices in sync</h3>
      {canFolderSync ? (
        <>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Choose a file inside your cloud folder (Dropbox, OneDrive, iCloud Drive, Google Drive). VaultKey merges it with this device and writes the result back.
            Your cloud service only ever sees locked data. Sync one device at a time and let the cloud finish uploading before you sync another.
          </p>
          <p>{fileName ? `Sync file: ${fileName}` : 'No sync file chosen.'}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy || !sync} onClick={() => void chooseFile()}>
              {fileName ? 'Choose a different file' : 'Choose sync file'}
            </Button>
            {fileName && (
              <>
                <Button disabled={busy || !sync} onClick={() => void syncNow()}>
                  Sync now
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => void stop()}>
                  Stop syncing
                </Button>
              </>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-700 dark:text-slate-300">
          This browser can’t keep a cloud-folder file in sync by itself. Instead, save a backup file into your cloud folder now and then, and on another device
          choose it under “Choose a backup file to merge”.
        </p>
      )}

      {older && (
        <div role="alertdialog" aria-label="Older copy" className="flex flex-col gap-3 rounded-xl border border-amber-800 bg-amber-50 p-4 text-amber-950 dark:border-amber-300 dark:bg-slate-800 dark:text-amber-100">
          <p className="font-medium">
            This copy is older than one this device has already seen. That can happen if a cloud service restored an old version, if the file was replaced, or if you
            picked an old backup. Merging it will not remove anything newer. Merge it anyway?
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={confirmOlder}>
              Merge anyway
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setOlder(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <p role="status" className="text-sm">
        {message}
      </p>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-800 dark:text-red-300">
          {error}
        </p>
      )}
    </section>
  )
}
