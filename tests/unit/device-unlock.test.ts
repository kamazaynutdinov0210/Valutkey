import { describe, expect, it } from 'vitest'
import { importAesKey, randomBytes } from '../../src/crypto/aead'
import { toB64 } from '../../src/crypto/encoding'
import { openRecord, sealRecord } from '../../src/crypto/records'
import { clearDeviceUnlock, DeviceUnlockError, enrollDeviceUnlock, unlockWithDevice, type DeviceUnlockRecord, type DeviceUnlockStore, type PrfProvider } from '../../src/unlock/device'

/** A stand-in authenticator: its secret never leaves it, and the same inputs always give the same output. */
function fakeAuthenticator(secret: Uint8Array, options: { prf?: boolean } = {}): PrfProvider & { prompts: number } {
  const auth = {
    prompts: 0,
    isAvailable: async () => true,
    create: async () => ({ credentialId: randomBytes(16), prfEnabled: options.prf !== false }),
    evaluate: async (id: Uint8Array, salt: Uint8Array) => {
      auth.prompts++
      const key = await crypto.subtle.importKey('raw', secret as unknown as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      const input = new Uint8Array([...id, ...salt])
      return new Uint8Array(await crypto.subtle.sign('HMAC', key, input as unknown as BufferSource))
    },
  }
  return auth
}
const memoryStore = (): DeviceUnlockStore & { record: DeviceUnlockRecord | null } => {
  const s = { record: null as DeviceUnlockRecord | null, load: async () => s.record, save: async (r: DeviceUnlockRecord | null) => void (s.record = r) }
  return s
}

async function setup() {
  const vkBytes = randomBytes(32)
  const vaultKey = await importAesKey(vkBytes.slice(), ['encrypt', 'decrypt'])
  return { vkBytes, vaultKey, vaultId: 'vault-1' }
}

describe('device unlock', () => {
  it('opens the same Vault Key again, using only the authenticator', async () => {
    const { vkBytes, vaultKey, vaultId } = await setup()
    const provider = fakeAuthenticator(randomBytes(32))
    const store = memoryStore()
    await enrollDeviceUnlock({ provider, vaultKeyBytes: vkBytes, vaultId, store })
    expect(provider.prompts).toBe(1) // one check at setup to prove it works

    const sealed = await sealRecord(vaultKey, vaultId, 'e1', { secret: 'x' })
    const opened = await unlockWithDevice({ provider, vaultId, store })
    expect(await openRecord(opened, vaultId, sealed)).toEqual({ secret: 'x' })
    expect(opened.extractable).toBe(false)
    expect(provider.prompts).toBe(2)
  })

  it('stores no plain key material', async () => {
    const { vkBytes, vaultId } = await setup()
    const store = memoryStore()
    await enrollDeviceUnlock({ provider: fakeAuthenticator(randomBytes(32)), vaultKeyBytes: vkBytes, vaultId, store })
    const json = JSON.stringify(store.record)
    expect(json).not.toContain(toB64(vkBytes))
    expect(store.record?.vaultId).toBe(vaultId)
  })

  it('does not work with a different authenticator (a reset or a different device)', async () => {
    const { vkBytes, vaultId } = await setup()
    const store = memoryStore()
    await enrollDeviceUnlock({ provider: fakeAuthenticator(randomBytes(32)), vaultKeyBytes: vkBytes, vaultId, store })
    let code = ''
    try {
      await unlockWithDevice({ provider: fakeAuthenticator(randomBytes(32)), vaultId, store })
    } catch (e) {
      code = e instanceof DeviceUnlockError ? e.code : 'other'
    }
    expect(code).toBe('failed')
  })

  it('saves nothing when the device cannot do it', async () => {
    const { vkBytes, vaultId } = await setup()
    const store = memoryStore()
    let code = ''
    try {
      await enrollDeviceUnlock({ provider: fakeAuthenticator(randomBytes(32), { prf: false }), vaultKeyBytes: vkBytes, vaultId, store })
    } catch (e) {
      code = e instanceof DeviceUnlockError ? e.code : 'other'
    }
    expect([code, store.record]).toEqual(['unsupported', null])
  })

  it('is tied to one vault: a different vault id, or nothing set up, is "stale"', async () => {
    const { vkBytes, vaultId } = await setup()
    const provider = fakeAuthenticator(randomBytes(32))
    const store = memoryStore()
    const codeFor = async (id: string) => {
      try {
        await unlockWithDevice({ provider, vaultId: id, store })
        return 'no-error'
      } catch (e) {
        return e instanceof DeviceUnlockError ? e.code : 'other'
      }
    }
    expect(await codeFor(vaultId)).toBe('stale') // nothing enrolled yet
    await enrollDeviceUnlock({ provider, vaultKeyBytes: vkBytes, vaultId, store })
    expect(await codeFor('another-vault')).toBe('stale')
    expect(await codeFor(vaultId)).toBe('no-error')
  })

  it('refuses a record that was tampered with', async () => {
    const { vkBytes, vaultId } = await setup()
    const provider = fakeAuthenticator(randomBytes(32))
    const store = memoryStore()
    await enrollDeviceUnlock({ provider, vaultKeyBytes: vkBytes, vaultId, store })
    if (store.record) store.record = { ...store.record, wrapped: { ...store.record.wrapped, ct: store.record.wrapped.ct.slice(0, -4) + 'AAAA' } }
    let code = ''
    try {
      await unlockWithDevice({ provider, vaultId, store })
    } catch (e) {
      code = e instanceof DeviceUnlockError ? e.code : 'other'
    }
    expect(code).toBe('failed')
  })

  it('can be switched off', async () => {
    const { vkBytes, vaultId } = await setup()
    const provider = fakeAuthenticator(randomBytes(32))
    const store = memoryStore()
    await enrollDeviceUnlock({ provider, vaultKeyBytes: vkBytes, vaultId, store })
    await clearDeviceUnlock(store)
    expect(store.record).toBe(null)
  })
})
