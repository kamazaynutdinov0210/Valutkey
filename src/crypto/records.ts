import { buildAad, decrypt, encrypt } from './aead'
import { wipe } from './ct'
import { fromUtf8, utf8 } from './encoding'
import type { EncryptedRecord } from './types'

const RECORD_VERSION = 1

/** Encrypts one JSON value. Vault id, record id and version are bound in as AAD. */
export async function sealRecord(
  vaultKey: CryptoKey,
  vaultId: string,
  id: string,
  value: unknown,
): Promise<EncryptedRecord> {
  const bytes = utf8(JSON.stringify(value))
  try {
    const sealed = await encrypt(vaultKey, bytes, buildAad(vaultId, 'record', id, String(RECORD_VERSION)))
    return { id, v: RECORD_VERSION, ...sealed }
  } finally {
    wipe(bytes)
  }
}

/** Decrypts one record. The caller must validate the shape (M3 adds entry validation). */
export async function openRecord<T>(vaultKey: CryptoKey, vaultId: string, record: EncryptedRecord): Promise<T> {
  const bytes = await decrypt(vaultKey, record, buildAad(vaultId, 'record', record.id, String(record.v)))
  try {
    return JSON.parse(fromUtf8(bytes)) as T
  } finally {
    wipe(bytes)
  }
}
