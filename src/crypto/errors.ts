export type CryptoErrorCode =
  | 'wrong-password'
  | 'wrong-recovery-key'
  | 'invalid-recovery-key'
  | 'invalid-header'
  | 'invalid-input'
  | 'decrypt-failed'
  | 'corrupt'
  | 'kdf-failed'
  | 'kdf-timeout'
  | 'weak-header'

// Messages are fixed strings on purpose: an error must never contain a secret.
export class CryptoError extends Error {
  code: CryptoErrorCode
  constructor(code: CryptoErrorCode) {
    super(code)
    this.name = 'CryptoError'
    this.code = code
  }
}
