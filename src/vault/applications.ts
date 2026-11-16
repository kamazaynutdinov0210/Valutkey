import type { Entry } from './entry'

export type AppFilter = 'all' | 'active' | 'archived' | 'due' | 'overdue' | 'favorites' | 'auto-on' | 'auto-off'
export type AppSort = 'name' | 'lastChange' | 'nextChange' | 'status'

export function appName(e: Entry): string {
  return (e.application || e.title || 'Unnamed').trim() || 'Unnamed'
}

export function isOverdue(e: Entry, now = Date.now()): boolean {
  return Boolean(e.nextPasswordChangeAt && e.nextPasswordChangeAt < now)
}

export function isDueSoon(e: Entry, now = Date.now()): boolean {
  if (!e.nextPasswordChangeAt) return false
  return e.nextPasswordChangeAt >= now && e.nextPasswordChangeAt - now < 7 * 86400000
}

export function isActive(e: Entry): boolean {
  return e.accountStatus !== 'inactive' && e.archivedAt === undefined && e.deletedAt === undefined
}

function matchesQuery(e: Entry, name: string, q: string): boolean {
  if (!q) return true
  const haystack = [name, e.username, e.email, e.title].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(q)
}

function matchesFilter(e: Entry, filter: AppFilter, now = Date.now()): boolean {
  const archived = e.archivedAt !== undefined
  if (filter === 'archived') return archived
  if (archived) return false
  switch (filter) {
    case 'active': return e.accountStatus !== 'inactive'
    case 'due': return isDueSoon(e, now)
    case 'overdue': return isOverdue(e, now)
    case 'favorites': return e.favorite === true
    case 'auto-on': return e.automationEnabled === true
    case 'auto-off': return e.automationEnabled !== true
    default: return true
  }
}

function sortAccounts(accounts: Entry[], sort: AppSort): Entry[] {
  const copy = [...accounts]
  if (sort === 'lastChange') return copy.sort((a, b) => (b.lastPasswordChangeAt ?? 0) - (a.lastPasswordChangeAt ?? 0))
  if (sort === 'nextChange') return copy.sort((a, b) => (a.nextPasswordChangeAt ?? Infinity) - (b.nextPasswordChangeAt ?? Infinity))
  if (sort === 'status') return copy.sort((a, b) => (a.accountStatus ?? 'active').localeCompare(b.accountStatus ?? 'active'))
  return copy
}

export function buildApplicationGroups(
  entries: Entry[],
  filter: AppFilter,
  query: string,
  sort: AppSort,
  now = Date.now(),
): [string, Entry[]][] {
  const q = query.trim().toLowerCase()
  const map = new Map<string, Entry[]>()
  for (const e of entries) {
    if (e.deletedAt !== undefined) continue
    const key = appName(e)
    const arr = map.get(key) ?? []
    arr.push(e)
    map.set(key, arr)
  }
  const result: [string, Entry[]][] = []
  for (const [name, accounts] of map) {
    const shown = accounts.filter((e) => matchesQuery(e, name, q) && matchesFilter(e, filter, now))
    if (shown.length === 0) continue
    result.push([name, sortAccounts(shown, sort)])
  }
  const groupKey = (g: [string, Entry[]], s: AppSort): number | string => {
    if (s === 'name') return g[0]
    if (s === 'lastChange') return -(g[1].reduce((m, e) => Math.max(m, e.lastPasswordChangeAt ?? 0), 0))
    if (s === 'nextChange') return g[1].reduce((m, e) => Math.min(m, e.nextPasswordChangeAt ?? Infinity), Infinity)
    return g[1][0]?.accountStatus ?? 'active'
  }
  if (sort === 'name') result.sort((a, b) => a[0].localeCompare(b[0]))
  else if (sort === 'lastChange') result.sort((a, b) => (b[1].reduce((m, e) => Math.max(m, e.lastPasswordChangeAt ?? 0), 0)) - (a[1].reduce((m, e) => Math.max(m, e.lastPasswordChangeAt ?? 0), 0)))
  else if (sort === 'nextChange') result.sort((a, b) => (a[1].reduce((m, e) => Math.min(m, e.nextPasswordChangeAt ?? Infinity), Infinity)) - (b[1].reduce((m, e) => Math.min(m, e.nextPasswordChangeAt ?? Infinity), Infinity)))
  else if (sort === 'status') result.sort((a, b) => (a[1][0]?.accountStatus ?? 'active').localeCompare(b[1][0]?.accountStatus ?? 'active'))
  void groupKey
  return result
}