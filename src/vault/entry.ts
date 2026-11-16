import { defaultSettings, parseSettings, type GeneratorSettings } from '../generator'

export type RotationUnit = 'day' | 'week' | 'month'

/** The categories offered by the form. Free-form values are still accepted for old entries. */
export const ENTRY_CATEGORIES = [
  'Website login',
  'Application',
  'Email account',
  'Financial account',
  'Secure note',
  'Identity',
  'Wi-Fi',
  'Other',
] as const
export type EntryCategory = (typeof ENTRY_CATEGORIES)[number]
export const NOTE_CATEGORY: EntryCategory = 'Secure note'
export function isEntryCategory(value: string): value is EntryCategory {
  return (ENTRY_CATEGORIES as readonly string[]).includes(value)
}
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
  category?: string
  favorite?: boolean
  lastAccessedAt?: number
  createdAt: number
  updatedAt: number
  generator: GeneratorSettings // reused to suggest a new password at rotation time
  rotation?: Rotation
  history: HistoryItem[] // previous passwords, newest first
  deletedAt?: number // a deleted entry stays as an empty "tombstone" so deletes can sync
  archivedAt?: number // soft archive for applications/accounts
  // Application & account management (optional; backward compatible)
  email?: string
  application?: string // grouping name for multiple accounts under one application
  accountStatus?: 'active' | 'inactive'
  icon?: string // emoji or data URL
  automationEnabled?: boolean
  automationMode?: 'manual' | 'assisted' | 'automatic'
  requireConfirmation?: boolean
  reminderEnabled?: boolean
  lastPasswordChangeAt?: number
  nextPasswordChangeAt?: number
  reminderIntervalDays?: number
  snoozedUntil?: number
  automationLastRunAt?: number
  automationLastStatus?: 'success' | 'failed' | 'pending'
  lastChangeMethod?: 'manual' | 'assisted' | 'automatic'
  lastChangeStatus?: 'success' | 'failed' | 'pending'
  lastChangeError?: string
  changeHistoryCount?: number
}

/** What the person types in the form. */
export interface EntryInput {
  title: string
  username: string
  url: string
  password: string
  notes: string
  tags: string[]
  category?: string
  favorite?: boolean
  generator: GeneratorSettings
  /** Remind me to change it every N days/weeks/months. The clock itself (lastRotatedAt) is kept by the vault service. */
  rotation?: { every: number; unit: RotationUnit }
  // Application & account management (optional)
  email?: string
  application?: string
  accountStatus?: 'active' | 'inactive'
  icon?: string
  automationEnabled?: boolean
  automationMode?: 'manual' | 'assisted' | 'automatic'
  requireConfirmation?: boolean
  reminderEnabled?: boolean
  lastPasswordChangeAt?: number
  nextPasswordChangeAt?: number
  reminderIntervalDays?: number
  snoozedUntil?: number
  archivedAt?: number
  lastChangeMethod?: 'manual' | 'assisted' | 'automatic'
  lastChangeStatus?: 'success' | 'failed' | 'pending'
  lastChangeError?: string
}

