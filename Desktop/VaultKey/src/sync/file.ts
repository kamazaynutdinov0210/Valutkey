import { buildAad, decrypt, encrypt } from '../crypto/aead'
import { asBuffer, fromUtf8, toB64, utf8 } from '../crypto/encoding'
import type { EncryptedRecord, Sealed, VaultHeader } from '../crypto/types'
import { canonicalJson } from './canonical'

export type SyncErrorCode = 'not-a-vault-file' | 'newer-format' | 'too-large' | 'different-vault' | 'unreadable' | 'altered'

export class SyncError extends Error {
  code: SyncErrorCode
  constructor(code: SyncErrorCode) {
    super(code)
    this.name = 'SyncError'
    this.code = code
  }
}

export const FILE_FORMAT = 'vaultkey-vault'
export const MAX_FILE_CHARS = 64 * 1024 * 1024
export const MAX_RECORDS = 20_000

/**
 * One file format for backups and sync. Everything secret inside is already encrypted: the entries
 * with the Vault Key, the Vault Key itself with the master password and the recovery key. The
 * manifest is encrypted too, so a cloud service cannot forge its revision number.
 */
export interface VaultFile {
  format: typeof FILE_FORMAT
  version: 1
  header: VaultHeader
  manifest: Sealed
  records: EncryptedRecord[]
}

export interface Manifest {
  revision: number // goes up each time a device writes the file; lets a device notice an older copy
  deviceId: string
  writtenAt: number
  recordCount: number
  recordsDigest: string // fingerprint of every (record id, IV) pair: detects a removed, added or swapped record
  headerDigest: string
  headerChangedAt: number
}

const sha256 = async (text: string): Promise<string> => toB64(new Uint8Array(await crypto.subtle.digest('SHA-256', asBuffer(utf8(text)))))

export const headerDigest = (header: VaultHeader): Promise<string> => sha256(canonicalJson(header))

export function recordsDigest(records: EncryptedRecord[]): Promise<string> {
  const lines = records.map((r) => `${r.id}:${r.iv}`).sort()
  return sha256(lines.join('\n'))
}

const manifestAad = (vaultId: string) => buildAad(vaultId, 'manifest', '1')

export async function buildVaultFile(input: {
  vaultKey: CryptoKey
  header: VaultHeader
  records: EncryptedRecord[]
  revision: number
  deviceId: string
  now: number
}): Promise<VaultFile> {
  const manifest: Manifest = {
    revision: input.revision,
    deviceId: input.deviceId,
    writtenAt: input.now,
    recordCount: input.records.length,
    recordsDigest: await recordsDigest(input.records),
    headerDigest: await headerDigest(input.header),
    headerChangedAt: input.header.changedAt ?? 0,
  }
  const sealed = await encrypt(input.vaultKey, utf8(JSON.stringify(manifest)), manifestAad(input.header.vaultId))
  return { format: FILE_FORMAT, version: 1, header: input.header, manifest: sealed, records: input.records }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isSealed = (v: unknown): v is Sealed => isObject(v) && typeof v.iv === 'string' && typeof v.ct === 'string'

/** Reads and shape-checks a file. It proves nothing about authenticity yet: that needs the key (openManifest). */
export function parseVaultFile(text: string, maxChars: number = MAX_FILE_CHARS): VaultFile {
  if (text.length > maxChars) throw new SyncError('too-large')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new SyncError('not-a-vault-file')
  }
  if (!isObject(raw) || raw.format !== FILE_FORMAT || typeof raw.version !== 'number') throw new SyncError('not-a-vault-file')
  if (raw.version > 1) throw new SyncError('newer-format')
  if (raw.version !== 1) throw new SyncError('not-a-vault-file')

  const h = raw.header
  const headerOk =
    isObject(h) &&
    h.formatVersion === 1 &&
    typeof h.vaultId === 'string' &&
    h.vaultId.length > 0 &&
    typeof h.verifier === 'string' &&
    isObject(h.kdf) &&
    isObject(h.wrapped) &&
    isSealed(h.wrapped.password) &&
    isSealed(h.wrapped.recovery) &&
    (h.changedAt === undefined || typeof h.changedAt === 'number')
  if (!headerOk || !isSealed(raw.manifest) || !Array.isArray(raw.records) || raw.records.length > MAX_RECORDS) {
    throw new SyncError('not-a-vault-file')
  }

  const seen = new Set<string>()
  for (const r of raw.records as unknown[]) {
    if (!isObject(r) || typeof r.id !== 'string' || r.id.length === 0 || r.id.length > 100 || r.v !== 1 || !isSealed(r) || seen.has(r.id)) {
      throw new SyncError('not-a-vault-file')
    }
    seen.add(r.id)
  }
  return raw as unknown as VaultFile
}

/** Opens the sealed manifest with the Vault Key and checks the file is complete and unchanged. */
export async function openManifest(vaultKey: CryptoKey, file: VaultFile): Promise<Manifest> {
  let manifest: unknown
  try {
    manifest = JSON.parse(fromUtf8(await decrypt(vaultKey, file.manifest, manifestAad(file.header.vaultId))))
  } catch {
    throw new SyncError('unreadable') // a different vault key, or the manifest was changed
  }
  const m = manifest as Partial<Manifest>
  const shapeOk =
    isObject(manifest) &&
    Number.isInteger(m.revision) &&
    typeof m.deviceId === 'string' &&
    typeof m.writtenAt === 'number' &&
    typeof m.recordCount === 'number' &&
    typeof m.recordsDigest === 'string' &&
    typeof m.headerDigest === 'string' &&
    typeof m.headerChangedAt === 'number'
  if (!shapeOk) throw new SyncError('altered')
  const full = m as Manifest
  if (
    full.recordCount !== file.records.length ||
    full.recordsDigest !== (await recordsDigest(file.records)) ||
    full.headerDigest !== (await headerDigest(file.header))
  ) {
    throw new SyncError('altered')
  }
  return full
}
