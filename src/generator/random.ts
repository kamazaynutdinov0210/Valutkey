/** Fills the buffer with random 32-bit numbers. Injectable so tests can script the draws. */
export type FillFn = (buffer: Uint32Array) => void

export const secureFill: FillFn = (buffer) => {
  // The cast keeps this compiling on both older and newer TypeScript typings for typed arrays.
  crypto.getRandomValues(buffer as unknown as Parameters<typeof crypto.getRandomValues>[0])
}

const TWO_POW_32 = 0x100000000

/**
 * Uniform random integer in [0, max) from the browser's secure random source.
 * `value % max` alone would favor small numbers (modulo bias), so draws from the
 * uneven tail are thrown away and redrawn: every outcome is exactly equally likely.
 */
export function randomInt(max: number, fill: FillFn = secureFill): number {
  if (!Number.isInteger(max) || max < 1 || max > TWO_POW_32) throw new RangeError('max out of range')
  if (max === 1) return 0
  const limit = Math.floor(TWO_POW_32 / max) * max
  const buffer = new Uint32Array(1)
  for (;;) {
    fill(buffer)
    const value = buffer[0] ?? 0
    if (value < limit) return value % max
  }
}
