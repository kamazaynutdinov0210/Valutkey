import { describe, expect, it } from 'vitest'
import { SECURITY_HEADERS, toHeadersFile } from '../../security-headers'

const csp = SECURITY_HEADERS['Content-Security-Policy'] ?? ''

describe('Content Security Policy', () => {
  it('never allows inline script/style or eval()', () => {
    expect(csp).not.toContain("'unsafe-inline'")
    expect(csp).not.toContain("'unsafe-eval'")
  })

  it('allows only same-origin scripts plus WebAssembly compilation', () => {
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'")
  })

  it('denies everything by default and blocks network egress', () => {
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain("connect-src 'self'")
  })

  it('has no wildcard or plain-http sources', () => {
    expect(csp).not.toMatch(/(^|\s)\*(\s|;|$)/)
    expect(csp).not.toContain('http:')
  })

  it('blocks framing, plugins, base-tag and form hijacking', () => {
    for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"]) {
      expect(csp).toContain(d)
    }
  })

  it('adds transport security and turns off browser features the app never uses', () => {
    expect(SECURITY_HEADERS['Strict-Transport-Security']).toContain('max-age=')
    const policy = SECURITY_HEADERS['Permissions-Policy'] ?? ''
    for (const feature of ['camera=()', 'microphone=()', 'geolocation=()', 'usb=()']) expect(policy).toContain(feature)
  })

  it('stops the HTML entry points from being cached, so an update is seen', () => {
    const file = toHeadersFile()
    for (const path of ['\n/\n', '\n/index.html\n', '\n/sw.js\n']) expect(file).toContain(path)
  })

  it('writes the identical policy into the deployable _headers file', () => {
    expect(toHeadersFile()).toContain(`Content-Security-Policy: ${csp}`)
  })
})
