import { rotationStatus, type RotationStatus } from '../reminders/schedule'
import { analyzeVaultHealth } from './health'
import { NOTE_CATEGORY, type Entry } from './entry'

export interface UpcomingRotation {
  entry: Entry
  status: RotationStatus
}

export interface DashboardData {
  total: number
  notes: number
  favorites: number
  weak: number
  reused: number
  old: number
  needsAttention: number
  missingUsername: number
  insecureUrls: number
  score: number
  overdueCount: number
  recentlyUpdated: Entry[]
  upcoming: UpcomingRotation[]
  lastBackupAt: number | null
  recommendations: string[]
}

/**
 * Builds the vault dashboard from real, already-decrypted entries. Every number comes from stored
 * data; nothing is fabricated. `lastBackupAt` is a non-secret local timestamp (null if never saved).
 */
export function buildDashboard(entries: Entry[], now: number = Date.now(), lastBackupAt: number | null = null): DashboardData {
  const health = analyzeVaultHealth(entries, now)
  const live = entries.filter((e) => e.deletedAt === undefined)

  const recentlyUpdated = [...live].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5)

  const upcoming: UpcomingRotation[] = []
  let overdueCount = 0
  for (const entry of live) {
    if (!entry.rotation) continue
    const status = rotationStatus(entry.rotation, now)
    if (status.state === 'overdue') overdueCount += 1
    if (status.state !== 'later') upcoming.push({ entry, status })
  }
  upcoming.sort((a, b) => a.status.daysUntilDue - b.status.daysUntilDue || a.entry.title.localeCompare(b.entry.title))

  const recommendations: string[] = []
  if (health.weak > 0) recommendations.push(`${health.weak} weak password${health.weak === 1 ? '' : 's'} — generate stronger ones.`)
  if (health.reused > 0) recommendations.push(`${health.reused} reused password${health.reused === 1 ? '' : 's'} — give each account a unique password.`)
  if (health.old > 0) recommendations.push(`${health.old} password${health.old === 1 ? '' : 's'} not changed in over 180 days.`)
  if (health.missingUsername > 0) recommendations.push(`${health.missingUsername} entr${health.missingUsername === 1 ? 'y is' : 'ies are'} missing a username.`)
  if (health.insecureUrls > 0) recommendations.push(`${health.insecureUrls} saved website${health.insecureUrls === 1 ? '' : 's'} use insecure HTTP.`)
  if (overdueCount > 0) recommendations.push(`${overdueCount} password${overdueCount === 1 ? ' is' : 's are'} overdue for a change.`)
  if (lastBackupAt === null) recommendations.push('You haven’t saved a backup from this device yet.')
  if (recommendations.length === 0) recommendations.push('Everything looks good. Keep saving backups and rotating old passwords.')

  return {
    total: health.total,
    notes: live.filter((e) => e.category === NOTE_CATEGORY).length,
    favorites: live.filter((e) => e.favorite).length,
    weak: health.weak,
    reused: health.reused,
    old: health.old,
    needsAttention: health.needsAttention,
    missingUsername: health.missingUsername,
    insecureUrls: health.insecureUrls,
    score: health.score,
    overdueCount,
    recentlyUpdated,
    upcoming: upcoming.slice(0, 5),
    lastBackupAt,
    recommendations,
  }
}