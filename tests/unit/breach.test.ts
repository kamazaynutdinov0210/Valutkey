import { describe, expect, it } from 'vitest'
import { checkPasswordBreach, sha1Hex } from '../../src/security/breach'

describe('breach check', () => {
  it('hashes with SHA-1 hex uppercase', async () => {
    expect(await sha1Hex('password')).toBe('5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8')
  })

  it('sends only prefix and compares suffix locally', async () => {
    let url = ''
    const fetcher: typeof fetch = async (input) => {
      url = String(input)
      return new Response('1E4C9B93F3F0682250B6CF8331B7EE68FD8:999\n', { status: 200 })
    }
    const r = await checkPasswordBreach('password', fetcher)
    expect(url).toContain('/range/5BAA6')
    expect(url).not.toContain('61E4C9B93F3F0682250B6CF8331B7EE68FD8')
    expect(r).toEqual({ checked: true, breached: true, count: 999 })
  })

  it('handles not found', async () => {
    const r = await checkPasswordBreach('password', async () => new Response('AAAAA:1\n', { status: 200 }))
    expect(r).toEqual({ checked: true, breached: false, count: 0 })
  })

  it('fails safely on error', async () => {
    const r = await checkPasswordBreach('x', async () => { throw new Error('net') })
    expect(r).toEqual({ checked: false, reason: 'error' })
  })
})
