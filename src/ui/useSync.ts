import { useMemo } from 'react'
import { createSyncService } from '../sync/service'
import { idbSyncState } from '../sync/target'
import { session } from '../vault/instance'
import { idbRecordStorage } from '../vault/storage'
import { useSessionState } from './hooks'

/** The sync service for the unlocked vault (null while locked). */
export function useSync() {
  const state = useSessionState()
  const vaultKey = state.status === 'unlocked' ? state.vaultKey : null
  return useMemo(
    () =>
      vaultKey
        ? createSyncService({
            vaultKey,
            getHeader: () => {
              const current = session.getState()
              if (current.status !== 'unlocked') throw new Error('locked')
              return current.header
            },
            adoptHeader: (header) => session.replaceHeader(header),
            records: idbRecordStorage,
            state: idbSyncState,
          })
        : null,
    [vaultKey],
  )
}
