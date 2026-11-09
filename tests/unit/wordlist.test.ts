import { describe, expect, it } from 'vitest'
import { WORDLIST } from '../../src/generator/wordlist'

describe('default word list (BIP-39 English)', () => {
  it('has 2048 unique, plain lowercase words', () => {
    expect(WORDLIST).toHaveLength(2048)
    expect(new Set(WORDLIST).size).toBe(2048)
    expect(WORDLIST.every((w) => /^[a-z]{3,8}$/.test(w))).toBe(true)
  })

  it('has unique first four letters, so autocomplete-style typing is unambiguous', () => {
    expect(new Set(WORDLIST.map((w) => w.slice(0, 4))).size).toBe(2048)
  })
})
