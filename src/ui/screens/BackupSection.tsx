import { useEffect, useState } from 'react'
import { todayKey } from '../../reminders/notify'
import { describeMerge } from '../../sync/merge'
import type { MergeOutcome, SyncService } from '../../sync/service'
import { chooseSyncFile, folderSyncSupported, forgetSyncFile, openSyncTarget, syncFileName } from '../../sync/target'
import { recordActivity } from '../../security/activityStore'
import { Button, Card } from '../components'
import { saveTextFile } from '../download'
import { describeError } from '../messages'

type Retry = { kind: 'file'; text: string } | { kind: 'sync' }

function guidance(): string {
  return typeof navigator !== 'undefined' && navigator.onLine === false
    ? 'You appear to be offline. Backups still work locally, but cloud sync needs a connection and the cloud service to finish uploading before another device syncs.'
    : ''
}

export function BackupSection({ sync, onChanged, vaultKey, vaultId }: { sync: SyncService | null; onChanged: () => Promise<void>; vaultKey?: CryptoKey; vaultId?: string }) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [older, setOlder] = useState<Retry | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const canFolderSync = folderSyncSupported()
  const isBusy = busy !== ''

  useEffect(() => {
    if (canFolderSync) void syncFileName().then(setFileName)
  }, [canFolderSync])

  const run = async (label: string, job: () => Promise<void>) => {
    setBusy(label)
    setError('')
    setMessage('')
    try {
      await job()
    } catch (e) {
      if (e instanceof Error && e.message === 'no-access') {
        setError('VaultKey doesn’t have permission to use the sync file. Choose it again to grant access.')
        return
      }
      const msg = describeError(e)
      const hint = guidance()
      setError(hint ? `${msg} ${hint}` : msg)
    } finally {
      setBusy('')
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
    if (outcome.damaged > 0) text += ` ${outcome.damaged} item${outcome.damaged === 1 ? '' : 's'} in the file couldn’t be read and ${outcome.damaged === 1 ? 'was' : 'were'} left as they are. Restore a known-good backup if important data is missing.`
    if (!outcome.changedHere && outcome.damaged === 0) text += ' This device and the file are in sync.'
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
    run('Saving backup…', async () => {
      if (!sync) return
      saveTextFile(`vaultkey-backup-${todayKey()}.vaultkey`, await sync.exportFile())
      void recordActivity('backup-created', undefined, vaultKey, vaultId)
      setMessage('Backup saved. Keep it somewhere private: anyone who gets it can try to guess your master password.')
    })

  const mergeFile = (file: File) =>
    run('Merging backup…', async () => {
      if (!sync) return
      const text = await file.text()
      await report(await sync.mergeText(text), { kind: 'file', text })
      void recordActivity('backup-restored', file.name ? `Merged ${file.name}` : undefined, vaultKey, vaultId)
    })

  const chooseFile = () =>
    run('Setting up sync…', async () => {
      if (!sync) return
      const name = await chooseSyncFile()
      if (!name) return
      setFileName(name)
      try {
        await runRetry({ kind: 'sync' }, false)
      } catch (e) {
        await forgetSyncFile().catch(() => undefined) // do not stay attached to a file that is not ours
        setFileName(await syncFileName())
        throw e
      }
    })

  const syncNow = () =>
    run('Syncing…', async () => {
      await runRetry({ kind: 'sync' }, false)
    })

  const stop = () =>
    run('Stopping sync…', async () => {
      await forgetSyncFile()
      setFileName(null)
      setMessage('Sync stopped. The file itself was not deleted.')
    })

  const confirmOlder = () => {
    const retry = older
    setOlder(null)
    if (retry) void run('Merging older copy…', async () => void (await runRetry(retry, true)))
  }

  return (
    <Card title="Backup and sync" className="gap-3">
      <p className="text-sm text-[rgb(var(--vk-text-muted))]">
        A backup file holds your passwords locked with your master password and recovery key. Keep copies somewhere you trust, such as a cloud drive. Anyone who
        gets the file can try to guess your master password, so keep it private.
      </p>
      <div className="rounded-xl border border-[rgb(var(--vk-border))] bg-[rgb(var(--vk-surface-2))] p-3 text-sm text-[rgb(var(--vk-text))]" role="note">
        <p className="font-medium">Reliability tips</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Create backups regularly and keep at least one offline copy.</li>
          <li>Sync one device at a time and let your cloud service finish uploading before syncing another device.</li>
          <li>If a merge reports damaged or conflicting items, keep the backup file and restore a known-good copy if needed.</li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={isBusy || !sync} onClick={() => void saveBackup()}>Save a backup file</Button>
        <label className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-[rgb(var(--vk-border))] bg-[rgb(var(--vk-surface))] px-5 py-2 text-center text-base font-semibold text-[rgb(var(--vk-text))] shadow-sm transition-colors hover:bg-[rgb(var(--vk-surface-2))] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[rgb(var(--vk-accent))] ${isBusy || !sync ? 'pointer-events-none opacity-50' : ''}`}>
          Choose a backup file to merge
          <input type="file" accept=".vaultkey,application/json" className="sr-only" disabled={isBusy || !sync}
            onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void mergeFile(file) }} />
        </label>
      </div>

      <div className="rounded-xl border border-[rgb(var(--vk-border))] bg-[rgb(var(--vk-surface-2))] p-3">
        <h3 className="font-semibold">Keep devices in sync</h3>
        {canFolderSync ? (
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-sm text-[rgb(var(--vk-text-muted))]">Choose a file inside your cloud folder (Dropbox, OneDrive, iCloud Drive, Google Drive). VaultKey merges it with this device and writes the result back. Your cloud service only ever sees locked data. Sync one device at a time and let the cloud finish uploading before you sync another.</p>
            <p className="text-sm"><span className="font-medium">Sync file:</span> {fileName ?? 'No sync file chosen.'}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={isBusy || !sync} onClick={() => void chooseFile()}>{fileName ? 'Choose a different file' : 'Choose sync file'}</Button>
              {fileName && (<><Button disabled={isBusy || !sync} onClick={() => void syncNow()}>Sync now</Button><Button variant="secondary" disabled={isBusy} onClick={() => void stop()}>Stop syncing</Button></>)}
            </div>
            {fileName && <p className="text-xs text-[rgb(var(--vk-text-muted))]">If your browser asks for file permission again, allow it so VaultKey can read and update the same sync file safely.</p>}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[rgb(var(--vk-text-muted))]">This browser can’t keep a cloud-folder file in sync by itself. Instead, save a backup file into your cloud folder now and then, and on another device choose it under “Choose a backup file to merge”.</p>
        )}
      </div>

      {older && (
        <div role="alertdialog" aria-label="Older copy" aria-describedby="older-copy-desc" className="flex flex-col gap-3 rounded-xl border border-amber-800 bg-amber-50 p-4 text-amber-950 dark:border-amber-300 dark:bg-[rgb(var(--vk-surface))] dark:text-amber-100">
          <p id="older-copy-desc" className="font-medium">This copy is older than one this device has already seen. That can happen if a cloud service restored an old version, if the file was replaced, or if you picked an old backup. Merging it will not remove anything newer, but you should only continue if you trust this file.</p>
          <div className="flex flex-wrap gap-2"><Button className="flex-1" disabled={isBusy} onClick={confirmOlder}>Merge anyway</Button><Button variant="secondary" className="flex-1" disabled={isBusy} onClick={() => setOlder(null)}>Cancel</Button></div>
        </div>
      )}
      {busy && <p role="status" aria-live="polite" className="text-sm font-medium text-[rgb(var(--vk-text-muted))]">{busy}</p>}
      <p role="status" aria-live="polite" className="min-h-5 text-sm">{message}</p>
      {error && <p role="alert" className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>}
    </Card>
  )
}

