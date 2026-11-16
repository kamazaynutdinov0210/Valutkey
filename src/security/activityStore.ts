import { openRecord, sealRecord } from '../crypto/records'
import { readMeta, writeMeta } from '../vault/storage'
import { appendEvent, loadEvents, MAX_EVENTS, type SecurityEvent, type SecurityEventType } from './activity'

const KEY = 'securityActivity'

export async function readActivity(vaultKey?: CryptoKey, vaultId?: string): Promise<SecurityEvent[]> {
  try {
    const raw = await readMeta<unknown>(KEY)
    if (!raw) return []
    if (vaultKey && vaultId && typeof raw === 'object' && raw && 'ct' in (raw as object)) {
      return loadEvents(async () => openRecord<SecurityEvent[]>(vaultKey, vaultId, raw as never))
    }
    if (Array.isArray(raw)) return loadEvents(async () => raw as SecurityEvent[])
  } catch { /* ignore */ }
  return []
}

export async function recordActivity(type: SecurityEventType, detail?: string, vaultKey?: CryptoKey, vaultId?: string): Promise<void> {
  try {
    const events = appendEvent(await readActivity(vaultKey, vaultId), type, Date.now(), detail)
    if (vaultKey && vaultId) await writeMeta(KEY, await sealRecord(vaultKey, vaultId, 'security-activity', events.slice(0, MAX_EVENTS)))
    else await writeMeta(KEY, events.slice(0, MAX_EVENTS))
  } catch { /* never break app for activity logging */ }
}
