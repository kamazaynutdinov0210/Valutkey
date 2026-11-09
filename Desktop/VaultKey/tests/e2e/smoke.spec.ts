import { expect, test } from '@playwright/test'

type CspWindow = { __csp: string[] }

test('loads with no CSP violations or console errors', async ({ page }) => {
  const problems: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(m.text())
  })
  page.on('pageerror', (e) => problems.push(e.message))
  await page.addInitScript(() => {
    const w = window as unknown as CspWindow
    w.__csp = []
    document.addEventListener('securitypolicyviolation', (e) => {
      w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)
    })
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'VaultKey' })).toBeVisible()

  expect(await page.evaluate(() => (window as unknown as CspWindow).__csp)).toEqual([])
  expect(problems).toEqual([])
})

test('serves strict security headers', async ({ request }) => {
  const res = await request.get('/')
  const headers = res.headers()
  expect(headers['content-security-policy']).toContain("default-src 'none'")
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['referrer-policy']).toBe('no-referrer')
})

test('is installable: manifest and service worker', async ({ page }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).not.toBeNull()

  const manifest = await (await page.request.get(href ?? '')).json()
  expect(manifest.display).toBe('standalone')
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes)
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))

  const active = await page.evaluate(async () => !!(await navigator.serviceWorker.ready).active)
  expect(active).toBe(true)
})

test('never scrolls sideways', async ({ page }) => {
  await page.goto('/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
