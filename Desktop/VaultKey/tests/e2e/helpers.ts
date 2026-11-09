import { expect, type Page } from '@playwright/test'

// Fake data only: traces and screenshots from failed runs may be saved.
export const MASTER = 'plume sunset harbor violet onion fabric ladder'
export const RECOVERY_PATTERN = /^([0-9A-Z]{4}-){13}[0-9A-Z]{4}$/

export async function createVault(page: Page): Promise<string> {
  await page.goto('/')
  await page.getByLabel('Master password').fill(MASTER)
  await page.getByLabel('Type it again').fill(MASTER)
  const create = page.getByRole('button', { name: 'Create my vault' })
  await expect(create).toBeEnabled({ timeout: 20_000 }) // waits for the strength check
  await create.click()
  await expect(page.getByTestId('recovery-key')).toBeVisible({ timeout: 30_000 })
  const key = ((await page.getByTestId('recovery-key').textContent()) ?? '').trim()
  await page.getByLabel('I saved my recovery key').check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  return key
}

export const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name })

export async function lockNow(page: Page) {
  await tab(page, 'Settings').click()
  await page.getByRole('button', { name: 'Lock now' }).click()
  await expect(page.getByRole('heading', { name: 'VaultKey is locked' })).toBeVisible()
}

export async function unlock(page: Page, password = MASTER) {
  await page.getByLabel('Master password').fill(password)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible({ timeout: 30_000 })
}
