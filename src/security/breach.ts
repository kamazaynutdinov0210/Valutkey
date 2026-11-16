const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()

export async function sha1Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-1', bytes)
  return hex(digest)
}

export type BreachResult = { checked: true; breached: boolean; count: number } | { checked: false; reason: 'offline' | 'error' | 'disabled' }

// Uses k-anonymity range API: only first 5 chars of SHA-1 are sent; suffixes compared locally.
// SHA-1 is used here only for protocol compatibility, never for vault encryption.
export async function checkPasswordBreach(password: string, fetcher: typeof fetch = fetch): Promise<BreachResult> {
  try {
    if (typeof navigator !== 'undefined' && navigator && 'onLine' in navigator && !navigator.onLine) return { checked: false, reason: 'offline' }
    const hash = await sha1Hex(password)
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)
    const res = await fetcher(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { 'Add-Padding': 'true' } })
    if (!res.ok) return { checked: false, reason: 'error' }
    const body = await res.text()
    for (const line of body.split(/\r?\n/)) {
      const [s, c] = line.split(':')
      if (s?.trim().toUpperCase() === suffix) return { checked: true, breached: true, count: Number(c?.trim() || 0) }
    }
    return { checked: true, breached: false, count: 0 }
  } catch {
    return { checked: false, reason: 'error' }
  }
}
