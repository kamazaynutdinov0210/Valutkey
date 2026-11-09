export interface KdfCosts {
  memKiB: number
  iterations: number
  parallelism: 1 // WASM Argon2 is single-threaded, so more lanes only add cost
}

export interface KdfParams extends KdfCosts {
  alg: 'argon2id'
  salt: string // base64url, 16 random bytes, unique per vault
}

/** Anything that can run Argon2id. May take ownership of (and zero) `password`. */
export type Argon2Fn = (password: Uint8Array, salt: Uint8Array, costs: KdfCosts) => Promise<Uint8Array>

export interface Sealed {
  iv: string // base64url, 12 random bytes
  ct: string // base64url, ciphertext + 16-byte GCM tag
}

export interface VaultHeader {
  formatVersion: 1
  vaultId: string // random UUID, bound into every ciphertext as AAD
  kdf: KdfParams
  changedAt?: number // when the master password last changed (ms); older vaults have none
  verifier: string // base64url; HKDF(argon2 output, "auth"): can't decrypt anything
  wrapped: {
    password: Sealed // the Vault Key, encrypted under the password-derived key
    recovery: Sealed // the same Vault Key, encrypted under the recovery key
  }
}

export interface EncryptedRecord extends Sealed {
  id: string
  v: 1
}

export interface Argon2Request {
  password: Uint8Array
  salt: Uint8Array
  costs: KdfCosts
}
export type Argon2Response = { ok: true; hash: Uint8Array } | { ok: false }
