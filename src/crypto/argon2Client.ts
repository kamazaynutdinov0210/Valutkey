import { CryptoError } from './errors'
import type { Argon2Fn, Argon2Request, Argon2Response } from './types'

/**
 * Browser Argon2 runner. A fresh worker per call, terminated afterwards, so the
 * ~64 MiB of WASM memory is released immediately. The password buffer is
 * transferred (not copied), so the main thread keeps no copy of it (the caller's buffer is zeroed).
 */
export const argon2Worker: Argon2Fn = (password, salt, costs) =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./argon2.worker.ts', import.meta.url), { type: 'module' })
    const finish = () => worker.terminate()
    worker.onmessage = (event: MessageEvent<Argon2Response>) => {
      finish()
      if (event.data.ok) resolve(event.data.hash)
      else reject(new CryptoError('kdf-failed'))
    }
    worker.onerror = () => {
      finish()
      reject(new CryptoError('kdf-failed'))
    }
    const copy = password.slice() // exact-size buffer we can hand over
    password.fill(0) // zero the caller's copy right away
    const request: Argon2Request = { password: copy, salt, costs }
    worker.postMessage(request, [copy.buffer as ArrayBuffer])
  })
