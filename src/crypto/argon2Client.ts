import { CryptoError } from './errors'
import type { Argon2Fn, Argon2Request, Argon2Response } from './types'

/** Cap the wait so a hostile (but in-range) header cannot hang the UI forever. */
export const ARGON2_TIMEOUT_MS = 60_000

/**
 * Browser Argon2 runner. A fresh worker per call, terminated afterwards, so the
 * ~64 MiB of WASM memory is released immediately. The password buffer is
 * transferred (not copied), so the main thread keeps no copy of it (the caller's buffer is zeroed).
 * A wall-clock timeout terminates the worker and rejects, so untrusted headers that pass the
 * numeric limits but are still slow cannot freeze the app.
 */
export const argon2Worker: Argon2Fn = (password, salt, costs) =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./argon2.worker.ts', import.meta.url), { type: 'module' })
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      worker.terminate()
      reject(new CryptoError('kdf-timeout'))
    }, ARGON2_TIMEOUT_MS)

    const finish = (done: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      worker.terminate()
      done()
    }

    worker.onmessage = (event: MessageEvent<Argon2Response>) => {
      const data = event.data
      finish(() => (data.ok ? resolve(data.hash) : reject(new CryptoError('kdf-failed'))))
    }
    worker.onerror = () => finish(() => reject(new CryptoError('kdf-failed')))

    try {
      const copy = password.slice() // exact-size buffer we can hand over
      password.fill(0) // zero the caller's copy right away
      const request: Argon2Request = { password: copy, salt, costs }
      worker.postMessage(request, [copy.buffer as ArrayBuffer])
    } catch {
      finish(() => reject(new CryptoError('kdf-failed')))
    }
  })