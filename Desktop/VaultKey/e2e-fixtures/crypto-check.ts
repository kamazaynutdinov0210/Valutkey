// Test-only page: proves the real Argon2 worker + WebAssembly run under the strict CSP.
import { argon2Worker, createVault, openRecord, sealRecord, unlockWithPassword } from '../src/crypto'

const COSTS = { memKiB: 19456, iterations: 2, parallelism: 1 } as const
const PASSWORD = 'correct horse battery staple'

async function run(): Promise<string> {
  const { header, vaultKey } = await createVault(argon2Worker, PASSWORD, COSTS)
  const sealed = await sealRecord(vaultKey, header.vaultId, 'r1', { hello: 'world' })
  const unlocked = await unlockWithPassword(argon2Worker, PASSWORD, header)
  const opened = await openRecord<{ hello: string }>(unlocked, header.vaultId, sealed)
  return opened.hello === 'world' ? 'ok' : 'mismatch'
}

const out = document.getElementById('result')
run()
  .then((result) => {
    if (out) out.textContent = result
  })
  .catch((e: unknown) => {
    if (out) out.textContent = `fail: ${e instanceof Error ? e.name : 'unknown'}`
  })
