import { rateGenerated, strengthFromBits } from '../generator'
import { rotationStatus } from '../reminders/schedule'
import { safeHttpUrl, type Entry } from './entry'

export interface HealthIssue {
  id: string
  label: string
  severity: 'high' | 'medium' | 'low'
}

export interface EntryHealth {
  entryId: string
  title: string
  issues: HealthIssue[]
  scoreImpact: number
}

export interface HealthReport {
  total: number
  strong: number
  weak: number
  reused: number
  old: number
  needsAttention: number
  missingUsername: number
  insecureUrls: number
  score: number
  formula: string
  reusedGroups: { passwordPreview: string; entryIds: string[]; titles: string[] }[]
  weakEntries: EntryHealth[]
  suggestions: { entryId: string; title: string; text: string }[]
}

const WEAK_LEVEL_MAX = 1 // Very weak, Weak
const OLD_DAYS = 180
const DAY = 86_400_000

function passwordStrength(entry: Entry) {
  const bits = rateGenerated(entry.generator).bits
  return strengthFromBits(bits)
}

export function analyzeVaultHealth(entries: Entry[], now = Date.now()): HealthReport {
  const live = entries.filter((e) => e.deletedAt === undefined)
  const byPassword = new Map<string, Entry[]>()
  for (const e of live) {
    if (!e.password) continue
    const list = byPassword.get(e.password) ?? []
    list.push(e)
    byPassword.set(e.password, list)
  }
  const reusedSet = new Set<string>()
  const reusedGroups: HealthReport['reusedGroups'] = []
  for (const [pw, list] of byPassword) {
    if (list.length > 1) {
      for (const e of list) reusedSet.add(e.id)
      reusedGroups.push({ passwordPreview: `${pw.slice(0, 1)}•••`, entryIds: list.map((e) => e.id), titles: list.map((e) => e.title) })
    }
  }

  const weakEntries: EntryHealth[] = []
  let strong = 0
  let weak = 0
  let old = 0
  let missingUsername = 0
  let insecureUrls = 0
  const suggestions: HealthReport['suggestions'] = []

  for (const entry of live) {
    const issues: HealthIssue[] = []
    let impact = 0
    const s = passwordStrength(entry)
    if (s.level <= WEAK_LEVEL_MAX) {
      weak++
      issues.push({ id: 'weak', label: 'Weak password', severity: 'high' })
      impact += 20
      suggestions.push({ entryId: entry.id, title: entry.title, text: 'Generate a stronger password and update it on the website.' })
    } else {
      strong++
    }
    if (reusedSet.has(entry.id)) {
      issues.push({ id: 'reused', label: 'Password reused on other accounts', severity: 'high' })
      impact += 18
      suggestions.push({ entryId: entry.id, title: entry.title, text: 'Use a unique password for this account.' })
    }
    if (entry.password && entry.password.length < 12) {
      issues.push({ id: 'short', label: 'Password is shorter than 12 characters', severity: 'medium' })
      impact += 8
    }
    const ageDays = (now - (entry.updatedAt || entry.createdAt)) / DAY
    if (ageDays > OLD_DAYS) {
      old++
      issues.push({ id: 'old', label: `Not changed in about ${Math.floor(ageDays)} days`, severity: 'medium' })
      impact += 6
    }
    if (entry.rotation) {
      const st = rotationStatus(entry.rotation, now)
      if (st.state === 'overdue') {
        issues.push({ id: 'rotation-overdue', label: 'Rotation is overdue', severity: 'medium' })
        impact += 10
      } else if (st.state === 'soon') {
        issues.push({ id: 'rotation-soon', label: 'Rotation due soon', severity: 'low' })
        impact += 3
      }
    }
    if (!entry.username?.trim()) {
      missingUsername++
      issues.push({ id: 'missing-username', label: 'Missing username', severity: 'low' })
      impact += 2
    }
    if (entry.url?.trim()) {
      const safe = safeHttpUrl(entry.url)
      try {
        const u = new URL(safe ?? entry.url.trim())
        if (u.protocol === 'http:') {
          insecureUrls++
          issues.push({ id: 'insecure-url', label: 'Website uses insecure HTTP', severity: 'medium' })
          impact += 7
        }
      } catch {
        // ignore malformed
      }
    }
    if (issues.length) weakEntries.push({ entryId: entry.id, title: entry.title, issues, scoreImpact: impact })
  }

  const maxImpact = Math.max(1, live.length * 35)
  const totalImpact = weakEntries.reduce((a, b) => a + b.scoreImpact, 0)
  const score = live.length === 0 ? 100 : Math.max(0, Math.min(100, Math.round(100 - (totalImpact / maxImpact) * 100)))

  return {
    total: live.length,
    strong,
    weak,
    reused: reusedSet.size,
    old,
    needsAttention: weakEntries.length,
    missingUsername,
    insecureUrls,
    score,
    formula: 'Score (0–100) is a local heuristic based on weakness, reuse, age, rotation status, missing usernames, and HTTP URLs. It does not guarantee security.',
    reusedGroups,
    weakEntries: weakEntries.sort((a, b) => b.scoreImpact - a.scoreImpact),
    suggestions: suggestions.filter((s, i, a) => a.findIndex((x) => x.entryId === s.entryId && x.text === s.text) === i).slice(0, 12),
  }
}
