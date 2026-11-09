import type { EncryptedRecord } from '../crypto/types'
import { LIMITS, type Entry, type HistoryItem } from '../vault/entry'

export interface Versioned {
  entry: Entry
  record: EncryptedRecord
}

export interface MergeItem {
  entry: Entry
  record: EncryptedRecord | null // null: the merged entry is new and must be encrypted again
  origin: 'local' | 'remote' | 'merged'
}

export interface MergeStats {
  added: number // new here, taken from the file
  updated: number // the file had a newer version
  removed: number // the file says it was deleted
  sentToFile: number // this device's newer or new items that the file did not have
  conflicts: number // changed on both sides since the last sync
  unchanged: number
}

export const emptyStats = (): MergeStats => ({ added: 0, updated: 0, removed: 0, sentToFile: 0, conflicts: 0, unchanged: 0 })

const isLive = (e: Entry) => e.deletedAt === undefined
const sameVersion = (a: Versioned, b: Versioned) => a.record.iv === b.record.iv && a.record.ct === b.record.ct

/** Newest edit wins. On an exact tie a delete wins, then the larger IV, so both devices pick the same one. */
function pickWinner(a: Versioned, b: Versioned): 'a' | 'b' {
  if (a.entry.updatedAt !== b.entry.updatedAt) return a.entry.updatedAt > b.entry.updatedAt ? 'a' : 'b'
  if (isLive(a.entry) !== isLive(b.entry)) return isLive(a.entry) ? 'b' : 'a'
  return a.record.iv >= b.record.iv ? 'a' : 'b'
}

/** The winner's history plus anything the loser knew that would otherwise vanish, newest first, capped. */
function mergeHistory(winner: Entry, loser: Entry): HistoryItem[] {
  const items = [...winner.history, ...loser.history]
  if (loser.password && loser.password !== winner.password) {
    items.push({ password: loser.password, replacedAt: loser.updatedAt, reason: 'import' })
  }
  const newest = new Map<string, HistoryItem>()
  for (const item of items) {
    if (item.password === winner.password) continue
    const seen = newest.get(item.password)
    if (!seen || item.replacedAt > seen.replacedAt) newest.set(item.password, item)
  }
  return [...newest.values()].sort((a, b) => b.replacedAt - a.replacedAt).slice(0, LIMITS.history)
}

/**
 * Merges two copies of one vault, entry by entry. `lastSyncedAt` tells which side changed since
 * the last time the two agreed: if both did, that is a conflict (the newest still wins, but the
 * older password is kept in history so nothing is lost silently).
 */
export function mergeEntries(local: Versioned[], remote: Versioned[], lastSyncedAt: number | null): { items: MergeItem[]; stats: MergeStats } {
  const since = lastSyncedAt ?? 0
  const stats = emptyStats()
  const localById = new Map(local.map((v) => [v.entry.id, v]))
  const remoteById = new Map(remote.map((v) => [v.entry.id, v]))
  const items: MergeItem[] = []

  for (const id of new Set([...localById.keys(), ...remoteById.keys()])) {
    const l = localById.get(id)
    const r = remoteById.get(id)

    if (l && !r) {
      items.push({ entry: l.entry, record: l.record, origin: 'local' })
      stats.sentToFile++
    } else if (r && !l) {
      items.push({ entry: r.entry, record: r.record, origin: 'remote' })
      if (isLive(r.entry)) stats.added++
    } else if (l && r) {
      if (sameVersion(l, r)) {
        items.push({ entry: l.entry, record: l.record, origin: 'local' })
        stats.unchanged++
        continue
      }
      const remoteWins = pickWinner(l, r) === 'b'
      const [win, lose] = remoteWins ? [r, l] : [l, r]
      const conflict = l.entry.updatedAt > since && r.entry.updatedAt > since
      if (conflict) stats.conflicts++

      if (remoteWins) {
        if (!isLive(r.entry)) stats.removed++
        else if (!isLive(l.entry)) stats.added++
        else stats.updated++
      } else {
        stats.sentToFile++
      }

      const keepsLoserPassword = conflict && isLive(win.entry) && isLive(lose.entry) && lose.entry.password !== win.entry.password
      if (keepsLoserPassword) {
        items.push({ entry: { ...win.entry, history: mergeHistory(win.entry, lose.entry) }, record: null, origin: 'merged' })
      } else {
        items.push({ entry: win.entry, record: win.record, origin: remoteWins ? 'remote' : 'local' })
      }
    }
  }
  return { items, stats }
}

export const noChanges = (s: MergeStats): boolean => s.added + s.updated + s.removed + s.sentToFile + s.conflicts === 0

export function describeMerge(s: MergeStats): string {
  if (noChanges(s)) return 'Everything was already up to date.'
  const n = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`
  const parts: string[] = []
  if (s.added) parts.push(`added ${n(s.added, 'password')}`)
  if (s.updated) parts.push(`updated ${n(s.updated, 'password')}`)
  if (s.removed) parts.push(`removed ${n(s.removed, 'deleted password')}`)
  let text = parts.length ? `From the file: ${parts.join(', ')}.` : ''
  if (s.sentToFile) text += `${text ? ' ' : ''}${n(s.sentToFile, 'change')} from this device ${s.sentToFile === 1 ? 'was' : 'were'} included in the file.`
  if (s.conflicts) {
    text += ` ${n(s.conflicts, 'password')} ${s.conflicts === 1 ? 'was' : 'were'} changed in both places. VaultKey kept the newest version, and older passwords are in each entry’s history.`
  }
  return text
}
