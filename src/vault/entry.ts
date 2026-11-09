import { defaultSettings, parseSettings, type GeneratorSettings } from '../generator'

export type RotationUnit = 'day' | 'week' | 'month'
export interface Rotation {
  every: number
  unit: RotationUnit
  lastRotatedAt: number
}
/** Longest reminder interval allowed per unit (about ten years). */
export const ROTATION_MAX: Record<RotationUnit, number> = { day: 3650, week: 520, month: 120 }
export function isValidRotation(every: unknown, unit: unknown): boolean {
  return (
    (unit === 'day' || unit === 'week' || unit === 'month') &&
    typeof every === 'number' &&
    Number.isInteger(every) &&
    every >= 1 &&
    every <= ROTATION_MAX[unit]
  )
}

export interface HistoryItem {
  password: string
  replacedAt: number
  reason: 'rotation' | 'edit' | 'import'
}

/** One saved login. Lives only inside an encrypted record. */
export interface Entry {
  id: string
  title: string
  username: string
  url: string
  password: string
  notes: string
  tags: string[]
  createdAt: number
  updatedAt: number
  generator: GeneratorSettings // reused to suggest a new password at rotation time
  rotation?: Rotation
  history: HistoryItem[] // previous passwords, newest first
  deletedAt?: number // a deleted entry stays as an empty "tombstone" so deletes can sync
}

/** What the person types in the form. */
export interface EntryInput {
  title: string
  username: string
  url: string
  password: string
  notes: string
  tags: string[]
  generator: GeneratorSettings
  /** Remind me to change it every N days/weeks/months. The clock itself (lastRotatedAt) is kept by the vault service. */
  rotation?: { every: number; unit: RotationUnit }
}

export const LIMITS = { title: 200, username: 200, url: 2000, password: 1024, notes: 10_000, tag: 40, tags: 20, history: 20 } as const

/** Messages are written for the person, so the form can show them as they are. */
export class EntryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EntryError'
  }
}

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const tag = raw.trim().replace(/\s+/g, ' ')
    if (!tag || seen.has(tag.toLowerCase())) continue
    seen.add(tag.toLowerCase())
    out.push(tag)
  }
  if (out.length > LIMITS.tags || out.some((t) => t.length > LIMITS.tag)) {
    throw new EntryError(`Use up to ${LIMITS.tags} tags of ${LIMITS.tag} characters or fewer.`)
  }
  return out
}

export function parseTagText(text: string): string[] {
  return normalizeTags(text.split(','))
}

/** Checks and tidies form input before it is saved. */
export function normalizeInput(input: EntryInput): EntryInput {
  const title = input.title.trim()
  if (!title) throw new EntryError('Give this password a title.')
  const tooLong = (value: string, max: number, name: string) => {
    if (value.length > max) throw new EntryError(`${name} is too long (up to ${max} characters).`)
  }
  tooLong(title, LIMITS.title, 'The title')
  tooLong(input.username, LIMITS.username, 'The username')
  tooLong(input.url, LIMITS.url, 'The website')
  tooLong(input.password, LIMITS.password, 'The password')
  tooLong(input.notes, LIMITS.notes, 'The notes')
  if (input.rotation && !isValidRotation(input.rotation.every, input.rotation.unit)) {
    throw new EntryError('Choose a whole number of days, weeks or months for the reminder.')
  }
  return { ...input, title, username: input.username.trim(), url: input.url.trim(), tags: normalizeTags(input.tags) }
}

/**
 * Makes a link we are willing to open. Only http and https: a saved "javascript:" address
 * must never become a clickable link. A bare "example.com" is treated as https.
 */
export function safeHttpUrl(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  // Only "scheme://" counts as a scheme. Anything else ("example.com", "localhost:3000", "javascript:x")
  // is treated as a host, and "javascript:x" then fails to parse as a host and port.
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(candidate)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

// ---- reading entries back from storage: never trust the shape, even after decryption ----

function fail(): never {
  throw new EntryError('A saved item is damaged.')
}
const asRecord = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : fail())
const str = (r: Record<string, unknown>, k: string, max: number): string => {
  const v = r[k]
  return typeof v === 'string' && v.length <= max ? v : fail()
}
const num = (r: Record<string, unknown>, k: string): number => {
  const v = r[k]
  return typeof v === 'number' && Number.isFinite(v) ? v : fail()
}

export function parseEntry(raw: unknown): Entry {
  const r = asRecord(raw)
  const tags = Array.isArray(r.tags) && r.tags.every((t) => typeof t === 'string' && t.length <= LIMITS.tag) && r.tags.length <= LIMITS.tags ? (r.tags as string[]) : fail()
  const history = Array.isArray(r.history) && r.history.length <= LIMITS.history ? r.history.map(parseHistory) : fail()

  let generator: GeneratorSettings
  try {
    generator = parseSettings(r.generator)
  } catch {
    generator = defaultSettings('password') // damaged settings must not lock someone out of their password
  }

  const entry: Entry = {
    id: str(r, 'id', 100),
    title: str(r, 'title', LIMITS.title),
    username: str(r, 'username', LIMITS.username),
    url: str(r, 'url', LIMITS.url),
    password: str(r, 'password', LIMITS.password),
    notes: str(r, 'notes', LIMITS.notes),
    tags,
    createdAt: num(r, 'createdAt'),
    updatedAt: num(r, 'updatedAt'),
    generator,
    history,
  }
  if (r.rotation !== undefined) entry.rotation = parseRotation(r.rotation)
  if (r.deletedAt !== undefined) entry.deletedAt = num(r, 'deletedAt')
  if (entry.deletedAt === undefined && !entry.title) fail()
  return entry
}

function parseHistory(raw: unknown): HistoryItem {
  const r = asRecord(raw)
  const reason = r.reason
  if (reason !== 'rotation' && reason !== 'edit' && reason !== 'import') fail()
  return { password: str(r, 'password', LIMITS.password), replacedAt: num(r, 'replacedAt'), reason }
}

function parseRotation(raw: unknown): Rotation {
  const r = asRecord(raw)
  const unit = r.unit
  const every = num(r, 'every')
  if (!isValidRotation(every, unit)) fail()
  return { every, unit: unit as RotationUnit, lastRotatedAt: num(r, 'lastRotatedAt') }
}