export const LIMITS = { title: 200, username: 200, url: 2000, password: 1024, notes: 10_000, tag: 40, tags: 20, history: 20, category: 40, email: 200, application: 200, icon: 512 } as const

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
  const category = input.category?.trim()
  if (category) tooLong(category, LIMITS.category, 'The category')
  const email = input.email?.trim()
  if (email) tooLong(email, LIMITS.email, 'The email')
  const application = input.application?.trim()
  if (application) tooLong(application, LIMITS.application, 'The application')
  const icon = input.icon?.trim()
  if (icon) tooLong(icon, LIMITS.icon, 'The icon')
  if (input.accountStatus !== undefined && input.accountStatus !== 'active' && input.accountStatus !== 'inactive') throw new EntryError('Choose a valid account status.')
  if (input.automationMode !== undefined && !['manual', 'assisted', 'automatic'].includes(input.automationMode)) throw new EntryError('Choose a valid automation mode.')
  if (input.reminderIntervalDays !== undefined && (!Number.isInteger(input.reminderIntervalDays) || input.reminderIntervalDays < 1 || input.reminderIntervalDays > 3650)) throw new EntryError('Choose a reminder interval between 1 and 3650 days.')
  return {
    ...input,
    title,
    username: input.username.trim(),
    url: input.url.trim(),
    tags: normalizeTags(input.tags),
    category: category || undefined,
    favorite: Boolean(input.favorite),
    email: email || undefined,
    application: application || undefined,
    icon: icon || undefined,
    accountStatus: input.accountStatus,
    automationEnabled: input.automationEnabled === undefined ? undefined : Boolean(input.automationEnabled),
    automationMode: input.automationMode,
    requireConfirmation: input.requireConfirmation === undefined ? undefined : Boolean(input.requireConfirmation),
    reminderEnabled: input.reminderEnabled === undefined ? undefined : Boolean(input.reminderEnabled),
    lastPasswordChangeAt: input.lastPasswordChangeAt,
    nextPasswordChangeAt: input.nextPasswordChangeAt,
    reminderIntervalDays: input.reminderIntervalDays,
    snoozedUntil: input.snoozedUntil,
    archivedAt: input.archivedAt,
    lastChangeMethod: input.lastChangeMethod,
    lastChangeStatus: input.lastChangeStatus,
    lastChangeError: input.lastChangeError,
  }
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
  if (typeof r.category === 'string' && r.category.length <= LIMITS.category) entry.category = r.category
  if (r.favorite === true) entry.favorite = true
  if (typeof r.lastAccessedAt === 'number' && Number.isFinite(r.lastAccessedAt)) entry.lastAccessedAt = r.lastAccessedAt
  if (r.rotation !== undefined) entry.rotation = parseRotation(r.rotation)
  if (r.deletedAt !== undefined) entry.deletedAt = num(r, 'deletedAt')
  if (typeof r.email === 'string' && r.email.length <= LIMITS.email) entry.email = r.email
  if (typeof r.application === 'string' && r.application.length <= LIMITS.application) entry.application = r.application
  if (r.accountStatus === 'active' || r.accountStatus === 'inactive') entry.accountStatus = r.accountStatus
  if (r.automationEnabled === true) entry.automationEnabled = true
  if (r.automationEnabled === false) entry.automationEnabled = false
  if (r.automationMode === 'manual' || r.automationMode === 'assisted' || r.automationMode === 'automatic') entry.automationMode = r.automationMode
  if (r.reminderEnabled === true) entry.reminderEnabled = true
  if (r.reminderEnabled === false) entry.reminderEnabled = false
  if (typeof r.lastPasswordChangeAt === 'number' && Number.isFinite(r.lastPasswordChangeAt)) entry.lastPasswordChangeAt = r.lastPasswordChangeAt
  if (typeof r.nextPasswordChangeAt === 'number' && Number.isFinite(r.nextPasswordChangeAt)) entry.nextPasswordChangeAt = r.nextPasswordChangeAt
  if (typeof r.reminderIntervalDays === 'number' && Number.isFinite(r.reminderIntervalDays)) entry.reminderIntervalDays = r.reminderIntervalDays
  if (typeof r.snoozedUntil === 'number' && Number.isFinite(r.snoozedUntil)) entry.snoozedUntil = r.snoozedUntil
  if (typeof r.automationLastRunAt === 'number' && Number.isFinite(r.automationLastRunAt)) entry.automationLastRunAt = r.automationLastRunAt
  if (r.automationLastStatus === 'success' || r.automationLastStatus === 'failed' || r.automationLastStatus === 'pending') entry.automationLastStatus = r.automationLastStatus
  if (typeof r.archivedAt === 'number' && Number.isFinite(r.archivedAt)) entry.archivedAt = r.archivedAt
  if (typeof r.icon === 'string' && r.icon.length <= LIMITS.icon) entry.icon = r.icon
  if (r.requireConfirmation === true) entry.requireConfirmation = true
  if (r.requireConfirmation === false) entry.requireConfirmation = false
  if (r.lastChangeMethod === 'manual' || r.lastChangeMethod === 'assisted' || r.lastChangeMethod === 'automatic') entry.lastChangeMethod = r.lastChangeMethod
  if (r.lastChangeStatus === 'success' || r.lastChangeStatus === 'failed' || r.lastChangeStatus === 'pending') entry.lastChangeStatus = r.lastChangeStatus
  if (typeof r.lastChangeError === 'string' && r.lastChangeError.length <= 500) entry.lastChangeError = r.lastChangeError
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
