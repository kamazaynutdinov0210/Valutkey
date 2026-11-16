import { useEffect, useState } from 'react'
import { readActivity } from '../../security/activityStore'
import type { SecurityEvent } from '../../security/activity'
import { Card } from '../components'

const LABELS: Record<string, string> = {
  'vault-created':'Vault created','unlock-success':'Unlocked','unlock-failed':'Unlock failed','vault-locked':'Locked',
  'password-changed':'Master password changed','recovery-rotated':'Recovery key rotated','backup-created':'Backup exported',
  'backup-restored':'Backup restored','device-unlock-enabled':'Device unlock enabled','device-unlock-disabled':'Device unlock disabled',
  'vault-key-rotated':'Vault key rotated','entry-created':'Entry created','entry-updated':'Entry updated','entry-deleted':'Entry deleted',
  'rotation-confirmed':'Password rotation confirmed','import-completed':'Import completed',
}

export function ActivitySection({ vaultKey, vaultId }: { vaultKey?: CryptoKey; vaultId?: string }) {
  const [events, setEvents] = useState<SecurityEvent[]>([])
  useEffect(() => { void readActivity(vaultKey, vaultId).then(setEvents) }, [vaultKey, vaultId])
  return (
    <Card title="Security activity" className="gap-2">
      <p className="text-sm text-slate-700 dark:text-slate-300">Local, metadata-only history (no passwords or secrets). Events are kept on this device.</p>
      {events.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-400">No activity recorded yet.</p> : (
        <ul className="max-h-64 space-y-1 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/40" aria-label="Recent security activity">
          {events.slice(0, 60).map((e) => (
            <li key={e.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1 border-b border-slate-200 py-1.5 last:border-0 dark:border-slate-700">
              <span className="font-medium">{LABELS[e.type] ?? e.type}{e.detail ? <span className="font-normal text-slate-600 dark:text-slate-300"> — {e.detail}</span> : ''}</span>
              <span className="shrink-0 text-slate-500">{new Date(e.at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

