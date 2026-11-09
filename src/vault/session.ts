import type { Argon2Fn, KdfCosts, VaultHeader } from '../crypto/types'
import { createVault, resetPasswordWithRecovery, unlockWithPassword, unlockWithRecovery } from '../crypto/wrap'
import type { EncryptedRecord } from '../crypto/types'
import type { HeaderStorage, RecordStorage, VaultReplacer } from './storage'

export type SessionState =
  | { status: 'loading' }
  | { status: 'no-vault' }
  | { status: 'locked'; header: VaultHeader }
  | { status: 'unlocked'; header: VaultHeader; vaultKey: CryptoKey }

/** A vault that exists only in memory until the person confirms they saved the recovery key. */
export interface PendingVault {
  header: VaultHeader
  vaultKey: CryptoKey
  recoveryKey: string
}

export interface SessionDeps {
  argon2: Argon2Fn
  storage: HeaderStorage
  records?: RecordStorage // only used to remove leftovers when a brand-new vault is created
  replacer?: VaultReplacer // atomic whole-vault replacement (new vault key, or replace from a file)
  costs?: KdfCosts // tests use cheaper settings; the app uses the default
}

/**
 * The one place that holds the unlocked Vault Key. Locking drops the only reference,
 * so the (non-extractable) key can be garbage-collected and cannot be exported meanwhile.
 */
export function createSession(deps: SessionDeps) {
  let state: SessionState = { status: 'loading' }
  const listeners = new Set<() => void>()
  const set = (next: SessionState) => {
    state = next
    listeners.forEach((listener) => listener())
  }
  const lockedHeader = (): VaultHeader => {
    if (state.status !== 'locked') throw new Error('not-locked')
    return state.header
  }

  return {
    getState: (): SessionState => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    async init(): Promise<void> {
      const header = await deps.storage.load()
      set(header ? { status: 'locked', header } : { status: 'no-vault' })
    },

    /** Step 1 of setup: make the vault in memory only. */
    prepareVault: (masterPassword: string): Promise<PendingVault> => createVault(deps.argon2, masterPassword, deps.costs),

    /** Step 2 of setup, after the recovery key is saved: persist and open. */
    async commitVault(pending: PendingVault): Promise<void> {
      if (state.status !== 'no-vault') throw new Error('vault-exists')
      await deps.records?.clear() // no vault yet, so any stored records are leftovers from a failed restore
      await deps.storage.save(pending.header)
      set({ status: 'unlocked', header: pending.header, vaultKey: pending.vaultKey })
    },

    /** After a restore: the records are already stored, so only the header is saved. */
    async adoptVault(header: VaultHeader, vaultKey: CryptoKey): Promise<void> {
      if (state.status !== 'no-vault') throw new Error('vault-exists')
      await deps.storage.save(header)
      set({ status: 'unlocked', header, vaultKey })
    },

    /** The master password was changed on another device; the Vault Key itself is unchanged. */
    async replaceHeader(header: VaultHeader): Promise<void> {
      if (state.status !== 'unlocked') throw new Error('not-unlocked')
      await deps.storage.save(header)
      set({ status: 'unlocked', header, vaultKey: state.vaultKey })
    },

    /** Opens with a Vault Key obtained another way (biometric unlock). */
    async unlockWithKey(vaultKey: CryptoKey): Promise<void> {
      set({ status: 'unlocked', header: lockedHeader(), vaultKey })
    },

    /** Swaps in a whole different vault (new vault key, or a vault restored over this one), atomically. */
    async replaceVault(next: { header: VaultHeader; vaultKey: CryptoKey; records: EncryptedRecord[] }): Promise<void> {
      if (!deps.replacer) throw new Error('no-replacer')
      if (state.status === 'loading') throw new Error('loading')
      await deps.replacer.replaceAll(next.header, next.records)
      set({ status: 'unlocked', header: next.header, vaultKey: next.vaultKey })
    },

    async unlock(password: string): Promise<void> {
      const header = lockedHeader()
      const vaultKey = await unlockWithPassword(deps.argon2, password, header)
      set({ status: 'unlocked', header, vaultKey })
    },

    /** Forgot the master password: the recovery key sets a new one. */
    async resetWithRecovery(recoveryText: string, newPassword: string): Promise<void> {
      const header = lockedHeader()
      const next = await resetPasswordWithRecovery(deps.argon2, header, recoveryText, newPassword, deps.costs)
      const vaultKey = await unlockWithRecovery(recoveryText, next)
      await deps.storage.save(next)
      set({ status: 'unlocked', header: next, vaultKey })
    },

    lock(): void {
      if (state.status === 'unlocked') set({ status: 'locked', header: state.header })
    },
  }
}

export type Session = ReturnType<typeof createSession>
