import { describe, expect, it } from 'vitest'
import { randomInt, type FillFn } from '../../src/generator/random'

const scripted = (values: number[]): FillFn => {
  let i = 0
  return (buffer) => {
    buffer[0] = values[i++] ?? 0
  }
}

describe('randomInt', () => {
  it('always stays inside [0, max)', () => {
    for (const max of [1, 2, 3, 7, 94, 2048, 65537]) {
      for (let i = 0; i < 500; i++) {
        const v = randomInt(max)
        expect(v >= 0 && v < max && Number.isInteger(v)).toBe(true)
      }
    }
  })

  it('needs no randomness when there is only one choice', () => {
    const fill: FillFn = () => {
      throw new Error('should not draw')
    }
    expect(randomInt(1, fill)).toBe(0)
  })

  it('maps an accepted draw with a plain modulo', () => {
    expect(randomInt(10, scripted([37]))).toBe(7)
  })

  it('throws away draws from the uneven tail instead of folding them in (no modulo bias)', () => {
    // For max 3 the only value that cannot be mapped evenly is 4294967295.
    let calls = 0
    const fill: FillFn = (buffer) => {
      buffer[0] = [4294967295, 4][calls++] ?? 0
    }
    expect(randomInt(3, fill)).toBe(1) // from the second draw: 4 % 3
    expect(calls).toBe(2)
  })

  it('is evenly spread (60,000 dice rolls, every face within about 5 standard deviations)', () => {
    const counts = [0, 0, 0, 0, 0, 0]
    for (let i = 0; i < 60_000; i++) {
      const face = randomInt(6)
      counts[face] = (counts[face] ?? 0) + 1
    }
    for (const count of counts) expect(Math.abs(count - 10_000) < 500).toBe(true)
  })

  it('rejects invalid ranges', () => {
    for (const bad of [0, -1, 1.5, NaN, 2 ** 32 + 1]) expect(() => randomInt(bad)).toThrow()
  })
})
