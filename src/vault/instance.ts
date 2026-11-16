import { argon2Worker } from '../crypto/argon2Client'
import { createSession } from './session'
import { idbHeaderStorage, idbRecordStorage, idbVaultReplacer, writeMeta } from './storage'

async function scrubDeviceBindings(): Promise<void> {
  await Promise.allSettled([
    writeMeta('deviceUnlock', null),
    writeMeta('syncState', null),
    writeMeta('syncHandle', null),
    writeMeta('reminderHint', null),
    writeMeta('lastBackgroundDay', null),
  ])
}

export const session = createSession({
  argon2: argon2Worker,
  storage: idbHeaderStorage,
  records: idbRecordStorage,
  replacer: idbVaultReplacer,
  scrubDeviceBindings,
})
