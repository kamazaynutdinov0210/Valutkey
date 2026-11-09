/** log2 of a very large integer (BigInt) without overflowing a Number. */
export function log2Big(n: bigint): number {
  if (n <= 0n) throw new RangeError('n must be positive')
  const bits = n.toString(2)
  if (bits.length <= 52) return Math.log2(Number(n))
  return bits.length - 52 + Math.log2(parseInt(bits.slice(0, 52), 2))
}

/**
 * How many strings of `length` characters use every character class at least once?
 * Inclusion-exclusion over the classes. `sizes` are the class sizes (disjoint sets).
 * This is the exact size of the space the generator picks from.
 */
export function countValid(length: number, sizes: number[]): bigint {
  const total = sizes.reduce((a, b) => a + b, 0)
  let count = 0n
  for (let mask = 0; mask < 1 << sizes.length; mask++) {
    let removed = 0
    let picked = 0
    sizes.forEach((size, i) => {
      if (mask & (1 << i)) {
        removed += size
        picked++
      }
    })
    const term = BigInt(total - removed) ** BigInt(length)
    count += picked % 2 === 0 ? term : -term
  }
  return count
}
