import { randomBytes } from '../crypto/aead'
import { asBuffer } from '../crypto/encoding'
import { readMeta, writeMeta } from '../vault/storage'
import { DeviceUnlockError, type DeviceUnlockRecord, type DeviceUnlockStore, type PrfProvider } from './device'

type PrfResults = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } }

/** The browser's passkeys, used only for their PRF secret. Not every browser or device supports this. */
export const webauthnProvider: PrfProvider = {
  async isAvailable() {
    try {
      return typeof PublicKeyCredential !== 'undefined' && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    } catch {
      return false
    }
  },

  async create() {
    const credential = (await navigator.credentials.create({
      publicKey: {
        rp: { name: 'VaultKey' },
        user: { id: asBuffer(randomBytes(16)), name: 'VaultKey on this device', displayName: 'VaultKey' },
        challenge: asBuffer(randomBytes(32)),
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60_000,
        extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null
    if (!credential) throw new DeviceUnlockError('failed')
    const results = credential.getClientExtensionResults() as PrfResults
    return { credentialId: new Uint8Array(credential.rawId), prfEnabled: results.prf?.enabled === true }
  },

  async evaluate(credentialId, salt) {
    const credential = (await navigator.credentials.get({
      publicKey: {
        challenge: asBuffer(randomBytes(32)),
        allowCredentials: [{ type: 'public-key', id: asBuffer(credentialId) }],
        userVerification: 'required',
        timeout: 60_000,
        extensions: { prf: { eval: { first: asBuffer(salt) } } } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null
    const first = (credential?.getClientExtensionResults() as PrfResults | undefined)?.prf?.results?.first
    if (!first) throw new DeviceUnlockError('unsupported')
    return new Uint8Array(first)
  },
}

export const idbDeviceUnlock: DeviceUnlockStore = {
  load: async () => (await readMeta<DeviceUnlockRecord | null>('deviceUnlock').catch(() => null)) ?? null,
  save: (record) => writeMeta('deviceUnlock', record),
}
