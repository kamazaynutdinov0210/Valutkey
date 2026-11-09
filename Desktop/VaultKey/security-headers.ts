// Single source of truth for security headers.
// Used by: `vite preview` (so e2e tests run under the real policy),
// the generated dist/_headers file (Netlify / Cloudflare Pages), and unit tests.

export const CSP_DIRECTIVES = {
  'default-src': ["'none'"],
  // 'wasm-unsafe-eval' lets the browser compile WebAssembly (Argon2id) and
  // nothing else. Inline scripts and eval() stay blocked.
  'script-src': ["'self'", "'wasm-unsafe-eval'"],
  'style-src': ["'self'"],
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'"],
  // Same-origin only: the app cannot send data to any other site.
  'connect-src': ["'self'"],
  'manifest-src': ["'self'"],
  'worker-src': ["'self'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'frame-ancestors': ["'none'"],
  'object-src': ["'none'"],
} as const

export function buildCsp(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ')
}

export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': buildCsp(),
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), hid=()',
  // Only has an effect over HTTPS (browsers ignore it on plain http, such as localhost).
  'Strict-Transport-Security': 'max-age=31536000',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
}

export function toHeadersFile(): string {
  const lines = Object.entries(SECURITY_HEADERS).map(([k, v]) => `  ${k}: ${v}`)
  return [
    '/*',
    ...lines,
    '',
    '/',
    '  Cache-Control: no-cache',
    '',
    '/index.html',
    '  Cache-Control: no-cache',
    '',
    '/sw.js',
    '  Cache-Control: no-cache',
    '',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n')
}
