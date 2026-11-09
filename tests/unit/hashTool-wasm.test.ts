import { argon2Verify, bcryptVerify } from 'hash-wasm'
import { describe, expect, it } from 'vitest'
import { argon2idRaw } from '../../src/crypto/argon2'
import { hashText } from '../../src/tools/hashTool'

// Independent check: hash-wasm's own verifiers must accept what the tool produces.
describe('hash tool: bcrypt and Argon2id output', () => {
  it('bcrypt output is a standard hash that verifies, with a fresh salt each time', async () => {
    const a = await hashText('correct horse', 'bcrypt', argon2idRaw)
    const b = await hashText('correct horse', 'bcrypt', argon2idRaw)
    expect(a).toMatch(/^\$2[aby]\$10\$.{53}$/)
    expect(a).not.toBe(b)
    expect(await bcryptVerify({ password: 'correct horse', hash: a })).toBe(true)
    expect(await bcryptVerify({ password: 'wrong horse', hash: a })).toBe(false)
  })

  it('Argon2id output is a standard hash that verifies, with a fresh salt each time', async () => {
    const a = await hashText('correct horse', 'argon2id', argon2idRaw)
    const b = await hashText('correct horse', 'argon2id', argon2idRaw)
    expect(a.startsWith('$argon2id$v=19$m=65536,t=3,p=1$')).toBe(true)
    expect(a).not.toBe(b)
    expect(await argon2Verify({ password: 'correct horse', hash: a })).toBe(true)
    expect(await argon2Verify({ password: 'wrong horse', hash: a })).toBe(false)
  })
})
