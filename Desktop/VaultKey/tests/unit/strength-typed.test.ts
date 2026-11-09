import { describe, expect, it } from 'vitest'
import { generate, ratePassword } from '../../src/generator'
import { DEFAULT_PASSWORD_SETTINGS } from '../../src/generator/password'

// These use the real zxcvbn-ts dictionaries, so they are slower on first run.
describe('ratePassword (typed passwords)', () => {
  it('treats an empty password as very weak without loading anything', async () => {
    expect((await ratePassword('')).level).toBe(0)
  })

  it('sees through common words and keyboard patterns', async () => {
    expect((await ratePassword('password')).level).toBe(0)
    expect((await ratePassword('Password1!')).level <= 1).toBe(true)
    expect((await ratePassword('qwertyuiop')).level <= 1).toBe(true)
  })

  it('rates a long random password as strong', async () => {
    const { value } = generate({ ...DEFAULT_PASSWORD_SETTINGS, length: 24 })
    expect((await ratePassword(value)).level >= 3).toBe(true)
  })

  it('lowers the score when the password contains the person’s own details', async () => {
    const plain = await ratePassword('Zanzibar-Quokka-1990')
    const personal = await ratePassword('Zanzibar-Quokka-1990', ['zanzibar', 'quokka'])
    expect(personal.bits <= plain.bits).toBe(true)
  })

  it('gives a plain-language hint for weak passwords', async () => {
    const result = await ratePassword('password')
    expect(typeof result.hint === 'string' && result.hint.length > 0).toBe(true)
  })
})
