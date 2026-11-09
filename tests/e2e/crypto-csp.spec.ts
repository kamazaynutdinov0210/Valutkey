import { expect, test } from '@playwright/test'

type CspWindow = { __csp: string[] }

test('Argon2 worker + WebAssembly run under the strict CSP', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as CspWindow
    w.__csp = []
    document.addEventListener('securitypolicyviolation', (e) => {
      w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)
    })
  })

  await page.goto('/e2e-fixtures/crypto-check.html')
  await expect(page.locator('#result')).toHaveText('ok', { timeout: 30_000 })
  expect(await page.evaluate(() => (window as unknown as CspWindow).__csp)).toEqual([])
})
