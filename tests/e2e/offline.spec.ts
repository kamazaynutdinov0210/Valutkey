import { expect, test } from '@playwright/test'
import { createVault, lockNow, MASTER, tab, unlock } from './helpers'

test('works with no internet: reload, unlock, save and read a password', async ({ page, context }) => {
  await createVault(page)

  // wait until the service worker controls the page (everything is cached by then)
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 30_000 })

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'VaultKey is locked' })).toBeVisible()
  await unlock(page, MASTER) // needs the Argon2 worker and WebAssembly, served from the cache

  await page.getByRole('button', { name: 'Add password' }).click()
  await page.getByLabel('Title').fill('Offline entry')
  await page.getByLabel('Password', { exact: true }).fill('typed-while-offline-1')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Offline entry' })).toBeVisible()

  // the lazily loaded strength dictionaries also come from the cache
  await tab(page, 'Generator').click()
  await page.getByText('Check a password you already use').click()
  await page.getByLabel('Your password').fill('password')
  await expect(page.getByText('Very weak')).toBeVisible({ timeout: 15_000 })

  await lockNow(page)
  await context.setOffline(false)
})

test('Settings explains how to install and how to keep data safe', async ({ page }) => {
  await createVault(page)
  await tab(page, 'Settings').click()
  await expect(page.getByRole('heading', { name: 'Install on this device' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Keep my data safe' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Reminders' })).toBeVisible()
  // the closed-app option is off and cannot be switched on without notification permission
  await expect(page.getByLabel('Also remind me when VaultKey is closed')).toBeDisabled()
})
