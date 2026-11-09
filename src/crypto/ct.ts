/**
 * Compares two byte arrays without returning early on the first difference.
 * Best effort: JavaScript engines give no hard timing guarantee, but this
 * removes the obvious "stops at first wrong byte" leak.
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

/** Overwrites secret bytes. (JavaScript strings cannot be wiped; keep secrets as bytes.) */
export function wipe(bytes: Uint8Array): void {
  bytes.fill(0)
}
