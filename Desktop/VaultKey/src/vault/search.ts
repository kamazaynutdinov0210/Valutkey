import type { Entry } from './entry'

/** Case-insensitive; every word typed must appear somewhere. Passwords are never searched. */
export function searchEntries(entries: Entry[], query: string, tag?: string): Entry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const wantedTag = tag?.toLowerCase()
  return entries
    .filter((e) => e.deletedAt === undefined)
    .filter((e) => !wantedTag || e.tags.some((t) => t.toLowerCase() === wantedTag))
    .filter((e) => {
      const haystack = [e.title, e.username, e.url, e.notes, ...e.tags].join('\n').toLowerCase()
      return words.every((w) => haystack.includes(w))
    })
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
}

export function allTags(entries: Entry[]): string[] {
  const byLower = new Map<string, string>()
  for (const e of entries) {
    if (e.deletedAt !== undefined) continue
    for (const t of e.tags) if (!byLower.has(t.toLowerCase())) byLower.set(t.toLowerCase(), t)
  }
  return [...byLower.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}
