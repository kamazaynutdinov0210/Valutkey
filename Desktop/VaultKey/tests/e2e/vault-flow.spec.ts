import { expect, test } from '@playwright/test'
import { createVault, lockNow, MASTER, RECOVERY_PATTERN, tab, unlock } from './helpers'

test('first run: set a master password, save the recovery key, open the app', async ({ page }) => {
  const key = await createVault(page)
  expect(key).toMatch(RECOVERY_PATTERN)
  await expect(page.getByRole('heading', { name: 'Vault', exact: true })).toBeVisible()
})

test('lock, reject a wrong password, then unlock', async ({ page }) => {
  await createVault(page)
  await lockNow(page)
  await page.getByLabel('Master password').fill('definitely not the password')
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('alert')).toContainText(/didn.t work/, { timeout: 30_000 })
  await page.getByLabel('Master password').fill(MASTER)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible({ timeout: 30_000 })
})

test('the vault survives a reload and starts locked', async ({ page }) => {
  await createVault(page)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'VaultKey is locked' })).toBeVisible()
  await unlock(page)
})

test('a forgotten password can be reset with the recovery key', async ({ page }) => {
  const key = await createVault(page)
  await lockNow(page)
  await page.getByRole('button', { name: 'I forgot my password' }).click()
  await page.getByLabel('Recovery key').fill(key.toLowerCase())
  const fresh = 'granite lantern pepper walnut orbit kettle meadow'
  await page.getByLabel('New master password').fill(fresh)
  await page.getByLabel('Type it again').fill(fresh)
  const submit = page.getByRole('button', { name: 'Set new password and unlock' })
  await expect(submit).toBeEnabled({ timeout: 20_000 })
  await submit.click()
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible({ timeout: 30_000 })

  await lockNow(page)
  await page.getByLabel('Master password').fill(MASTER)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('alert')).toContainText(/didn.t work/, { timeout: 30_000 })
})

test('locks by itself after the inactivity time', async ({ page }) => {
  await page.clock.install()
  await createVault(page)
  await page.clock.fastForward(6 * 60 * 1000) // default is 5 minutes
  await expect(page.getByRole('heading', { name: 'VaultKey is locked' })).toBeVisible()
})

test('generator: generates, regenerates and copies', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await createVault(page)
  await tab(page, 'Generator').click()
  const output = page.getByTestId('generated')
  const first = (await output.textContent()) ?? ''
  expect(first).toHaveLength(20)

  await page.getByRole('button', { name: 'Generate' }).click()
  expect(await output.textContent()).not.toBe(first)

  await page.getByRole('button', { name: 'Copy' }).click()
  await expect(page.getByRole('status')).toContainText('Copied')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await output.textContent())

  await page.getByRole('button', { name: 'Passphrase' }).click()
  expect(((await output.textContent()) ?? '').split('-')).toHaveLength(6)
})
