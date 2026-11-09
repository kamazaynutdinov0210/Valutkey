import { argon2Worker } from '../crypto/argon2Client'
import { createSession } from './session'
import { idbHeaderStorage, idbRecordStorage, idbVaultReplacer } from './storage'

export const session = createSession({ argon2: argon2Worker, storage: idbHeaderStorage, records: idbRecordStorage, replacer: idbVaultReplacer })
