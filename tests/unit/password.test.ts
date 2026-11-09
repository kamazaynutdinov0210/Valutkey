import { describe, expect, it } from 'vitest'
import { countValid, log2Big } from '../../src/generator/entropy'
import {
  CHARSETS,
  characterClasses,
  DEFAULT_PASSWORD_SETTINGS,
  generatePassword,
  LOOKALIKES,
  passwordEntropyBits,
  type PasswordSettings,
} from '../../src/generator/password'

const ALL: PasswordSettings = { ...DEFAULT_PASSWORD_SETTINGS }
const only = (kinds: Partial<PasswordSettings>): PasswordSettings => ({
  ...ALL,
  upper: false,
  lower: false,
  digits: false,
  symbols: false,
  ...kinds,
})

describe('generatePassword: shape', () => {
  it('has exactly the requested length across the whole 8-128 range', () => {
    for (let length = 8; length <= 128; length++) {
      expect(generatePassword({ ...ALL, length }).value).toHaveLength(length)
    }
  })

  it('always contains every enabled kind of character, even at the shortest length', () => {
    for (let i = 0; i < 3000; i++) {
      const { value } = generatePassword({ ...ALL, length: 8 })
      expect(/[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value)).toBe(true)
      expect([...value].some((c) => CHARSETS.symbols.includes(c))).toBe(true)
    }
  })

  it('never uses a kind that is switched off', () => {
    for (let i = 0; i < 500; i++) {
      expect(generatePassword(only({ lower: true, digits: true, length: 30 })).value).toMatch(/^[a-z0-9]+$/)
    }
    const symbolsOnly = generatePassword(only({ symbols: true, length: 64 })).value
    expect([...symbolsOnly].every((c) => CHARSETS.symbols.includes(c))).toBe(true)
  })

  it('does not repeat itself', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) seen.add(generatePassword(ALL).value)
    expect(seen.size).toBe(1000)
  })
})

describe('look-alike characters', () => {
  it('are never used when excluded', () => {
    for (let i = 0; i < 500; i++) {
      const { value } = generatePassword({ ...ALL, length: 128, excludeLookalikes: true })
      expect([...value].some((c) => LOOKALIKES.includes(c))).toBe(false)
    }
  })

  it('do appear when not excluded (so the option really changes something)', () => {
    let found = false
    for (let i = 0; i < 200 && !found; i++) {
      found = [...generatePassword({ ...ALL, length: 128 }).value].some((c) => LOOKALIKES.includes(c))
    }
    expect(found).toBe(true)
  })

  it('shrink each kind as expected', () => {
    expect(characterClasses({ ...ALL, excludeLookalikes: true }).map((c) => c.length)).toEqual([24, 24, 8, 25])
  })
})

describe('settings validation', () => {
  it('rejects bad lengths and empty selections', () => {
    for (const length of [7, 129, 12.5, NaN, -1]) expect(() => generatePassword({ ...ALL, length })).toThrow()
    expect(() => generatePassword(only({ length: 20 }))).toThrow()
  })

  it('accepts the exact limits', () => {
    expect(generatePassword({ ...ALL, length: 8 }).value).toHaveLength(8)
    expect(generatePassword({ ...ALL, length: 128 }).value).toHaveLength(128)
  })
})

describe('entropy math', () => {
  it('is length x log2(pool) when only one kind is chosen', () => {
    expect(Math.abs(passwordEntropyBits(only({ lower: true, length: 10 })) - 10 * Math.log2(26)) < 1e-9).toBe(true)
    expect(Math.abs(passwordEntropyBits(only({ digits: true, length: 20 })) - 20 * Math.log2(10)) < 1e-9).toBe(true)
  })

  it('countValid matches brute-force counting on small cases', () => {
    const brute = (length: number, sizes: number[]): bigint => {
      const classOf: number[] = sizes.flatMap((size, i) => new Array<number>(size).fill(i))
      const base = classOf.length
      let count = 0n
      for (let n = 0; n < base ** length; n++) {
        const seen = new Set<number>()
        for (let k = 0, rest = n; k < length; k++, rest = Math.floor(rest / base)) seen.add(classOf[rest % base] ?? -1)
        if (seen.size === sizes.length) count++
      }
      return count
    }
    for (const [length, sizes] of [[3, [2, 2]], [3, [2, 2, 1]], [4, [3, 2]], [4, [2, 1, 1, 1]]] as [number, number[]][]) {
      expect(countValid(length, sizes)).toEqual(brute(length, sizes))
    }
  })

  it('is slightly below length x log2(pool), but within one bit at normal lengths', () => {
    const exact = passwordEntropyBits({ ...ALL, length: 20 })
    const upper = 20 * Math.log2(26 + 26 + 10 + CHARSETS.symbols.length)
    expect(exact <= upper && upper - exact < 1).toBe(true)
  })

  it('is reported with the generated password', () => {
    expect(generatePassword(ALL).entropyBits).toBe(passwordEntropyBits(ALL))
  })

  it('log2Big handles huge numbers', () => {
    expect(Math.abs(log2Big(2n ** 300n) - 300) < 1e-9).toBe(true)
    expect(Math.abs(log2Big(10n ** 100n) - 100 * Math.log2(10)) < 1e-9).toBe(true)
    expect(log2Big(1n)).toBe(0)
  })
})
