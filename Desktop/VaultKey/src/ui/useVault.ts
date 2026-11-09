import { useEffect, useMemo, useState } from 'react'
import { createVaultService } from '../vault/entries'
import type { Entry, EntryInput } from '../vault/entry'
import { idbRecordStorage } from '../vault/storage'
import { useSessionState } from './hooks'

/** Holds the decrypted entries while the vault is unlocked. Lives in the Shell, so it is dropped on lock. */
export function useVault() {
  const state = useSessionState()
  const vaultKey = state.status === 'unlocked' ? state.vaultKey : null
  const vaultId = state.status === 'unlocked' ? state.header.vaultId : ''
  const service = useMemo(
    () => (vaultKey ? createVaultService({ vaultKey, vaultId, storage: idbRecordStorage }) : null),
    [vaultKey, vaultId],
  )
  const [entries, setEntries] = useState<Entry[]>([])
  const [damaged, setDamaged] = useState(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!service) return
    let cancelled = false
    setReady(false)
    service
      .load()
      .then((result) => {
        if (cancelled) return
        setEntries(service.list())
        setDamaged(result.damaged)
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) setError('VaultKey couldn’t open your saved passwords. Close it and try again.')
      })
    return () => {
      cancelled = true
    }
  }, [service])

  const need = () => {
    if (!service) throw new Error('locked')
    return service
  }
  return {
    ready,
    error,
    entries,
    damaged,
    /** Re-reads everything from storage (after a sync or a merge changed it). */
    async reload(): Promise<void> {
      const svc = need()
      const result = await svc.load()
      setEntries(svc.list())
      setDamaged(result.damaged)
    },
    async create(input: EntryInput): Promise<Entry> {
      const entry = await need().create(input)
      setEntries(need().list())
      return entry
    },
    async update(id: string, input: EntryInput): Promise<Entry> {
      const entry = await need().update(id, input)
      setEntries(need().list())
      return entry
    },
    async rotate(id: string, newPassword: string): Promise<Entry> {
      const entry = await need().rotate(id, newPassword)
      setEntries(need().list())
      return entry
    },
    async remove(id: string): Promise<void> {
      await need().remove(id)
      setEntries(need().list())
    },
  }
}

export type VaultApi = ReturnType<typeof useVault>
