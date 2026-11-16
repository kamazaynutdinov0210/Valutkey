export type SecurityEventType = 'vault-created'|'unlock-success'|'unlock-failed'|'vault-locked'|'password-changed'|'recovery-rotated'|'backup-created'|'backup-restored'|'device-unlock-enabled'|'device-unlock-disabled'|'vault-key-rotated'|'entry-created'|'entry-updated'|'entry-deleted'|'rotation-confirmed'|'import-completed'
export interface SecurityEvent { id: string; type: SecurityEventType; at: number; detail?: string }
export const MAX_EVENTS = 200

export async function loadEvents(open: () => Promise<SecurityEvent[] | null>): Promise<SecurityEvent[]> {
  try { return (await open())?.filter((e) => e && typeof e.type === 'string' && typeof e.at === 'number') ?? [] } catch { return [] }
}
export function appendEvent(events: SecurityEvent[], type: SecurityEventType, at = Date.now(), detail?: string): SecurityEvent[] {
  const next = [{ id: crypto.randomUUID(), type, at, detail }, ...events].slice(0, MAX_EVENTS)
  return next
}
