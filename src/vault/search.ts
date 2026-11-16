import type { Entry } from './entry'

export type SortKey = 'title' | 'updated' | 'recent' | 'created'

export interface SearchOptions {
  sort?: SortKey
  favoritesOnly?: boolean
  category?: string
}

/** Case-insensitive; every word typed must appear somewhere. Passwords are never searched. */
export function searchEntries(entries: Entry[], query: string, tag?: string, options: SearchOptions = {}): Entry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const wantedTag = tag?.toLowerCase()
  const wantedCat = options.category?.trim().toLowerCase()
  const sort = options.sort ?? 'title'
  const list = entries
    .filter((e) => e.deletedAt === undefined)
    .filter((e) => !options.favoritesOnly || e.favorite === true)
    .filter((e) => !wantedTag || e.tags.some((t) => t.toLowerCase() === wantedTag))
    .filter((e) => !wantedCat || (e.category ?? '').toLowerCase() === wantedCat)
    .filter((e) => {
      const haystack = [e.title, e.username, e.url, e.notes, e.category ?? '', ...e.tags].join('\n').toLowerCase()
      return words.every((w) => haystack.includes(w))
    })
  const byTitle = (a: Entry, b: Entry) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  if (sort === 'updated') return list.sort((a, b) => b.updatedAt - a.updatedAt || byTitle(a, b))
  if (sort === 'created') return list.sort((a, b) => b.createdAt - a.createdAt || byTitle(a, b))
  if (sort === 'recent') return list.sort((a, b) => (b.lastAccessedAt ?? 0) - (a.lastAccessedAt ?? 0) || b.updatedAt - a.updatedAt || byTitle(a, b))
  return list.sort(byTitle)
}

export function allTags(entries: Entry[]): string[] {
  const byLower = new Map<string, string>()
  for (const e of entries) {
    if (e.deletedAt !== undefined) continue
    for (const t of e.tags) if (!byLower.has(t.toLowerCase())) byLower.set(t.toLowerCase(), t)
  }
  return [...byLower.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

export function allCategories(entries: Entry[]): string[] {
  const byLower = new Map<string, string>()
  for (const e of entries) {
    if (e.deletedAt !== undefined) continue
    const c = e.category?.trim()
    if (c && !byLower.has(c.toLowerCase())) byLower.set(c.toLowerCase(), c)
  }
  return [...byLower.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}
