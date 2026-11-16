export interface ImportRecord {
  title: string
  username: string
  url: string
  password: string
  notes: string
  tags: string[]
  sourceLine?: number
}

export interface ImportPreview {
  records: (ImportRecord & { selected: boolean; duplicateOf?: string; errors: string[] })[]
  detectedFormat: string
  mapping: Record<string, string>
  errors: string[]
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i] ?? ''
    const n = text[i + 1]
    if (q) {
      if (c === '"' && n === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && n === '\n') i++; row.push(cell); if (row.some((x) => x !== '')) rows.push(row); row = []; cell = '' }
    else cell += c
  }
  row.push(cell)
  if (row.some((x) => x !== '')) rows.push(row)
  return rows
}

const FIELD_ALIASES: Record<string, keyof ImportRecord> = {
  title: 'title', name: 'title', 'login name': 'title',
  username: 'username', 'login_username': 'username', 'login username': 'username', user: 'username', email: 'username',
  url: 'url', uri: 'url', 'login_uri': 'url', 'login uri': 'url', website: 'url',
  password: 'password', 'login_password': 'password', 'login password': 'password',
  notes: 'notes', note: 'notes', 'extra': 'notes', comments: 'notes',
  tags: 'tags', folder: 'tags', type: 'tags',
}

export function detectMapping(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const h of headers) {
    const k = h.trim().toLowerCase()
    if (FIELD_ALIASES[k]) map[h] = FIELD_ALIASES[k]
  }
  return map
}

export function importCsv(text: string, existing: { title: string; username: string; url: string }[] = []): ImportPreview {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''))
  if (rows.length < 1) return { records: [], detectedFormat: 'unknown', mapping: {}, errors: ['File is empty.'] }
  const headers = rows[0] ?? []
  const mapping = detectMapping(headers)
  const format = headers.some((h) => /login_uri|login_username|login_password/i.test(h)) ? 'Bitwarden-compatible CSV'
    : headers.some((h) => /^Title$/i.test(h) && headers.some((x) => /^Url$/i.test(x))) ? 'Generic/1Password-like CSV'
    : 'Generic CSV'
  const errors: string[] = []
  if (!Object.values(mapping).includes('title') && !Object.values(mapping).includes('password')) errors.push('Could not confidently map required columns. Review the preview before importing.')
  const existingKeys = new Set(existing.map((e) => `${e.title}\u0000${e.username}\u0000${e.url}`.toLowerCase()))
  const records = rows.slice(1).map((row, i) => {
    const rec: ImportRecord & { selected: boolean; duplicateOf?: string; errors: string[] } = { title: '', username: '', url: '', password: '', notes: '', tags: [], sourceLine: i + 2, selected: true, errors: [] }
    headers.forEach((h, idx) => {
      const field = mapping[h]
      const val = row[idx] ?? ''
      if (!field) return
      if (field === 'tags') rec.tags = val.split(/[;,]/).map((s) => s.trim()).filter(Boolean)
      else if (field === 'title') rec.title = val
      else if (field === 'username') rec.username = val
      else if (field === 'url') rec.url = val
      else if (field === 'password') rec.password = val
      else if (field === 'notes') rec.notes = val
    })
    if (!rec.title.trim()) rec.title = rec.url.trim() || `Imported item ${i + 1}`
    if (rec.url && !/^https?:\/\//i.test(rec.url) && !/^[a-z][a-z0-9+.-]*:/i.test(rec.url)) rec.url = `https://${rec.url}`
    if (/^(javascript|data|vbscript):/i.test(rec.url.trim())) { rec.errors.push('Unsafe URL scheme removed.'); rec.url = '' }
    const key = `${rec.title}\u0000${rec.username}\u0000${rec.url}`.toLowerCase()
    if (existingKeys.has(key)) { rec.duplicateOf = 'Existing entry'; rec.selected = false }
    if (!rec.password && !rec.username && !rec.notes) rec.errors.push('Row has little useful data.')
    return rec
  }).filter((r) => r.title || r.password || r.username)
  return { records, detectedFormat: format, mapping, errors }
}
