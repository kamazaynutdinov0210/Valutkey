import { argon2id } from 'hash-wasm'
import type { Argon2Fn } from './types'

/** Argon2id via hash-wasm (WebAssembly). Returns a 32-byte raw hash. */
export const argon2idRaw: Argon2Fn = (password, salt, { memKiB, iterations, parallelism }) =>
  argon2id({
    password,
    salt,
    memorySize: memKiB,
    iterations,
    parallelism,
    hashLength: 32,
    outputType: 'binary',
  })
