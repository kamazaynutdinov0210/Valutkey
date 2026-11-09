import { describe, expect, it } from 'vitest'
import { generate, parseSettings, defaultSettings } from '../../src/generator'
import {
  DEFAULT_PASSPHRASE_SETTINGS,
  generatePassphrase,
  passphraseEntropyBits,
  type PassphraseSettings,
} from '../../src/generator/passphrase'
import type { FillFn } from '../../src/generator/random'

const LIST = [
  'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
  'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa',
]
const scripted = (values: number[]): FillFn => {
  let i = 0
  return (buffer) => {
    buffer[0] = values[i++] ?? 0
  }
}
const base: PassphraseSettings = { ...DEFAULT_PASSPHRASE_SETTINGS, words: 3 }

describe('generatePassphrase', () => {
  it('joins the chosen words with the separator', () => {
    expect(generatePassphrase(base, LIST, scripted([0, 5, 15])).value).toBe('alpha-foxtrot-papa')
    expect(generatePassphrase({ ...base, separator: ' ' }, LIST, scripted([0, 5, 15])).value).toBe('alpha foxtrot papa')
    expect(generatePassphrase({ ...base, separator: '' }, LIST, scripted([0, 5, 15])).value).toBe('alphafoxtrotpapa')
  })

  it('capitalizes each word when asked', () => {
    expect(generatePassphrase({ ...base, capitalize: true }, LIST, scripted([0, 5, 15])).value).toBe(
      'Alpha-Foxtrot-Papa',
    )
  })

  it('adds one digit to one random word when asked', () => {
    // draws: three words, then which word (1), then the digit (7)
    expect(generatePassphrase({ ...base, includeNumber: true }, LIST, scripted([0, 5, 15, 1, 7])).value).toBe(
      'alpha-foxtrot7-papa',
    )
  })

  it('makes the requested number of words with real randomness', () => {
    for (const words of [3, 6, 12, 20]) {
      expect(generatePassphrase({ ...base, words }, LIST).value.split('-')).toHaveLength(words)
    }
  })

  it('rejects out-of-range settings', () => {
    for (const words of [2, 21, 4.5]) expect(() => generatePassphrase({ ...base, words }, LIST)).toThrow()
    expect(() => generatePassphrase({ ...base, separator: '----' }, LIST)).toThrow()
  })
})

describe('passphrase entropy', () => {
  it('is words x log2(list size)', () => {
    expect(passphraseEntropyBits({ ...base, words: 6 }, 16)).toBe(24)
    expect(passphraseEntropyBits({ ...base, words: 6 }, 2048)).toBe(66)
  })

  it('counts the optional digit', () => {
    const plain = passphraseEntropyBits({ ...base, words: 4 }, 2048)
    const withNumber = passphraseEntropyBits({ ...base, words: 4, includeNumber: true }, 2048)
    expect(Math.abs(withNumber - plain - Math.log2(40)) < 1e-9).toBe(true)
  })
})

describe('generate() and saved settings', () => {
  it('dispatches on mode', () => {
    expect(generate(defaultSettings('password')).value).toHaveLength(20)
    expect(generate(defaultSettings('passphrase')).value.split('-')).toHaveLength(6)
  })

  it('round-trips settings through JSON', () => {
    for (const mode of ['password', 'passphrase'] as const) {
      const s = defaultSettings(mode)
      expect(parseSettings(JSON.parse(JSON.stringify(s)))).toEqual(s)
    }
  })

  it('refuses damaged saved settings', () => {
    for (const bad of [null, 'x', 42, {}, { mode: 'other' }, { mode: 'password', length: 3 }, { mode: 'passphrase', words: 99 }]) {
      expect(() => parseSettings(bad)).toThrow()
    }
    expect(() => parseSettings({ mode: 'password', length: 20 })).toThrow() // no kind selected
  })
})
