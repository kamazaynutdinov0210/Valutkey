import { argon2idRaw } from './argon2'
import type { Argon2Request, Argon2Response } from './types'

declare const self: DedicatedWorkerGlobalScope

// Runs the slow, memory-hungry hash off the UI thread so the app never freezes.
self.onmessage = async (event: MessageEvent<Argon2Request>) => {
  const { password, salt, costs } = event.data
  try {
    const raw = await argon2idRaw(password, salt, costs)
    const hash = raw.slice() // own buffer, so it can be transferred
    raw.fill(0)
    const ok: Argon2Response = { ok: true, hash }
    self.postMessage(ok, [hash.buffer as ArrayBuffer])
  } catch {
    const fail: Argon2Response = { ok: false }
    self.postMessage(fail)
  } finally {
    password.fill(0)
  }
}
