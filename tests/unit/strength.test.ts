import { describe, expect, it } from 'vitest'
import { defaultSettings, rateGenerated, strengthFromBits } from '../../src/generator'
import { DEFAULT_PASSWORD_SETTINGS } from '../../src/generator/password'
import { crackTime } from '../../src/generator/strength'

describe('strengthFromBits', () => {
  it('maps bits to levels at the documented thresholds', () => {
    const at = (bits: number) => strengthFromBits(bits).label
    expect(at(0)).toBe('Very weak')
    expect(at(39.9)).toBe('Very weak')
    expect(at(40)).toBe('Weak')
    expect(at(60)).toBe('Okay')
    expect(at(75)).toBe('Strong')
    expect(at(100)).toBe('Very strong')
    expect(at(500)).toBe('Very strong')
  })

  it('survives nonsense input', () => {
    for (const bad of [NaN, -5, 0]) expect(strengthFromBits(bad).level).toBe(0)
  })

  it('carries the level number the UI will use for the meter', () => {
    expect([0, 45, 65, 80, 120].map((b) => strengthFromBits(b).level)).toEqual([0, 1, 2, 3, 4])
  })
})

describe('crackTime', () => {
  it('never gets shorter as bits grow, and covers both ends', () => {
    const order = ['in under a second', 'in seconds', 'in minutes', 'in hours', 'in days', 'in months', 'in years', 'in centuries', 'not in practice']
    let last = 0
    for (let bits = 0; bits <= 200; bits++) {
      const index = order.indexOf(crackTime(bits))
      expect(index >= last).toBe(true)
      last = index
    }
    expect(crackTime(20)).toBe('in under a second')
    expect(crackTime(128)).toBe('not in practice')
  })
})

describe('rateGenerated', () => {
  it('rates default settings by their exact entropy', () => {
    expect(rateGenerated(defaultSettings('password')).label).toBe('Very strong')
    expect(rateGenerated({ ...DEFAULT_PASSWORD_SETTINGS, length: 8, upper: false, digits: false, symbols: false }).label).toBe('Very weak')
    expect(rateGenerated(defaultSettings('passphrase')).label).toBe('Okay') // 6 words = 66 bits
  })
})
